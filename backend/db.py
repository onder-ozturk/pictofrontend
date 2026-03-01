"""
PicToFrontend — Persistent credit system via async SQLite (aiosqlite).

Sprint 4:
  s4-b4 — Kalıcı kredi sistemi: SQLite, kullanım geçmişi, bakiye API'si

Tables:
  credits        — one row per user: balance
  credit_ledger  — append-only transaction log
"""

import os
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

DB_PATH: str = os.getenv("DB_PATH", "pictofrontend.db")

INITIAL_BALANCE: int = 100   # credits granted on registration

# ─── Schema ───────────────────────────────────────────────────────────────────
_SCHEMA = """
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS credits (
    user_id    TEXT PRIMARY KEY,
    balance    INTEGER NOT NULL DEFAULT 100,
    updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT    NOT NULL,
    delta      INTEGER NOT NULL,
    model      TEXT    NOT NULL DEFAULT '',
    endpoint   TEXT    NOT NULL DEFAULT '',
    note       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_user
    ON credit_ledger(user_id, id DESC);
"""


async def init_db() -> None:
    """Create tables if they don't exist. Call once at startup."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(_SCHEMA)
        await db.commit()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure_user(db: aiosqlite.Connection, user_id: str) -> int:
    """
    Return current balance. Inserts a fresh record with INITIAL_BALANCE
    if the user doesn't exist yet.
    """
    async with db.execute(
        "SELECT balance FROM credits WHERE user_id = ?", (user_id,)
    ) as cur:
        row = await cur.fetchone()
    if row:
        return row[0]
    await db.execute(
        "INSERT INTO credits (user_id, balance, updated_at) VALUES (?, ?, ?)",
        (user_id, INITIAL_BALANCE, _now()),
    )
    return INITIAL_BALANCE


# ─── Public API ───────────────────────────────────────────────────────────────

async def get_balance(user_id: str) -> int:
    """Return the user's current credit balance."""
    async with aiosqlite.connect(DB_PATH) as db:
        return await _ensure_user(db, user_id)


async def debit_credits(
    user_id: str,
    amount: int,
    model: str = "",
    endpoint: str = "",
) -> bool:
    """
    Atomically deduct `amount` credits.
    Returns True on success, False if balance is insufficient.
    """
    async with aiosqlite.connect(DB_PATH) as db:
        balance = await _ensure_user(db, user_id)
        if balance < amount:
            return False
        now = _now()
        await db.execute(
            "UPDATE credits SET balance = balance - ?, updated_at = ? WHERE user_id = ?",
            (amount, now, user_id),
        )
        await db.execute(
            "INSERT INTO credit_ledger (user_id, delta, model, endpoint, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, -amount, model, endpoint, now),
        )
        await db.commit()
        return True


async def add_credits(
    user_id: str,
    amount: int,
    note: str = "topup",
) -> int:
    """Add `amount` credits and return the new balance."""
    async with aiosqlite.connect(DB_PATH) as db:
        await _ensure_user(db, user_id)
        now = _now()
        await db.execute(
            "UPDATE credits SET balance = balance + ?, updated_at = ? WHERE user_id = ?",
            (amount, now, user_id),
        )
        await db.execute(
            "INSERT INTO credit_ledger (user_id, delta, note, created_at) VALUES (?, ?, ?, ?)",
            (user_id, amount, note, now),
        )
        await db.commit()
        async with db.execute(
            "SELECT balance FROM credits WHERE user_id = ?", (user_id,)
        ) as cur:
            row = await cur.fetchone()
        return row[0] if row else amount


async def get_ledger(user_id: str, limit: int = 20) -> list[dict]:
    """Return the last `limit` ledger entries (newest first)."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, delta, model, endpoint, note, created_at "
            "FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?",
            (user_id, limit),
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]
