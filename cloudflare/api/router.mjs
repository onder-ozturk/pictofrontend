// API request router
import { corsResponse, jsonResponse, errorResponse } from './crypto.mjs';
import { registerHandler, loginHandler, refreshHandler, meHandler } from './auth.mjs';
import { balanceHandler, historyHandler, topupHandler } from './credits.mjs';
import { generateImageHandler, generateTextHandler, generateUrlHandler, versionsHandler } from './generate.mjs';
import { modelsResponse } from './models.mjs';

export async function handleAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') return corsResponse();

  // ── Models ──────────────────────────────────────────────────────────────
  if (path === '/api/models' && method === 'GET') return modelsResponse();

  // ── Auth ─────────────────────────────────────────────────────────────────
  if (path === '/api/auth/register' && method === 'POST') return registerHandler(request, env);
  if (path === '/api/auth/login'    && method === 'POST') return loginHandler(request, env);
  if (path === '/api/auth/refresh'  && method === 'POST') return refreshHandler(request, env);
  if (path === '/api/auth/me'       && method === 'GET')  return meHandler(request, env);

  // ── Credits ───────────────────────────────────────────────────────────────
  if (path === '/api/credits/balance'  && method === 'GET')  return balanceHandler(request, env);
  if (path === '/api/credits/history'  && method === 'GET')  return historyHandler(request, env);
  if (path === '/api/credits/topup'    && method === 'POST') return topupHandler(request, env);

  // ── Generation ────────────────────────────────────────────────────────────
  if (path === '/api/generate'           && method === 'POST') return generateImageHandler(request, env);
  if (path === '/api/generate/from-text' && method === 'POST') return generateTextHandler(request, env);
  if (path === '/api/generate/from-url'  && method === 'POST') return generateUrlHandler(request, env);

  // ── Sessions ──────────────────────────────────────────────────────────────
  const versionsMatch = path.match(/^\/api\/sessions\/([^/]+)\/versions$/);
  if (versionsMatch && method === 'GET') return versionsHandler(request, env, versionsMatch[1]);

  // ── Metrics (simple) ──────────────────────────────────────────────────────
  if (path === '/api/metrics' && method === 'GET') {
    return jsonResponse({ status: 'ok', message: 'Metrics available via Cloudflare Analytics' });
  }

  return errorResponse('NOT_FOUND', `${method} ${path} not found`, 404);
}
