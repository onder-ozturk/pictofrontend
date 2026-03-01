// D1 database operations

const INITIAL_CREDITS = 100;

// ── Users ────────────────────────────────────────────────────────────────────
export async function createUser(db, { id, email, passwordHash }) {
  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, email.toLowerCase(), passwordHash, now).run();
}

export async function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email.toLowerCase()).first();
}

export async function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

// ── Credits ──────────────────────────────────────────────────────────────────
export async function getBalance(db, userId) {
  const row = await db.prepare('SELECT balance FROM credits WHERE user_id = ?').bind(userId).first();
  if (row) return row.balance;
  // Auto-seed
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO credits (user_id, balance, updated_at) VALUES (?, ?, ?)')
    .bind(userId, INITIAL_CREDITS, now).run();
  return INITIAL_CREDITS;
}

export async function debitCredits(db, userId, amount, model = '', endpoint = '') {
  const balance = await getBalance(db, userId);
  if (balance < amount) return false;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE credits SET balance = balance - ?, updated_at = ? WHERE user_id = ?')
      .bind(amount, now, userId),
    db.prepare('INSERT INTO credit_ledger (user_id, delta, model, endpoint, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, -amount, model, endpoint, 'generation', now),
  ]);
  return true;
}

export async function addCredits(db, userId, amount, note = '') {
  await getBalance(db, userId); // ensure row exists
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE credits SET balance = balance + ?, updated_at = ? WHERE user_id = ?')
      .bind(amount, now, userId),
    db.prepare('INSERT INTO credit_ledger (user_id, delta, model, endpoint, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, amount, '', '', note || 'topup', now),
  ]);
  return getBalance(db, userId);
}

export async function getLedger(db, userId, limit = 20) {
  const { results } = await db.prepare(
    'SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?'
  ).bind(userId, limit).all();
  return results;
}

// ── Sessions ─────────────────────────────────────────────────────────────────
export async function getSession(db, sessionId) {
  const row = await db.prepare('SELECT * FROM sessions WHERE session_id = ?').bind(sessionId).first();
  if (!row) return { messages: [], versions: [] };
  return {
    messages: JSON.parse(row.messages || '[]'),
    versions: JSON.parse(row.versions || '[]'),
  };
}

export async function saveSession(db, sessionId, userId, messages, versions) {
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO sessions (session_id, user_id, messages, versions, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET messages=excluded.messages, versions=excluded.versions, updated_at=excluded.updated_at
  `).bind(sessionId, userId || null, JSON.stringify(messages.slice(-20)), JSON.stringify(versions.slice(-5)), now).run();
}

export async function getVersions(db, sessionId) {
  const row = await db.prepare('SELECT versions FROM sessions WHERE session_id = ?').bind(sessionId).first();
  if (!row) return [];
  return JSON.parse(row.versions || '[]');
}
