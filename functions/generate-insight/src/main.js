const { Client, Databases, Query, ID, Permission, Role } = require('node-appwrite');
const { computeStats } = require('./stats');
const { buildGroundingPreamble } = require('./grounding');
const { failSafely } = require('./respond');
const { buildWeeklyReview } = require('./weeklyReview');
const { buildOperatingManual } = require('./operatingManual');
const { detectPatterns } = require('./detectPatterns');
const { computeState } = require('./stateEngine');
const { logExperimentObservations } = require('./experimentObservations');
const { recordMemory, listMemories, forgetMemory, markMemoryOutdated, correctMemory } = require('./memoryEngine');
const { computeOpportunityWindow, fetchUserTimezone } = require('./opportunityWindow');
const { compileIntervention } = require('./interventionCompiler');
const { fetchReminderLearning } = require('./notificationLearning');
const { checkMomentIntelligence } = require('./momentIntelligence');
const { buildWhatHappened } = require('./whatHappened');
const { reflectOnEntry } = require('./listeningMode');
const { buildRecoveryRadar } = require('./recoveryRadar');
const { draftPersonalMessage, draftProfessionalSummary } = require('./messageDrafting');
const { rehearseConversation, draftBoundaryMessage } = require('./conversationTools');
const { computeFutureMe } = require('./futureMe');
const { simulateDecision } = require('./decisionSimulator');
const { facilitateCircle } = require('./circleFacilitator');
const { sendCircleMessage } = require('./circleMessaging');
const { buildWellbeingPassport } = require('./wellbeingPassport');
const { buildLongTermJourney } = require('./longTermJourney');

const DB_ID = 'personal_os';

// ---- minimal AI gateway (self-contained copy of packages/ai — Appwrite's
// isolated build environment can't resolve monorepo workspace deps, so this
// function ships its own copy rather than depending on a local package) ----

async function callGroq(apiKey, messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages,
      temperature: 0.4,
      max_tokens: 500,
      // gpt-oss is a reasoning model — without this it can burn the whole
      // token budget on hidden chain-of-thought and return empty `content`
      // (confirmed: reproduced with default effort + low max_tokens).
      reasoning_effort: 'low',
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  if (!content.trim()) {
    throw new Error(`Groq returned empty content (finish_reason: ${data.choices?.[0]?.finish_reason})`);
  }
  return content;
}

async function callOpenRouter(apiKey, messages) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'anthropic/claude-sonnet-4.5', messages, temperature: 0.4, max_tokens: 200 }),
  });
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function generateFast(messages, env, log) {
  if (env.GROQ_API_KEY) {
    try {
      return await callGroq(env.GROQ_API_KEY, messages);
    } catch (e) {
      log(`Groq failed, falling back to OpenRouter: ${e.message}`);
    }
  }
  if (env.OPENROUTER_API_KEY) {
    return await callOpenRouter(env.OPENROUTER_API_KEY, messages);
  }
  throw new Error('No AI provider configured');
}

module.exports = async ({ req, res, log, error }) => {
  const userId = req.headers['x-appwrite-user-id'];
  if (!userId) {
    return res.json({ error: 'Unauthenticated' }, 401);
  }

  let body = {};
  try {
    if (req.bodyJson && typeof req.bodyJson === 'object') body = req.bodyJson;
    else if (typeof req.body === 'object' && req.body !== null) body = req.body;
    else if (req.bodyText || (typeof req.body === 'string' && req.body)) body = JSON.parse(req.bodyText || req.body);
  } catch {
    body = {};
  }

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);
  const databases = new Databases(client);

  if (body.action === 'weekly_review') {
    try {
      const result = await buildWeeklyReview(databases, userId, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't build your weekly review right now. Please try again later.");
    }
  }

  if (body.action === 'operating_manual') {
    try {
      const result = await buildOperatingManual(databases, userId, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't build your operating manual right now. Please try again later.");
    }
  }

  if (body.action === 'detect_patterns') {
    try {
      const result = await detectPatterns(databases, userId, generateFast, process.env, log, !!body.forceRefresh);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't check for patterns right now. Please try again later.");
    }
  }

  if (body.action === 'compute_state') {
    try {
      const result = await computeState(databases, userId, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't work out your current state right now. Please try again later.");
    }
  }

  if (body.action === 'log_experiment_observations') {
    try {
      const result = await logExperimentObservations(databases, userId, body.experimentId, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't log observations for that experiment right now.");
    }
  }

  if (body.action === 'record_memory') {
    try {
      const result = await recordMemory(databases, userId, body);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't save that right now.");
    }
  }

  if (body.action === 'list_memories') {
    try {
      const result = await listMemories(databases, userId, body.limit);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't load your memory right now.");
    }
  }

  if (body.action === 'forget_memory') {
    try {
      const result = await forgetMemory(databases, userId, body.memoryId);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't forget that right now.");
    }
  }

  if (body.action === 'mark_memory_outdated') {
    try {
      const result = await markMemoryOutdated(databases, userId, body.memoryId, body.outdated);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't update that right now.");
    }
  }

  if (body.action === 'correct_memory') {
    try {
      const result = await correctMemory(databases, userId, body.memoryId, body.content);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't save that correction right now.");
    }
  }

  if (body.action === 'moment_intelligence') {
    try {
      const result = await checkMomentIntelligence(databases, userId, log);
      return res.json({ skipped: false, ...result });
    } catch (e) {
      return failSafely(res, error, e, "Couldn't check on that right now.");
    }
  }

  if (body.action === 'listen_reflect') {
    try {
      const result = await reflectOnEntry(body.content, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "I couldn't reflect on that right now.");
    }
  }

  if (body.action === 'recovery_radar') {
    try {
      const result = await buildRecoveryRadar(databases, userId, generateFast, process.env, log, body.communicationStyle);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't build your recovery radar right now.");
    }
  }

  if (body.action === 'draft_personal_message') {
    try {
      const result = await draftPersonalMessage(databases, userId, body.recipientType, generateFast, process.env, log, body.communicationStyle);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't draft that message right now.");
    }
  }

  if (body.action === 'draft_professional_summary') {
    try {
      const result = await draftProfessionalSummary(databases, userId, generateFast, process.env, log, body.communicationStyle);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't build that summary right now.");
    }
  }

  if (body.action === 'rehearse_conversation') {
    try {
      const result = await rehearseConversation(body.mode, body.situation, body.plannedWords, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't run that rehearsal right now.");
    }
  }

  if (body.action === 'draft_boundary_message') {
    try {
      const result = await draftBoundaryMessage(body.input, body.tone, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't draft that right now.");
    }
  }

  if (body.action === 'future_me') {
    try {
      const result = await computeFutureMe(databases, userId, body.preset, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't work that out right now.");
    }
  }

  if (body.action === 'simulate_decision') {
    try {
      const decision = await databases.getDocument(DB_ID, 'decisions', body.decisionId);
      if (decision.userId !== userId) throw new Error('Not your decision');
      const result = await simulateDecision(decision, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't explore that decision right now.");
    }
  }

  if (body.action === 'wellbeing_passport') {
    try {
      const result = await buildWellbeingPassport(databases, userId, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't build your passport right now.");
    }
  }

  if (body.action === 'long_term_journey') {
    try {
      const result = await buildLongTermJourney(databases, userId);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't build your journey right now.");
    }
  }

  if (body.action === 'send_circle_message') {
    try {
      const profileRes = await databases.listDocuments(DB_ID, 'profiles', [Query.equal('userId', userId), Query.limit(1)]);
      const displayName = profileRes.documents[0]?.name || body.displayName;
      const result = await sendCircleMessage(databases, userId, displayName, body.circleId, body.content);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't send that right now.");
    }
  }

  if (body.action === 'facilitate_circle') {
    try {
      const membership = await databases.listDocuments(DB_ID, 'circle_members', [
        Query.equal('circleId', body.circleId),
        Query.equal('userId', userId),
        Query.limit(1),
      ]);
      if (membership.documents.length === 0) throw new Error('Not a member of this circle');
      const result = await facilitateCircle(databases, body.circleId, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't suggest anything right now.");
    }
  }

  if (body.action === 'what_happened') {
    try {
      const result = await buildWhatHappened(databases, userId, generateFast, process.env, log, body.communicationStyle);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't reconstruct today right now.");
    }
  }

  if (body.action === 'notification_learning') {
    try {
      const result = await fetchReminderLearning(databases, userId, !!body.reminderEnabled);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't check on your reminder right now.");
    }
  }

  if (body.action === 'compile_intervention') {
    try {
      const result = await compileIntervention(databases, userId, body.minutesAvailable, generateFast, process.env, log);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't put together a routine right now. Please try again later.");
    }
  }

  if (body.action === 'opportunity_window') {
    try {
      const [checkinsRes, timezone] = await Promise.all([
        databases.listDocuments(DB_ID, 'checkins', [
          Query.equal('userId', userId),
          Query.orderDesc('$createdAt'),
          Query.limit(100),
        ]),
        fetchUserTimezone(databases, userId),
      ]);
      // Purely arithmetic (spec §35 / §58 — no AI call needed or made here).
      const result = computeOpportunityWindow(checkinsRes.documents, timezone);
      return res.json(result);
    } catch (e) {
      return failSafely(res, error, e, "Couldn't check for an opportunity window right now.");
    }
  }

  try {
    const checkinsRes = await databases.listDocuments(DB_ID, 'checkins', [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(30),
    ]);
    const checkins = checkinsRes.documents;

    // Rule-based gate: never call an LLM when there isn't enough signal to
    // say anything grounded (spec section 58 — SQL/rules before AI).
    if (checkins.length < 5) {
      return res.json({
        skipped: true,
        reason: 'not_enough_data',
        sampleSize: checkins.length,
        message: `Only ${checkins.length} check-in${checkins.length === 1 ? '' : 's'} so far — need at least 5 before a grounded insight is possible.`,
      });
    }

    const stats = computeStats(checkins);
    const deviation = stats.recentMean - stats.mean;

    // Rule-based gate #2: if there's no meaningful deviation, a deterministic
    // message is more honest (and cheaper) than asking a model to invent
    // something interesting to say about a flat trend.
    if (Math.abs(deviation) < 0.4) {
      return res.json({
        skipped: true,
        reason: 'no_meaningful_deviation',
        sampleSize: stats.sampleSize,
        message: 'Your mood has been steady relative to your recent range — nothing notable to flag right now.',
      });
    }

    const direction = deviation > 0 ? 'higher' : 'lower';
    const evidence = [
      {
        kind: 'observed',
        text: `Average mood over the last ${Math.min(checkins.length, 3)} check-ins is ${direction} than the ${stats.sampleSize}-check-in baseline (recent avg ${stats.recentMean.toFixed(1)}/5 vs baseline avg ${stats.mean.toFixed(1)}/5).`,
      },
      { kind: 'observed', text: `Baseline built from ${stats.sampleSize} check-ins, standard deviation ${stats.stdDev.toFixed(2)}.` },
    ];

    const preamble = buildGroundingPreamble(evidence);
    const insightText = await generateFast(
      [
        { role: 'system', content: preamble },
        { role: 'user', content: 'Write the insight now.' },
      ],
      process.env,
      log
    );

    if (!insightText.trim()) {
      throw new Error('AI provider returned empty insight text');
    }

    const confidence = Math.min(0.5 + stats.sampleSize / 60, 0.9);

    const insightDoc = await databases.createDocument(
      DB_ID,
      'insights',
      ID.unique(),
      {
        userId,
        title: direction === 'higher' ? 'Mood trending up' : 'Mood trending down',
        body: insightText.trim(),
        category: 'mood_trend',
        evidenceIds: checkins.slice(0, 3).map((c) => c.$id),
        confidence,
      },
      [Permission.read(Role.user(userId)), Permission.update(Role.user(userId)), Permission.delete(Role.user(userId))]
    );

    return res.json({ skipped: false, insight: insightDoc });
  } catch (e) {
    return failSafely(res, error, e, "Couldn't check for new insights right now. Please try again later.");
  }
};
