"""
Shared pytest fixtures for PicToFrontend backend tests.
"""

import io
import os
import sys
import pytest
from httpx import AsyncClient, ASGITransport

# Make the backend package importable from the tests/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def reset_rate_limit():
    """Clear the in-memory rate store before every test to prevent cross-test pollution."""
    import main as backend
    backend._rate_store.clear()
    yield
    backend._rate_store.clear()


@pytest.fixture
async def client():
    """Async HTTPX client connected to the FastAPI app (no running server needed)."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ── Minimal valid PNG (1×1 pixel) ─────────────────────────────────────────────
TINY_PNG = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,   # PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,   # IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,   # 1×1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,   # IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
    0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,   # IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82,
])


def png_file(size_bytes: int | None = None) -> tuple[bytes, str, str]:
    """Return (data, filename, content_type) for an image upload."""
    if size_bytes is not None and size_bytes > len(TINY_PNG):
        data = TINY_PNG + b"\x00" * (size_bytes - len(TINY_PNG))
    else:
        data = TINY_PNG
    return data, "test.png", "image/png"
