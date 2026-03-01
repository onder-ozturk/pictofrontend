"""
Sprint 4 tests — s4-b2 / s4-b3 / s4-b4 / s4-g1

Coverage:
  - Extended thinking model config (s4-b2)
  - JWT auth: register / login / token decode (s4-b3)
  - JWT middleware: 401 on missing/invalid token (s4-g1)
  - Persistent credit system: balance, debit, add, ledger (s4-b4)
  - Auth API endpoints via HTTPX (s4-b3)
  - Credit API endpoints via HTTPX (s4-b4)
"""

import os
import sys
import uuid
import asyncio
import pytest

# ── Make backend importable ─────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

pytestmark = pytest.mark.anyio


# ═══════════════════════════════════════════════════════════════════════════════
# s4-b2 — Extended thinking model config
# ═══════════════════════════════════════════════════════════════════════════════

def test_thinking_model_exists_in_model_options():
    from models import MODEL_OPTIONS
    assert "claude-sonnet-thinking" in MODEL_OPTIONS


def test_thinking_model_has_thinking_flag():
    from models import MODEL_OPTIONS
    m = MODEL_OPTIONS["claude-sonnet-thinking"]
    assert m.has_thinking is True


def test_thinking_model_has_budget():
    from models import MODEL_OPTIONS
    m = MODEL_OPTIONS["claude-sonnet-thinking"]
    assert m.thinking_budget > 0


def test_regular_models_dont_have_thinking():
    from models import MODEL_OPTIONS
    for mid, info in MODEL_OPTIONS.items():
        if mid != "claude-sonnet-thinking":
            assert info.has_thinking is False, f"{mid} should not have thinking"


def test_thinking_model_api_id_mapping():
    """Thinking model must map to claude-3-7-sonnet to get real extended thinking."""
    import main  # noqa: F401 — triggers the mapping
    from main import _model_api_id
    api_id = _model_api_id("claude-sonnet-thinking")
    assert "3-7" in api_id or "3.7" in api_id.replace("-", ".")


# ═══════════════════════════════════════════════════════════════════════════════
# s4-b3 — JWT utilities
# ═══════════════════════════════════════════════════════════════════════════════

def test_create_and_decode_token():
    from auth import create_access_token, decode_access_token
    uid = str(uuid.uuid4())
    email = "test@example.com"
    token = create_access_token(uid, email)
    payload = decode_access_token(token)
    assert payload["sub"] == uid
    assert payload["email"] == email


def test_invalid_token_raises():
    from jose import JWTError
    from auth import decode_access_token
    with pytest.raises(JWTError):
        decode_access_token("not-a-valid-token")


def test_register_user():
    from auth import register_user, get_user_by_id
    email = f"reg_{uuid.uuid4().hex[:8]}@test.com"
    user = register_user(email, "password123")
    assert user.email == email
    assert user.id
    fetched = get_user_by_id(user.id)
    assert fetched is not None
    assert fetched.email == email


def test_register_duplicate_email_raises():
    from auth import register_user
    email = f"dup_{uuid.uuid4().hex[:8]}@test.com"
    register_user(email, "password123")
    with pytest.raises(ValueError, match="already registered"):
        register_user(email, "different_password")


def test_authenticate_user_valid():
    from auth import register_user, authenticate_user
    email = f"auth_{uuid.uuid4().hex[:8]}@test.com"
    register_user(email, "securePass1")
    result = authenticate_user(email, "securePass1")
    assert result is not None
    assert result.email == email


def test_authenticate_user_wrong_password():
    from auth import register_user, authenticate_user
    email = f"authfail_{uuid.uuid4().hex[:8]}@test.com"
    register_user(email, "correctPass1")
    result = authenticate_user(email, "wrongPass")
    assert result is None


def test_authenticate_user_unknown_email():
    from auth import authenticate_user
    result = authenticate_user("nobody@nowhere.com", "whatever")
    assert result is None


def test_hash_and_verify_password():
    from auth import hash_password, verify_password
    plain = "MyS3cretP@ss"
    hashed = hash_password(plain)
    assert verify_password(plain, hashed)
    assert not verify_password("wrongpass", hashed)


# ═══════════════════════════════════════════════════════════════════════════════
# s4-b4 — Persistent credit system (SQLite via aiosqlite)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """Point DB_PATH at a temp file for test isolation."""
    db_file = str(tmp_path / "test.db")
    monkeypatch.setenv("DB_PATH", db_file)
    # Reload db module so it picks up the new env var
    import importlib
    import db as db_module
    db_module.DB_PATH = db_file
    return db_module


async def test_initial_balance(tmp_db):
    await tmp_db.init_db()
    uid = str(uuid.uuid4())
    balance = await tmp_db.get_balance(uid)
    assert balance == tmp_db.INITIAL_BALANCE


async def test_debit_credits_success(tmp_db):
    await tmp_db.init_db()
    uid = str(uuid.uuid4())
    await tmp_db.get_balance(uid)  # seed row
    ok = await tmp_db.debit_credits(uid, 10, model="claude", endpoint="/api/generate")
    assert ok is True
    balance = await tmp_db.get_balance(uid)
    assert balance == tmp_db.INITIAL_BALANCE - 10


async def test_debit_credits_insufficient(tmp_db):
    await tmp_db.init_db()
    uid = str(uuid.uuid4())
    await tmp_db.get_balance(uid)  # seed with INITIAL_BALANCE
    ok = await tmp_db.debit_credits(uid, tmp_db.INITIAL_BALANCE + 1)
    assert ok is False
    # Balance unchanged
    balance = await tmp_db.get_balance(uid)
    assert balance == tmp_db.INITIAL_BALANCE


async def test_add_credits(tmp_db):
    await tmp_db.init_db()
    uid = str(uuid.uuid4())
    await tmp_db.get_balance(uid)
    new_balance = await tmp_db.add_credits(uid, 50, note="topup")
    assert new_balance == tmp_db.INITIAL_BALANCE + 50


async def test_ledger_records_transactions(tmp_db):
    await tmp_db.init_db()
    uid = str(uuid.uuid4())
    await tmp_db.get_balance(uid)
    await tmp_db.debit_credits(uid, 5, model="claude")
    await tmp_db.add_credits(uid, 20, note="promo")

    ledger = await tmp_db.get_ledger(uid)
    assert len(ledger) == 2
    # Newest first
    assert ledger[0]["delta"] == 20
    assert ledger[1]["delta"] == -5


async def test_ledger_limit(tmp_db):
    await tmp_db.init_db()
    uid = str(uuid.uuid4())
    await tmp_db.get_balance(uid)
    for _ in range(5):
        await tmp_db.add_credits(uid, 1)

    ledger = await tmp_db.get_ledger(uid, limit=3)
    assert len(ledger) == 3


# ═══════════════════════════════════════════════════════════════════════════════
# s4-b3 / s4-g1 — Auth API endpoints (HTTPX)
# ═══════════════════════════════════════════════════════════════════════════════

@pytest.fixture
async def client(tmp_db):
    """Async HTTPX client against the FastAPI app with a fresh DB."""
    import db as db_module
    await db_module.init_db()

    from httpx import AsyncClient, ASGITransport
    import main
    async with AsyncClient(
        transport=ASGITransport(app=main.app),
        base_url="http://test",
    ) as c:
        yield c


async def test_register_endpoint(client):
    email = f"ep_{uuid.uuid4().hex[:8]}@test.com"
    r = await client.post("/api/auth/register", json={"email": email, "password": "strongPass1"})
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert data["email"] == email


async def test_register_duplicate_returns_409(client):
    email = f"dup_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/auth/register", json={"email": email, "password": "strongPass1"})
    r = await client.post("/api/auth/register", json={"email": email, "password": "strongPass1"})
    assert r.status_code == 409


async def test_login_endpoint(client):
    email = f"login_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/auth/register", json={"email": email, "password": "loginPass1"})
    r = await client.post("/api/auth/login", json={"email": email, "password": "loginPass1"})
    assert r.status_code == 200
    assert "access_token" in r.json()


async def test_login_wrong_password_returns_401(client):
    email = f"lw_{uuid.uuid4().hex[:8]}@test.com"
    await client.post("/api/auth/register", json={"email": email, "password": "correctPass1"})
    r = await client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert r.status_code == 401


async def test_me_endpoint_authenticated(client):
    email = f"me_{uuid.uuid4().hex[:8]}@test.com"
    reg = await client.post("/api/auth/register", json={"email": email, "password": "mePass1234"})
    token = reg.json()["access_token"]
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == email
    assert "balance" in r.json()


async def test_me_endpoint_unauthenticated_returns_401(client):
    r = await client.get("/api/auth/me")
    assert r.status_code == 401


async def test_credits_balance_endpoint(client):
    email = f"bal_{uuid.uuid4().hex[:8]}@test.com"
    reg = await client.post("/api/auth/register", json={"email": email, "password": "balPass123"})
    token = reg.json()["access_token"]
    r = await client.get("/api/credits/balance", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["balance"] == 100  # INITIAL_BALANCE


async def test_credits_topup_endpoint(client):
    email = f"top_{uuid.uuid4().hex[:8]}@test.com"
    reg = await client.post("/api/auth/register", json={"email": email, "password": "topPass123"})
    token = reg.json()["access_token"]
    r = await client.post(
        "/api/credits/topup",
        json=50,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    assert r.status_code == 200
    assert r.json()["balance"] == 150  # 100 initial + 50


async def test_credits_history_endpoint(client):
    email = f"hist_{uuid.uuid4().hex[:8]}@test.com"
    reg = await client.post("/api/auth/register", json={"email": email, "password": "histPass12"})
    token = reg.json()["access_token"]
    await client.post(
        "/api/credits/topup",
        json=25,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    r = await client.get("/api/credits/history", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    txns = r.json()["transactions"]
    assert len(txns) >= 1
    assert txns[0]["delta"] == 25


# ─── A/B Compare endpoint (s4-q1) ────────────────────────────────────────────

async def test_compare_missing_api_key(client):
    """Boş api_key → INVALID_API_KEY 400."""
    r = await client.post("/api/compare", json={
        "api_key": "",
        "model_a": "claude",
        "model_b": "gpt4o",
        "framework": "html",
        "text_prompt": "A simple login form",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_API_KEY"


async def test_compare_unknown_model_a(client):
    """Bilinmeyen model_a → INVALID_MODEL 422."""
    r = await client.post("/api/compare", json={
        "api_key": "sk-test-key",
        "model_a": "llama-99999",
        "model_b": "gpt4o",
        "framework": "html",
        "text_prompt": "A simple login form",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_MODEL"


async def test_compare_unknown_model_b(client):
    """Bilinmeyen model_b → INVALID_MODEL 422."""
    r = await client.post("/api/compare", json={
        "api_key": "sk-test-key",
        "model_a": "claude",
        "model_b": "fake-model-xyz",
        "framework": "html",
        "text_prompt": "A simple login form",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_MODEL"


async def test_compare_invalid_framework(client):
    """Bilinmeyen framework → INVALID_FRAMEWORK 422."""
    r = await client.post("/api/compare", json={
        "api_key": "sk-test-key",
        "model_a": "claude",
        "model_b": "gpt4o",
        "framework": "angular",
        "text_prompt": "A simple login form",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_FRAMEWORK"


async def test_compare_missing_image_and_text(client):
    """image_b64 ve text_prompt her ikisi de yoksa 422 dönmeli."""
    r = await client.post("/api/compare", json={
        "api_key": "sk-test-key",
        "model_a": "claude",
        "model_b": "gpt4o",
        "framework": "html",
    })
    assert r.status_code == 422


async def test_compare_valid_request_passes_validation(client):
    """Geçerli istek validasyon katmanını geçmeli (200 veya AI hatası, NOT validation error)."""
    validation_codes = {"INVALID_API_KEY", "INVALID_MODEL", "INVALID_FRAMEWORK"}
    r = await client.post("/api/compare", json={
        "api_key": "sk-test-dummy",
        "model_a": "claude",
        "model_b": "gpt4o",
        "framework": "html",
        "text_prompt": "A simple dashboard with charts and data tables",
    })
    if r.status_code in (400, 422):
        assert r.json().get("code") not in validation_codes, (
            f"Valid compare request rejected: {r.json()}"
        )


# ─── Yeni model yapılandırmaları (Claude 4.x / DeepSeek / Qwen / Kimi) ───────

def test_new_claude4_models_in_model_options():
    from models import MODEL_OPTIONS
    for mid in ("claude-sonnet-4-5", "claude-sonnet-4-6", "claude-opus-4-5", "claude-opus-4-6"):
        assert mid in MODEL_OPTIONS, f"{mid} MODEL_OPTIONS'da bulunamadı"


def test_deepseek_models_in_model_options():
    from models import MODEL_OPTIONS
    assert "deepseek"    in MODEL_OPTIONS
    assert "deepseek-r1" in MODEL_OPTIONS


def test_compat_provider_models_have_correct_provider():
    from models import MODEL_OPTIONS
    assert MODEL_OPTIONS["deepseek"].provider    == "DeepSeek"
    assert MODEL_OPTIONS["deepseek-r1"].provider == "DeepSeek"
    assert MODEL_OPTIONS["qwen-vl"].provider     == "Alibaba"
    assert MODEL_OPTIONS["kimi"].provider        == "Moonshot"


def test_text_only_models_have_supports_vision_false():
    from models import MODEL_OPTIONS
    for mid in ("o3-mini", "deepseek-r1", "kimi"):
        assert not MODEL_OPTIONS[mid].supports_vision, (
            f"{mid} supports_vision=True olmalı değil"
        )


def test_vision_models_have_supports_vision_true():
    from models import MODEL_OPTIONS
    for mid in ("claude", "gpt4o", "gemini", "deepseek", "qwen-vl"):
        assert MODEL_OPTIONS[mid].supports_vision, (
            f"{mid} supports_vision=False olmalı değil"
        )


def test_compat_base_urls_defined():
    """DeepSeek, Alibaba, Moonshot için base URL tanımlı olmalı."""
    from main import _COMPAT_BASE_URLS
    assert "DeepSeek" in _COMPAT_BASE_URLS
    assert "Alibaba"  in _COMPAT_BASE_URLS
    assert "Moonshot" in _COMPAT_BASE_URLS
    for url in _COMPAT_BASE_URLS.values():
        assert url.startswith("https://"), f"Base URL HTTPS değil: {url}"
