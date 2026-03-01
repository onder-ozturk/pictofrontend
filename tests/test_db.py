"""
Unit tests for backend/db.py — SQLite credit ledger.

Sprint 4 — s4-b4
Tests: init_db, get_balance, add_credits, debit_credits, get_ledger,
       negative balance protection, ledger ordering, multi-user isolation.

Uses a temporary SQLite file via pytest tmp_path so production DB is untouched.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest

pytestmark = pytest.mark.anyio


# ─── Fixture: geçici DB ───────────────────────────────────────────────────────

@pytest.fixture
async def db(tmp_path, monkeypatch):
    """Isolated aiosqlite DB for each test — never touches production file."""
    import db as _db
    db_file = str(tmp_path / "test_credits.db")
    monkeypatch.setattr(_db, "DB_PATH", db_file)
    await _db.init_db()
    return _db


# ─── init_db ─────────────────────────────────────────────────────────────────

async def test_init_db_creates_tables(db):
    """init_db çalıştıktan sonra credits ve credit_ledger tabloları mevcut olmalı."""
    import aiosqlite
    async with aiosqlite.connect(db.DB_PATH) as conn:
        async with conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ) as cur:
            tables = {row[0] for row in await cur.fetchall()}
    assert "credits" in tables
    assert "credit_ledger" in tables


async def test_init_db_idempotent(db):
    """init_db iki kez çağrılsa bile hata vermemeli."""
    await db.init_db()   # second call — should be fine


# ─── get_balance ─────────────────────────────────────────────────────────────

async def test_new_user_gets_initial_balance(db):
    balance = await db.get_balance("user-new")
    assert balance == db.INITIAL_BALANCE


async def test_same_user_balance_stable(db):
    b1 = await db.get_balance("user-stable")
    b2 = await db.get_balance("user-stable")
    assert b1 == b2 == db.INITIAL_BALANCE


async def test_different_users_independent_balances(db):
    b_alice = await db.get_balance("alice")
    b_bob   = await db.get_balance("bob")
    assert b_alice == b_bob == db.INITIAL_BALANCE


# ─── add_credits ─────────────────────────────────────────────────────────────

async def test_add_credits_returns_new_balance(db):
    await db.get_balance("user-add")
    new_bal = await db.add_credits("user-add", 50, note="topup")
    assert new_bal == db.INITIAL_BALANCE + 50


async def test_add_credits_multiple_times(db):
    uid = "user-multi-add"
    await db.get_balance(uid)
    await db.add_credits(uid, 10)
    await db.add_credits(uid, 20)
    balance = await db.get_balance(uid)
    assert balance == db.INITIAL_BALANCE + 30


async def test_add_credits_creates_ledger_entry(db):
    uid = "user-add-ledger"
    await db.get_balance(uid)
    await db.add_credits(uid, 25, note="bonus")
    ledger = await db.get_ledger(uid)
    assert any(e["delta"] == 25 and e["note"] == "bonus" for e in ledger)


# ─── debit_credits ───────────────────────────────────────────────────────────

async def test_debit_credits_success(db):
    uid = "user-debit"
    await db.get_balance(uid)
    ok = await db.debit_credits(uid, 10, model="claude", endpoint="/api/generate")
    assert ok is True
    balance = await db.get_balance(uid)
    assert balance == db.INITIAL_BALANCE - 10


async def test_debit_exact_balance(db):
    """Tam bakiye kadar debit yapılabilmeli."""
    uid = "user-exact"
    await db.get_balance(uid)
    ok = await db.debit_credits(uid, db.INITIAL_BALANCE)
    assert ok is True
    assert await db.get_balance(uid) == 0


async def test_debit_credits_insufficient_returns_false(db):
    uid = "user-broke"
    await db.get_balance(uid)
    ok = await db.debit_credits(uid, db.INITIAL_BALANCE + 1)
    assert ok is False


async def test_debit_insufficient_balance_unchanged(db):
    """Başarısız debit sonrası bakiye değişmemeli (negatif bakiye koruması)."""
    uid = "user-no-neg"
    await db.get_balance(uid)
    await db.debit_credits(uid, db.INITIAL_BALANCE + 999)
    balance = await db.get_balance(uid)
    assert balance == db.INITIAL_BALANCE


async def test_debit_zero_always_succeeds(db):
    uid = "user-zero"
    await db.get_balance(uid)
    ok = await db.debit_credits(uid, 0)
    assert ok is True


async def test_debit_creates_ledger_entry(db):
    uid = "user-debit-ledger"
    await db.get_balance(uid)
    await db.debit_credits(uid, 7, model="gpt4o", endpoint="/api/generate")
    ledger = await db.get_ledger(uid)
    assert any(e["delta"] == -7 and e["model"] == "gpt4o" for e in ledger)


# ─── get_ledger ───────────────────────────────────────────────────────────────

async def test_ledger_empty_for_new_user(db):
    uid = "user-no-tx"
    await db.get_balance(uid)  # ensure row exists; no ledger entries
    ledger = await db.get_ledger(uid)
    assert ledger == []


async def test_ledger_ordering_newest_first(db):
    uid = "user-order"
    await db.get_balance(uid)
    await db.add_credits(uid, 10, note="first")
    await db.add_credits(uid, 20, note="second")
    ledger = await db.get_ledger(uid)
    assert ledger[0]["delta"] == 20   # newest first
    assert ledger[1]["delta"] == 10


async def test_ledger_limit_param(db):
    uid = "user-limit"
    await db.get_balance(uid)
    for i in range(7):
        await db.add_credits(uid, 1, note=f"t{i}")
    ledger = await db.get_ledger(uid, limit=3)
    assert len(ledger) == 3


async def test_ledger_default_limit_20(db):
    uid = "user-limit-default"
    await db.get_balance(uid)
    for i in range(25):
        await db.add_credits(uid, 1)
    ledger = await db.get_ledger(uid)   # default limit=20
    assert len(ledger) == 20


async def test_ledger_entries_have_required_fields(db):
    uid = "user-fields"
    await db.get_balance(uid)
    await db.add_credits(uid, 5, note="check")
    ledger = await db.get_ledger(uid)
    entry = ledger[0]
    for field in ("id", "delta", "model", "endpoint", "note", "created_at"):
        assert field in entry, f"Field '{field}' missing from ledger entry"


# ─── Multi-user isolation ────────────────────────────────────────────────────

async def test_add_credits_does_not_affect_other_user(db):
    await db.get_balance("alice2")
    await db.get_balance("bob2")
    await db.add_credits("alice2", 50)
    bal_alice = await db.get_balance("alice2")
    bal_bob   = await db.get_balance("bob2")
    assert bal_alice == db.INITIAL_BALANCE + 50
    assert bal_bob   == db.INITIAL_BALANCE


async def test_debit_does_not_affect_other_user(db):
    await db.get_balance("carol")
    await db.get_balance("dave")
    await db.debit_credits("carol", 30)
    assert await db.get_balance("dave") == db.INITIAL_BALANCE
