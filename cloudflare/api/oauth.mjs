// Google & GitHub OAuth handlers
import { createToken, randomUUID, hashPassword } from './crypto.mjs';
import { findUserByEmail, createUser } from './db.mjs';

const BASE = 'https://pictofrontend.com';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findOrCreate(db, email, jwtSecret) {
  let user = await findUserByEmail(db, email);
  if (!user) {
    const id = randomUUID();
    // OAuth users get a random unguessable password hash
    const ph = await hashPassword(randomUUID() + randomUUID());
    await createUser(db, { id, email, passwordHash: ph });
    user = { id, email };
  }
  const token = await createToken({ sub: user.id, email: user.email || email }, jwtSecret);
  return { token, email: user.email || email, user_id: user.id };
}

function redirectWithToken(token, email) {
  return Response.redirect(
    `${BASE}/auth/callback?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    302
  );
}

function redirectWithError(msg) {
  return Response.redirect(`${BASE}/sign-in?error=${encodeURIComponent(msg)}`, 302);
}

// ── Google ────────────────────────────────────────────────────────────────────

export function googleLoginHandler(request, env) {
  if (!env.GOOGLE_CLIENT_ID) return redirectWithError('Google OAuth not configured');
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${BASE}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

export async function googleCallbackHandler(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return redirectWithError(url.searchParams.get('error') || 'auth_cancelled');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${BASE}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) return redirectWithError('google_token_exchange_failed');
  const tokens = await tokenRes.json();

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) return redirectWithError('google_userinfo_failed');
  const gUser = await userRes.json();
  const email = gUser.email?.toLowerCase();
  if (!email) return redirectWithError('google_no_email');

  const { token, email: finalEmail } = await findOrCreate(env.DB, email, env.JWT_SECRET);
  return redirectWithToken(token, finalEmail);
}

// ── GitHub ────────────────────────────────────────────────────────────────────

export function githubLoginHandler(request, env) {
  if (!env.GITHUB_CLIENT_ID) return redirectWithError('GitHub OAuth not configured');
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${BASE}/api/auth/github/callback`,
    scope: 'user:email',
  });
  return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 302);
}

export async function githubCallbackHandler(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return redirectWithError(url.searchParams.get('error') || 'auth_cancelled');

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      code,
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      redirect_uri: `${BASE}/api/auth/github/callback`,
    }),
  });

  if (!tokenRes.ok) return redirectWithError('github_token_exchange_failed');
  const tokens = await tokenRes.json();
  if (tokens.error) return redirectWithError(tokens.error);

  // Get primary verified email
  let email;
  const emailRes = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'PicToFrontend/3.0' },
  });
  if (emailRes.ok) {
    const emails = await emailRes.json();
    const primary = emails.find(e => e.primary && e.verified);
    email = primary?.email?.toLowerCase();
  }

  if (!email) {
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'PicToFrontend/3.0' },
    });
    if (userRes.ok) {
      const ghUser = await userRes.json();
      email = ghUser.email?.toLowerCase();
    }
  }

  if (!email) return redirectWithError('github_no_email');

  const { token, email: finalEmail } = await findOrCreate(env.DB, email, env.JWT_SECRET);
  return redirectWithToken(token, finalEmail);
}
