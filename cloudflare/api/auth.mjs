// Auth route handlers
import { hashPassword, verifyPassword, createToken, getUser, jsonResponse, errorResponse, randomUUID } from './crypto.mjs';
import { createUser, findUserByEmail, findUserById } from './db.mjs';

export async function registerHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('INVALID_BODY', 'JSON required'); }

  const { email, password } = body || {};
  if (!email || !password) return errorResponse('MISSING_FIELDS', 'Email and password required');
  if (password.length < 8) return errorResponse('WEAK_PASSWORD', 'Password must be at least 8 characters');

  const existing = await findUserByEmail(env.DB, email);
  if (existing) return errorResponse('EMAIL_TAKEN', 'Email already registered', 409);

  const id = randomUUID();
  const passwordHash = await hashPassword(password);
  await createUser(env.DB, { id, email, passwordHash });

  const token = await createToken({ sub: id, email: email.toLowerCase() }, env.JWT_SECRET);
  return jsonResponse({ access_token: token, email: email.toLowerCase(), user_id: id }, 201);
}

export async function loginHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('INVALID_BODY', 'JSON required'); }

  const { email, password } = body || {};
  if (!email || !password) return errorResponse('MISSING_FIELDS', 'Email and password required');

  const user = await findUserByEmail(env.DB, email);
  if (!user) return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const token = await createToken({ sub: user.id, email: user.email }, env.JWT_SECRET);
  return jsonResponse({ access_token: token, email: user.email, user_id: user.id });
}

export async function refreshHandler(request, env) {
  const user = await getUser(request, env);
  if (!user) return errorResponse('UNAUTHORIZED', 'Invalid or expired token', 401);

  const token = await createToken({ sub: user.sub, email: user.email }, env.JWT_SECRET);
  return jsonResponse({ access_token: token, email: user.email, user_id: user.sub });
}

export async function meHandler(request, env) {
  const user = await getUser(request, env);
  if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

  const dbUser = await findUserById(env.DB, user.sub);
  if (!dbUser) return errorResponse('NOT_FOUND', 'User not found', 404);

  const { getBalance } = await import('./db.mjs');
  const balance = await getBalance(env.DB, user.sub);

  return jsonResponse({
    user_id: dbUser.id,
    email: dbUser.email,
    created_at: dbUser.created_at,
    credit_balance: balance,
  });
}
