"""
S13 + S14 — test_validation.py
Upload validation tests: MIME, size, model, framework, API-key presence.
Covers the 5 critical e2e scenarios from the Sprint 1 acceptance criteria.
"""

import pytest
from httpx import AsyncClient

from conftest import png_file, TINY_PNG
from models import MAX_FILE_SIZE

pytestmark = pytest.mark.anyio


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _post(client: AsyncClient, *, image_data=None, content_type="image/png",
                api_key="sk-test-key", model="claude", framework="html"):
    """Helper to POST /api/generate with overridable fields."""
    if image_data is None:
        image_data = TINY_PNG
    return await client.post(
        "/api/generate",
        files={"image": ("test.png", image_data, content_type)},
        data={"api_key": api_key, "model": model, "framework": framework},
    )


# ─── Scenario 1: Empty / missing required fields ──────────────────────────────

async def test_missing_api_key_rejected(client: AsyncClient):
    """S14 Scenario 1 — empty api_key must be rejected."""
    r = await _post(client, api_key="")
    assert r.status_code in (400, 422), f"Expected 4xx, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("type") == "error"
    assert body.get("code") == "INVALID_API_KEY"


async def test_whitespace_only_api_key_rejected(client: AsyncClient):
    r = await _post(client, api_key="   ")
    assert r.status_code in (400, 422)
    body = r.json()
    assert body.get("code") == "INVALID_API_KEY"


# ─── Scenario 2: Invalid file type ───────────────────────────────────────────

async def test_pdf_file_rejected(client: AsyncClient):
    """S14 Scenario 2 — non-image MIME type must be rejected."""
    r = await _post(client, content_type="application/pdf")
    assert r.status_code == 400
    body = r.json()
    assert body.get("type") == "error"
    assert body.get("code") == "INVALID_MIME"


async def test_text_file_rejected(client: AsyncClient):
    r = await _post(client, content_type="text/plain")
    assert r.status_code == 400
    assert r.json().get("code") == "INVALID_MIME"


async def test_svg_rejected(client: AsyncClient):
    r = await _post(client, content_type="image/svg+xml")
    assert r.status_code == 400
    assert r.json().get("code") == "INVALID_MIME"


# ─── Scenario 3: Invalid / unsupported model ──────────────────────────────────

async def test_unknown_model_rejected(client: AsyncClient):
    """S14 Scenario 3 — unknown model name must return 422 INVALID_MODEL."""
    r = await _post(client, model="gpt5-turbo-ultra")
    assert r.status_code in (400, 422)
    body = r.json()
    assert body.get("type") == "error"
    assert body.get("code") == "INVALID_MODEL"


async def test_empty_model_falls_back_to_default(client: AsyncClient):
    """FastAPI File(default='claude') treats model='' as missing → falls back to 'claude'.
    The request is NOT rejected at validation; it proceeds to the AI layer."""
    r = await _post(client, model="")
    # Not a validation error — may be 200 (streaming) or an upstream auth error
    assert r.status_code != 422
    if r.status_code in (400,):
        body = r.json()
        assert body.get("code") != "INVALID_MODEL", (
            "Empty model should fall back to default 'claude', not be rejected"
        )


async def test_invalid_framework_rejected(client: AsyncClient):
    """Sending an unsupported framework must return INVALID_FRAMEWORK."""
    r = await _post(client, framework="angular")
    assert r.status_code in (400, 422)
    body = r.json()
    assert body.get("code") == "INVALID_FRAMEWORK"


# ─── File size validation (S4) ────────────────────────────────────────────────

async def test_file_too_large_rejected(client: AsyncClient):
    """S14 Scenario — file over 20 MB must be rejected."""
    oversized = b"\x89PNG" + b"\x00" * (MAX_FILE_SIZE + 1)
    r = await _post(client, image_data=oversized)
    assert r.status_code == 400
    body = r.json()
    assert body.get("code") == "FILE_TOO_LARGE"


async def test_file_exactly_at_limit_passes_size_check(client: AsyncClient):
    """File exactly at 20 MB boundary should pass size validation (may fail on AI call)."""
    at_limit = TINY_PNG + b"\x00" * (MAX_FILE_SIZE - len(TINY_PNG))
    r = await _post(client, image_data=at_limit)
    # Should NOT be rejected for size — other errors (API key) are fine
    assert r.status_code != 400 or r.json().get("code") != "FILE_TOO_LARGE"


# ─── Scenario 4: Valid inputs reach the streaming layer ───────────────────────

async def test_valid_inputs_accepted(client: AsyncClient):
    """
    S14 Scenario 4 — a proper request with a real-looking key should be
    accepted (reach the AI layer). We don't have a live API key in CI,
    so we just verify it's NOT rejected by validation (4xx validation codes).
    """
    r = await _post(client, api_key="sk-ant-api03-test", model="claude", framework="html")
    # Validation passed — any non-validation error is acceptable
    validation_codes = {"INVALID_MIME", "FILE_TOO_LARGE", "INVALID_MODEL",
                        "INVALID_FRAMEWORK", "INVALID_API_KEY"}
    if r.status_code in (400, 422):
        body = r.json()
        assert body.get("code") not in validation_codes, (
            f"Request was rejected at validation: {body}"
        )


# ─── Scenario 5: Allowed MIME types ──────────────────────────────────────────

@pytest.mark.parametrize("mime", ["image/png", "image/jpeg", "image/webp"])
async def test_allowed_mime_types_pass_validation(client: AsyncClient, mime: str):
    """S14 Scenario 5 — PNG / JPEG / WEBP all pass MIME validation."""
    r = await _post(client, content_type=mime)
    if r.status_code in (400, 422):
        assert r.json().get("code") != "INVALID_MIME", (
            f"MIME type {mime} should be allowed but was rejected"
        )


# ─── Error body contract ──────────────────────────────────────────────────────

async def test_all_validation_errors_have_message(client: AsyncClient):
    """Every validation error must include a non-empty 'message' string."""
    cases = [
        dict(content_type="application/pdf"),
        dict(model="bad-model"),
        dict(api_key=""),
        dict(framework="svelte"),
    ]
    for kwargs in cases:
        r = await _post(client, **kwargs)
        if r.status_code in (400, 422):
            body = r.json()
            assert isinstance(body.get("message"), str) and body["message"], (
                f"Empty or missing message in error for {kwargs}: {body}"
            )
