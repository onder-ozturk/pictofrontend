// Credits route handlers
import { getUser, jsonResponse, errorResponse } from './crypto.mjs';
import { getBalance, addCredits, getLedger } from './db.mjs';

export async function balanceHandler(request, env) {
  const user = await getUser(request, env);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const balance = await getBalance(env.DB, user.sub);
  return jsonResponse({ user_id: user.sub, balance });
}

export async function historyHandler(request, env) {
  const user = await getUser(request, env);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  const ledger = await getLedger(env.DB, user.sub, 20);
  return jsonResponse({ user_id: user.sub, transactions: ledger });
}

export async function topupHandler(request, env) {
  const user = await getUser(request, env);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const amount = parseInt(body?.amount) || 100;
  const newBalance = await addCredits(env.DB, user.sub, amount, 'topup');
  return jsonResponse({ user_id: user.sub, added: amount, balance: newBalance });
}
