"""
S13 — test_api_contracts.py
API contract / shape tests: every response must match the expected schema.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ── GET /health ────────────────────────────────────────────────────────────────

async def test_health_returns_200(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200


async def test_health_has_status_field(client: AsyncClient):
    r = await client.get("/health")
    body = r.json()
    assert "status" in body
    assert body["status"] == "healthy"


# ── GET /api/models ────────────────────────────────────────────────────────────

async def test_models_returns_200(client: AsyncClient):
    r = await client.get("/api/models")
    assert r.status_code == 200


async def test_models_shape(client: AsyncClient):
    body = (await client.get("/api/models")).json()
    assert "models" in body
    assert "frameworks" in body
    assert isinstance(body["models"], list)
    assert len(body["models"]) > 0


async def test_model_fields(client: AsyncClient):
    """Every model entry must include the required fields."""
    models = (await client.get("/api/models")).json()["models"]
    required = {"id", "name", "description", "credits", "provider"}
    for m in models:
        missing = required - set(m.keys())
        assert not missing, f"Model {m.get('id')} missing fields: {missing}"


async def test_framework_fields(client: AsyncClient):
    frameworks = (await client.get("/api/models")).json()["frameworks"]
    for fw in frameworks:
        assert "id" in fw
        assert "name" in fw


# ── Error response contract (S3) ──────────────────────────────────────────────

async def test_error_response_has_type_code_message(client: AsyncClient):
    """All 4xx errors must return {type, code, message}."""
    # trigger a 422 by sending an invalid model
    from conftest import png_file
    data, fname, ctype = png_file()
    r = await client.post(
        "/api/generate",
        files={"image": (fname, data, ctype)},
        data={"api_key": "sk-test", "model": "nonexistent_model", "framework": "html"},
    )
    assert r.status_code in (400, 422)
    body = r.json()
    assert body.get("type") == "error", f"Expected type=error, got: {body}"
    assert "code" in body, f"Missing 'code' in error response: {body}"
    assert "message" in body, f"Missing 'message' in error response: {body}"


async def test_rate_limit_returns_429(client: AsyncClient):
    """After RATE_LIMIT_REQUESTS+1 calls the middleware must respond 429."""
    from models import RATE_LIMIT_REQUESTS
    from conftest import png_file

    data, fname, ctype = png_file()

    # Hit /api/models (cheap, no AI call) enough times to trip the limiter.
    # We patch the IP by faking the ASGI scope — easier: just call /api/models.
    for _ in range(RATE_LIMIT_REQUESTS + 1):
        r = await client.get("/api/models")

    # At this point the limiter should have kicked in
    assert r.status_code == 429
    body = r.json()
    assert body.get("type") == "error"
    assert body.get("code") == "RATE_LIMITED"
