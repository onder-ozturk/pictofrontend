"""
Sprint 2 integration tests — S1/S2/S3/S4/S11
Tests: /api/generate/from-url, /api/generate/from-text, session_id, URL security.
All tests are anyio-async and use the shared conftest fixtures.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ─── /api/generate/from-text ─────────────────────────────────────────────────

async def test_from_text_missing_api_key(client: AsyncClient):
    """Empty api_key must be rejected with INVALID_API_KEY."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "",
        "description": "A simple login form with email and password fields",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 422)
    body = r.json()
    assert body.get("type") == "error"
    assert body.get("code") == "INVALID_API_KEY"


async def test_from_text_description_too_short(client: AsyncClient):
    """Description < 10 chars must be rejected by Pydantic (422)."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-test-key",
        "description": "Short",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code == 422


async def test_from_text_invalid_model(client: AsyncClient):
    """Unknown model must return INVALID_MODEL."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-test-key",
        "description": "A dashboard with charts and tables showing sales data",
        "model": "llama-999",
        "framework": "html",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_MODEL"


async def test_from_text_invalid_framework(client: AsyncClient):
    """Unknown framework must return INVALID_FRAMEWORK."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-test-key",
        "description": "A dashboard with charts and tables showing sales data",
        "model": "claude",
        "framework": "angular",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_FRAMEWORK"


async def test_from_text_valid_request_passes_validation(client: AsyncClient):
    """
    A valid request should pass all validation and reach the AI layer.
    Without a real API key it may fail at the provider, but NOT at validation.
    """
    validation_codes = {"INVALID_API_KEY", "INVALID_MODEL", "INVALID_FRAMEWORK", "INVALID_URL"}
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-ant-api03-test",
        "description": "A modern landing page with hero section, features, and pricing",
        "model": "claude",
        "framework": "html",
    })
    if r.status_code in (400, 422):
        assert r.json().get("code") not in validation_codes, (
            f"Validation should have passed but got: {r.json()}"
        )


@pytest.mark.parametrize("framework", ["html", "react", "vue", "bootstrap"])
async def test_from_text_accepts_all_frameworks(client: AsyncClient, framework: str):
    """All four frameworks must pass validation for from-text."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-ant-api03-test",
        "description": "A simple contact form with name, email, and message fields",
        "model": "claude",
        "framework": framework,
    })
    # Should NOT be rejected by framework validation
    if r.status_code in (400, 422):
        assert r.json().get("code") != "INVALID_FRAMEWORK", (
            f"Framework '{framework}' should be accepted"
        )


# ─── /api/generate/from-url ──────────────────────────────────────────────────

async def test_from_url_missing_api_key(client: AsyncClient):
    """Empty api_key on from-url must return INVALID_API_KEY."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "",
        "url": "https://example.com",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_API_KEY"


async def test_from_url_localhost_blocked(client: AsyncClient):
    """localhost URL must be blocked by the URL security filter (S11)."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "sk-test-key",
        "url": "http://localhost:8080/admin",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 403)
    assert r.json().get("code") in ("URL_BLOCKED", "INVALID_URL")


async def test_from_url_private_ip_blocked(client: AsyncClient):
    """Private IP addresses must be blocked by the URL security filter (S11)."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "sk-test-key",
        "url": "http://192.168.1.100/secret",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 403)
    assert r.json().get("code") in ("URL_BLOCKED", "INVALID_URL")


async def test_from_url_loopback_blocked(client: AsyncClient):
    """127.0.0.1 must be blocked (SSRF prevention)."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "sk-test-key",
        "url": "http://127.0.0.1/etc/passwd",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 403)
    assert r.json().get("code") in ("URL_BLOCKED", "INVALID_URL")


async def test_from_url_aws_metadata_blocked(client: AsyncClient):
    """AWS metadata endpoint must be blocked (SSRF prevention)."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "sk-test-key",
        "url": "http://169.254.169.254/latest/meta-data/",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 403)
    assert r.json().get("code") in ("URL_BLOCKED", "INVALID_URL")


async def test_from_url_empty_url_rejected(client: AsyncClient):
    """Empty URL string must be rejected."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "sk-test-key",
        "url": "",
        "model": "claude",
        "framework": "html",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") in ("INVALID_URL", "INVALID_API_KEY") or r.status_code == 422


async def test_from_url_invalid_model(client: AsyncClient):
    """Unknown model on from-url must return INVALID_MODEL."""
    r = await client.post("/api/generate/from-url", json={
        "api_key": "sk-test-key",
        "url": "https://example.com",
        "model": "gpt99",
        "framework": "html",
    })
    assert r.status_code in (400, 422)
    assert r.json().get("code") == "INVALID_MODEL"


# ─── Session ID (S4) ──────────────────────────────────────────────────────────

async def test_session_id_returned_in_stream(client: AsyncClient):
    """
    When a valid request reaches the streaming layer, [SESSION_ID] must be
    embedded in the response tail (if the provider responds at all).
    Since we don't have a live API key, we just verify the session wrapper
    is wired up by checking the endpoint accepts session_id without 4xx.
    """
    from conftest import TINY_PNG
    r = await client.post(
        "/api/generate",
        files={"image": ("test.png", TINY_PNG, "image/png")},
        data={
            "api_key": "sk-ant-api03-testsession",
            "model": "claude",
            "framework": "html",
            "session_id": "test-session-abc123",
        },
    )
    # Not rejected by validation — session_id field accepted
    validation_codes = {"INVALID_MIME", "FILE_TOO_LARGE", "INVALID_MODEL",
                        "INVALID_FRAMEWORK", "INVALID_API_KEY"}
    if r.status_code in (400, 422):
        assert r.json().get("code") not in validation_codes, (
            f"session_id parameter caused unexpected validation error: {r.json()}"
        )


async def test_from_text_accepts_session_id(client: AsyncClient):
    """session_id field accepted by from-text endpoint without validation error."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-ant-api03-testsession",
        "description": "A simple to-do list with add and delete functionality",
        "model": "claude",
        "framework": "html",
        "session_id": "existing-session-xyz",
    })
    validation_codes = {"INVALID_API_KEY", "INVALID_MODEL", "INVALID_FRAMEWORK"}
    if r.status_code in (400, 422):
        assert r.json().get("code") not in validation_codes


# ─── /api/models now includes new models and bootstrap ───────────────────────

async def test_models_endpoint_has_new_models(client: AsyncClient):
    """Sprint 2 models (claude-opus, claude-haiku, gpt4-turbo, gemini-pro) must be present."""
    r = await client.get("/api/models")
    assert r.status_code == 200
    model_ids = {m["id"] for m in r.json()["models"]}
    for expected in ["claude-opus", "claude-haiku", "gpt4-turbo", "gemini-pro"]:
        assert expected in model_ids, f"Model '{expected}' missing from /api/models"


async def test_models_endpoint_has_bootstrap_framework(client: AsyncClient):
    """Bootstrap framework must appear in /api/models frameworks list."""
    r = await client.get("/api/models")
    assert r.status_code == 200
    framework_ids = {f["id"] for f in r.json()["frameworks"]}
    assert "bootstrap" in framework_ids, "Bootstrap framework missing from /api/models"


async def test_all_sprint2_models_have_required_fields(client: AsyncClient):
    """Every model in /api/models must have id, name, description, credits, provider."""
    r = await client.get("/api/models")
    for model in r.json()["models"]:
        for field in ("id", "name", "description", "credits", "provider"):
            assert field in model, f"Model {model.get('id')} missing field '{field}'"


# ─── Yeni framework testleri: svelte + alpine ─────────────────────────────────

async def test_from_text_svelte_framework_passes_validation(client: AsyncClient):
    """svelte geçerli framework — validasyon geçmeli, INVALID_FRAMEWORK dönmemeli."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-test-dummy",
        "description": "A responsive navigation bar with logo, links, and mobile hamburger",
        "model": "claude",
        "framework": "svelte",
    })
    if r.status_code in (400, 422):
        assert r.json().get("code") != "INVALID_FRAMEWORK", "svelte rejected as invalid framework"


async def test_from_text_alpine_framework_passes_validation(client: AsyncClient):
    """alpine geçerli framework — validasyon geçmeli, INVALID_FRAMEWORK dönmemeli."""
    r = await client.post("/api/generate/from-text", json={
        "api_key": "sk-test-dummy",
        "description": "A responsive navigation bar with logo, links, and mobile hamburger",
        "model": "claude",
        "framework": "alpine",
    })
    if r.status_code in (400, 422):
        assert r.json().get("code") != "INVALID_FRAMEWORK", "alpine rejected as invalid framework"


async def test_models_endpoint_includes_svelte_framework(client: AsyncClient):
    """GET /api/models dönüşünde svelte framework mevcut olmalı."""
    r = await client.get("/api/models")
    assert r.status_code == 200
    framework_ids = {f["id"] for f in r.json()["frameworks"]}
    assert "svelte" in framework_ids


async def test_models_endpoint_includes_alpine_framework(client: AsyncClient):
    """GET /api/models dönüşünde alpine framework mevcut olmalı."""
    r = await client.get("/api/models")
    assert r.status_code == 200
    framework_ids = {f["id"] for f in r.json()["frameworks"]}
    assert "alpine" in framework_ids


# ─── Rate limit testi ─────────────────────────────────────────────────────────

async def test_rate_limit_triggered_after_limit_requests(client: AsyncClient):
    """RATE_LIMIT_REQUESTS kadar istek sonrası bir sonraki 429 RATE_LIMITED döndürmeli."""
    from models import RATE_LIMIT_REQUESTS
    for _ in range(RATE_LIMIT_REQUESTS):
        await client.get("/api/models")
    r = await client.get("/api/models")
    assert r.status_code == 429
    assert r.json().get("code") == "RATE_LIMITED"


# ─── Session max turns testi ──────────────────────────────────────────────────

def test_session_max_turns_trims_old_messages():
    """SESSION_MAX_TURNS aşıldığında eski mesajlar kırpılmalı, yeniler korunmalı."""
    import main as backend
    from models import SESSION_MAX_TURNS
    sid = "test-trim-session-unique"
    messages = []
    total_pairs = SESSION_MAX_TURNS + 5   # limit üstünde
    for i in range(total_pairs):
        messages.append({"role": "user",      "content": f"u{i}"})
        messages.append({"role": "assistant", "content": f"a{i}"})
    backend._save_session(sid, messages)
    stored = backend._get_session(sid)
    # Maksimum SESSION_MAX_TURNS * 2 mesaj saklanmalı
    assert len(stored) <= SESSION_MAX_TURNS * 2
    # En yeni mesajlar korunmalı
    assert stored[-1]["content"] == f"a{total_pairs - 1}"
    assert stored[-2]["content"] == f"u{total_pairs - 1}"


def test_session_empty_for_unknown_id():
    """Bilinmeyen session_id için boş liste dönmeli."""
    import main as backend
    stored = backend._get_session("nonexistent-session-id-xyz")
    assert stored == []
