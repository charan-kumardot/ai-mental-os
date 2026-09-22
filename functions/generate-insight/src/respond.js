/**
 * Logs the full error server-side (Appwrite function logs) but returns a
 * generic, safe message to the client — raw error messages can leak
 * implementation details (which AI provider is used, internal collection
 * names, upstream response bodies) to anyone probing the API.
 */
function failSafely(res, error, e, userMessage, status = 500) {
  error(e && e.message ? e.message : String(e));
  return res.json({ error: userMessage }, status);
}

module.exports = { failSafely };
