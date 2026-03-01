"""
Sprint 3 integration tests — S3/S4/S9/S12
Tests: postprocessing, metrics endpoint, session version history, security hardening.
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


# ─── Postprocess unit tests (S3) ─────────────────────────────────────────────

def test_strip_plain_fence():
    from postprocess import strip_code_fences
    raw = "```html\n<!DOCTYPE html>\n<html></html>\n```"
    assert strip_code_fences(raw) == "<!DOCTYPE html>\n<html></html>"


def test_strip_fence_no_language():
    from postprocess import strip_code_fences
    raw = "```\n<!DOCTYPE html>\n<html></html>\n```"
    assert strip_code_fences(raw) == "<!DOCTYPE html>\n<html></html>"


def test_no_fence_unchanged():
    from postprocess import strip_code_fences
    raw = "<!DOCTYPE html>\n<html></html>"
    assert strip_code_fences(raw) == raw


def test_normalize_crlf():
    from postprocess import strip_code_fences
    raw = "```html\r\n<!DOCTYPE html>\r\n<html></html>\r\n```"
    result = strip_code_fences(raw)
    assert "\r" not in result
    assert "<!DOCTYPE html>" in result


def test_fence_stripper_streaming():
    """FenceStripper must handle fence detection across chunks."""
    from postprocess import FenceStripper
    chunks = ["```html\n<!DO", "CTYPE html>\n<html>", "</html>\n```"]
    stripper = FenceStripper()
    output = ""
    for c in chunks:
        output += stripper.feed(c)
    output += stripper.flush()
    assert "<!DOCTYPE html>" in output
    assert "```" not in output


def test_fence_stripper_no_fence():
    """FenceStripper must pass through code without fences unchanged."""
    from postprocess import FenceStripper
    code = "<!DOCTYPE html>\n<html><body>Hello</body></html>"
    stripper = FenceStripper()
    out = stripper.feed(code)
    out += stripper.flush()
    assert "<!DOCTYPE html>" in out
    assert "Hello" in out


def test_normalize_code_strips_preamble():
    """normalize_code should remove explanation text before <!DOCTYPE html>."""
    from postprocess import normalize_code
    raw = "Here is the generated code:\n\n<!DOCTYPE html>\n<html></html>"
    result = normalize_code(raw)
    assert result.startswith("<!DOCTYPE html>")
    assert "Here is" not in result


# ─── Metrics endpoint (S9) ───────────────────────────────────────────────────

async def test_metrics_endpoint_exists(client: AsyncClient):
    """GET /api/metrics must return 200 with required fields."""
    r = await client.get("/api/metrics")
    assert r.status_code == 200


async def test_metrics_has_required_fields(client: AsyncClient):
    """Metrics response must contain uptime, requests_total, errors_total, error_rate."""
    r = await client.get("/api/metrics")
    body = r.json()
    for field in ("uptime_s", "requests_total", "errors_total", "error_rate", "endpoints"):
        assert field in body, f"Missing field '{field}' in /api/metrics"


async def test_metrics_increments_on_request(client: AsyncClient):
    """Making requests should increment the request counter."""
    r0 = await client.get("/api/metrics")
    before = r0.json()["requests_total"]

    await client.get("/health")
    await client.get("/health")

    r1 = await client.get("/api/metrics")
    after = r1.json()["requests_total"]
    # At minimum the 2 health + 2 metrics calls themselves
    assert after > before


async def test_metrics_error_rate_type(client: AsyncClient):
    """error_rate must be a float between 0 and 1."""
    r = await client.get("/api/metrics")
    rate = r.json()["error_rate"]
    assert isinstance(rate, (int, float))
    assert 0 <= rate <= 1


# ─── Session version history (S4) ────────────────────────────────────────────

async def test_versions_endpoint_exists(client: AsyncClient):
    """GET /api/sessions/{id}/versions must return 200."""
    r = await client.get("/api/sessions/nonexistent-session/versions")
    assert r.status_code == 200


async def test_versions_empty_for_unknown_session(client: AsyncClient):
    """A session with no versions should return count=0 and empty list."""
    r = await client.get("/api/sessions/unknown-xyz-123/versions")
    body = r.json()
    assert body["count"] == 0
    assert body["versions"] == []


async def test_versions_response_shape(client: AsyncClient):
    """Version response must have session_id, count, versions fields."""
    r = await client.get("/api/sessions/test-session/versions")
    body = r.json()
    assert "session_id" in body
    assert "count" in body
    assert "versions" in body
    assert isinstance(body["versions"], list)


async def test_versions_internal_add_and_retrieve():
    """Unit test: _add_version and _get_versions work correctly."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    from main import _add_version, _get_versions, _session_versions

    sid = "test-version-unit-abc"
    _session_versions.pop(sid, None)  # clean slate

    _add_version(sid, "<html>v1</html>")
    _add_version(sid, "<html>v2</html>")
    _add_version(sid, "<html>v3</html>")

    versions = _get_versions(sid)
    assert len(versions) == 3
    assert versions[0] == "<html>v1</html>"
    assert versions[-1] == "<html>v3</html>"


async def test_versions_max_5():
    """Version history must keep at most 5 entries (oldest dropped)."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
    from main import _add_version, _get_versions, _session_versions

    sid = "test-version-max-abc"
    _session_versions.pop(sid, None)

    for i in range(7):
        _add_version(sid, f"<html>v{i}</html>")

    versions = _get_versions(sid)
    assert len(versions) == 5
    assert versions[0] == "<html>v2</html>"  # oldest kept
    assert versions[-1] == "<html>v6</html>"  # newest


# ─── Security hardening checks (S12) ─────────────────────────────────────────

async def test_cors_no_wildcard(client: AsyncClient):
    """CORS must not expose a wildcard Allow-Origin."""
    r = await client.options("/api/models", headers={"Origin": "http://evil.com", "Access-Control-Request-Method": "GET"})
    origin = r.headers.get("access-control-allow-origin", "")
    assert origin != "*", "Wildcard CORS origin is not allowed"


async def test_api_key_not_echoed_in_error(client: AsyncClient):
    """
    Error responses must NOT echo the API key back.
    (Verifies log masking doesn't leak into response bodies.)
    """
    from conftest import TINY_PNG
    secret_key = "sk-ant-api03-super-secret-key-do-not-echo"
    r = await client.post(
        "/api/generate",
        files={"image": ("test.png", TINY_PNG, "image/png")},
        data={"api_key": secret_key, "model": "claude", "framework": "html"},
    )
    # Even if request succeeds at validation level, the key must not appear in any error
    text = r.text
    assert secret_key not in text, "API key was leaked in the response body"


async def test_rate_limit_enforced(client: AsyncClient):
    """Rate limiter must kick in after RATE_LIMIT_REQUESTS requests."""
    from conftest import TINY_PNG
    from models import RATE_LIMIT_REQUESTS

    statuses = []
    for _ in range(RATE_LIMIT_REQUESTS + 2):
        r = await client.post(
            "/api/generate",
            files={"image": ("test.png", TINY_PNG, "image/png")},
            data={"api_key": "sk-test", "model": "claude", "framework": "html"},
        )
        statuses.append(r.status_code)

    assert 429 in statuses, "Rate limiter never triggered"


async def test_private_ip_blocked_in_url(client: AsyncClient):
    """SSRF prevention: internal IPs must be blocked at URL endpoint."""
    for url in ["http://10.0.0.1/", "http://172.16.0.1/", "http://192.168.0.1/"]:
        r = await client.post("/api/generate/from-url", json={
            "api_key": "sk-test",
            "url": url,
            "model": "claude",
            "framework": "html",
        })
        assert r.status_code in (400, 403), f"Private IP {url} was not blocked"
        assert r.json().get("code") in ("URL_BLOCKED", "INVALID_URL")
