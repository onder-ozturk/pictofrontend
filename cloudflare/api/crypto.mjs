// JWT + password hashing via Web Crypto API (no external deps)

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromB64url(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(s) {
  return new Uint8Array(s.match(/.{2}/g).map(b => parseInt(b, 16)));
}
function encode(s) { return new TextEncoder().encode(s); }

// ── Password hashing (PBKDF2-SHA256) ────────────────────────────────────────
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256
  );
  return `${toHex(salt)}:${toHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const salt = fromHex(saltHex);
  const key = await crypto.subtle.importKey('raw', encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100_000 }, key, 256
  );
  return toHex(bits) === hashHex;
}

// ── JWT (HS256) ──────────────────────────────────────────────────────────────
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createToken(payload, secret, expiresIn = 7 * 86400) {
  const header = b64url(encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body   = b64url(encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + expiresIn, iat: Math.floor(Date.now() / 1000) })));
  const sig    = b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), encode(`${header}.${body}`)));
  return `${header}.${body}.${sig}`;
}

export async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, sig] = parts;
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), encode(`${header}.${body}`));
  if (!valid) throw new Error('Invalid signature');
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body)));
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return payload;
}

export function randomUUID() {
  return crypto.randomUUID();
}

// ── CORS ────────────────────────────────────────────────────────────────────
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function corsResponse(body = null, init = {}) {
  const headers = { ...CORS_HEADERS, ...(init.headers || {}) };
  if (body === null) return new Response(null, { status: 204, headers });
  return new Response(body, { ...init, headers });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(code, message, status = 400) {
  return jsonResponse({ type: 'error', code, message }, status);
}

// ── Auth extraction ──────────────────────────────────────────────────────────
export async function getUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  try {
    return await verifyToken(auth.slice(7), env.JWT_SECRET);
  } catch {
    return null;
  }
}
