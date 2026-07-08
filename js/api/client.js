import { CONFIG } from '../config.js';

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiError';
    this.code = code || 'ERROR';
  }
}

/**
 * Calls the Apps Script backend with a given action and payload.
 *
 * Uses "text/plain" as the request Content-Type on purpose: it keeps
 * the browser from sending a CORS preflight (OPTIONS) request, which
 * Apps Script web apps don't handle and would otherwise fail. The body
 * is still JSON — the backend parses e.postData.contents itself.
 *
 * Every screen/feature should go through this one function rather than
 * calling fetch directly, so auth, error shape, and the CORS workaround
 * stay in one place.
 */
export async function callApi(action, payload = {}) {
  if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE_')) {
    throw new ApiError('Backend URL is not configured yet. Edit js/config.js.', 'NOT_CONFIGURED');
  }

  let response;
  try {
    response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: CONFIG.API_TOKEN,
        action,
        payload,
      }),
    });
  } catch (networkErr) {
    throw new ApiError('Could not reach the backend. Check your connection.', 'NETWORK_ERROR');
  }

  let json;
  try {
    json = await response.json();
  } catch (parseErr) {
    throw new ApiError('Backend returned an unreadable response.', 'BAD_RESPONSE');
  }

  if (!json.ok) {
    const message = json.error && json.error.message ? json.error.message : 'Unknown backend error';
    const code = json.error && json.error.code ? json.error.code : 'ERROR';
    throw new ApiError(message, code);
  }

  return json.data;
}
