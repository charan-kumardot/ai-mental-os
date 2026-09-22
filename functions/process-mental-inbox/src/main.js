const { Client, Databases, Users, ID, Permission, Role } = require('node-appwrite');
const { classify, safetyResponse } = require('./safety');
const { deleteAccount } = require('./deleteAccount');
const { failSafely } = require('./respond');

const DB_ID = 'personal_os';
const VALID_CATEGORIES = ['action', 'decision', 'information', 'conversation', 'emotional', 'defer', 'not_actionable'];
const VALID_INTENTS = ['listen', 'reflect', 'understand', 'solve', 'plan', 'decide', 'vent', 'act'];

async function categorize(text, apiKey) {
  if (!apiKey) return 'information';
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0,
        max_tokens: 200,
        reasoning_effort: 'low',
        messages: [
          {
            role: 'system',
            content: `Classify this piece of text into exactly one category: ${VALID_CATEGORIES.join(', ')}. Reply with only the category word, nothing else.`,
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) return 'information';
    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content ?? '').trim().toLowerCase();
    return VALID_CATEGORIES.includes(raw) ? raw : 'information';
  } catch {
    return 'information';
  }
}

async function transcribeAudio(base64Audio, mimeType, apiKey) {
  const buffer = Buffer.from(base64Audio, 'base64');
  const form = new FormData();
  const ext = mimeType.includes('m4a') || mimeType.includes('mp4') ? 'm4a' : 'wav';
  form.append('file', new Blob([buffer], { type: mimeType }), `recording.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq transcription error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.text || '').trim();
}

/**
 * Extracts intent (per spec section 9: LISTEN/REFLECT/UNDERSTAND/SOLVE/
 * PLAN/DECIDE/VENT/ACT) plus event/emotion/concern. Best-effort — the
 * transcript itself is the primary value, this metadata just personalizes
 * later. Never blocks saving if it fails.
 */
async function extractVoiceMeta(transcript, apiKey) {
  const fallback = { intent: 'listen', event: null, emotion: null, concern: null };
  if (!apiKey) return fallback;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        temperature: 0,
        max_tokens: 400,
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Analyze this voice reflection. Reply with ONLY a JSON object: {"intent": one of [${VALID_INTENTS.join(', ')}], "event": short string or null, "emotion": short string or null, "concern": short string or null}. "intent" reflects what the person seems to want from sharing this — e.g. "vent" if they just need to get it out, "solve" if they want a solution, "decide" if weighing options.`,
          },
          { role: 'user', content: transcript },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      intent: VALID_INTENTS.includes(parsed.intent) ? parsed.intent : 'listen',
      event: parsed.event || null,
      emotion: parsed.emotion || null,
      concern: parsed.concern || null,
    };
  } catch {
    return fallback;
  }
}

async function runSafetyGate(databases, userId, text, error) {
  const safety = classify(text);
  if (!safety.flagged) return null;
  try {
    await databases.createDocument(
      DB_ID,
      'safety_events',
      ID.unique(),
      { userId, category: safety.category, severity: safety.severity, actionTaken: 'showed_safety_response' },
      [Permission.read(Role.user(userId))]
    );
  } catch (e) {
    error(`Failed to log safety event: ${e.message}`);
  }
  return safetyResponse(safety.category);
}

/**
 * This function has grown beyond "process mental inbox" into a general
 * user-action processor, routed by `body.action` — the Appwrite plan on
 * this project caps functions at 2 (confirmed empirically), so new
 * server-side actions get added here rather than as new functions.
 * Default action (no `action` field) is the original mental-inbox flow,
 * kept for backward compatibility with the existing client call.
 */
module.exports = async ({ req, res, log, error }) => {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) return res.json({ error: 'Unauthenticated' }, 401);

  let body = {};
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') {
      body = req.bodyJson;
    } else if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      body = JSON.parse(req.bodyText || req.body || '{}');
    }
  } catch (e) {
    return failSafely(res, error, e, 'Invalid request.', 400);
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const databases = new Databases(client);

  if (body.action === 'delete_account') {
    try {
      const users = new Users(client);
      await deleteAccount(databases, users, userId, log);
      return res.json({ success: true });
    } catch (e) {
      return failSafely(res, error, e, 'Could not delete your account. Please try again.');
    }
  }

  if (body.action === 'voice_reflection') {
    if (!body.audioBase64) return res.json({ error: 'audioBase64 is required' }, 400);
    try {
      const transcript = await transcribeAudio(body.audioBase64, body.mimeType || 'audio/m4a', process.env.GROQ_API_KEY);
      if (!transcript) {
        return res.json({ error: "Couldn't make out any speech in that recording — try again?" }, 200);
      }

      const safetyMsg = await runSafetyGate(databases, userId, transcript, error);
      if (safetyMsg) {
        return res.json({ flagged: true, response: safetyMsg, transcript });
      }

      const meta = await extractVoiceMeta(transcript, process.env.GROQ_API_KEY);
      return res.json({ flagged: false, transcript, ...meta });
    } catch (e) {
      return failSafely(res, error, e, "Couldn't process that recording. Please try again.");
    }
  }

  if (body.action === 'save_voice_reflection') {
    try {
      const doc = await databases.createDocument(
        DB_ID,
        'voice_reflections',
        ID.unique(),
        {
          userId,
          transcript: body.transcript || '',
          intent: body.intent || 'listen',
          extractedEvent: body.event || undefined,
          extractedEmotion: body.emotion || undefined,
          extractedConcern: body.concern || undefined,
          savedAsMemory: true,
        },
        [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
      );
      return res.json({ success: true, item: doc });
    } catch (e) {
      return failSafely(res, error, e, 'Could not save that reflection. Please try again.');
    }
  }

  const content = (body.content || '').trim();
  if (!content) return res.json({ error: 'content is required' }, 400);

  const safetyMsg = await runSafetyGate(databases, userId, content, error);
  if (safetyMsg) {
    return res.json({ flagged: true, response: safetyMsg });
  }

  try {
    const category = await categorize(content, process.env.GROQ_API_KEY);
    const doc = await databases.createDocument(
      DB_ID,
      'mental_inbox',
      ID.unique(),
      { userId, content, category, resolved: false },
      [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
    );
    return res.json({ flagged: false, item: doc });
  } catch (e) {
    return failSafely(res, error, e, 'Could not save that. Please try again.');
  }
};
