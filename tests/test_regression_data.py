"""
Sprint 2 — s2-q2
Regresyon Veri Seti: 10 görsel + 10 URL + 10 metin prompt

Her veri noktası şunları doğrular:
  - Doğru girdiler API validasyonundan geçer
  - Yanlış girdiler uygun hata kodu ile reddedilir
  - Güvenlik filtreleri tutarlı çalışır (URL kara listesi, MIME, boyut)

Not: Üretim AI çağrıları test edilmez (API key gerektirmez).
     Regresyon testleri validasyon katmanını ve hata yollarını kapsar.
"""

from __future__ import annotations

import base64
import io
import struct
import zlib
from typing import NamedTuple

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

# ─── PNG üretici yardımcıları ─────────────────────────────────────────────────

def _make_png(width: int = 1, height: int = 1, color: tuple[int,int,int] = (0,0,0)) -> bytes:
    """Minimal geçerli PNG üretir (gerçek CRC + IDAT ile)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    # Scanline: filter_byte(0) + RGB * width, per row
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(color) * width
    compressed = zlib.compress(raw)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr_data)
        + chunk(b"IDAT", compressed)
        + chunk(b"IEND", b"")
    )


def _make_jpg_stub() -> bytes:
    """Minimal JPEG başlığı (geçerli MIME tespiti için yeterli)."""
    # SOI + APP0 marker + minimal JFIF header
    return (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xd9"  # EOI
    )


def _make_webp_stub() -> bytes:
    """Minimal WebP dosyası (RIFF+WEBP header)."""
    payload = b"WEBPVP8L\x06\x00\x00\x00\x2f\x00\x00\x00\x00\x00\xfe\xff\xff\x00"
    size = len(payload)
    return b"RIFF" + struct.pack("<I", size + 4) + payload


class ImageCase(NamedTuple):
    label: str
    data: bytes
    filename: str
    mime: str
    model: str
    framework: str
    api_key: str
    expected_status: int   # beklenen HTTP status kodu
    expected_code: str     # beklenen hata kodu (boşsa herhangi bir başarılı durum)


# ─── 10 Görsel Regresyon Vakası ───────────────────────────────────────────────

IMAGE_CASES: list[ImageCase] = [
    # 1. Standart PNG, geçerli model + framework → 200 akış başlamalı
    ImageCase(
        label="1_png_claude_html",
        data=_make_png(4, 4, (255, 0, 0)),
        filename="ui.png", mime="image/png",
        model="claude", framework="html",
        api_key="sk-test-dummy",
        expected_status=200, expected_code="",
    ),
    # 2. JPEG dosyası, react framework → 200
    ImageCase(
        label="2_jpg_claude_react",
        data=_make_jpg_stub(),
        filename="screen.jpg", mime="image/jpeg",
        model="claude", framework="react",
        api_key="sk-test-dummy",
        expected_status=200, expected_code="",
    ),
    # 3. WEBP dosyası, vue framework → 200
    ImageCase(
        label="3_webp_gpt4o_vue",
        data=_make_webp_stub(),
        filename="page.webp", mime="image/webp",
        model="gpt4o", framework="vue",
        api_key="sk-test-dummy",
        expected_status=200, expected_code="",
    ),
    # 4. PNG, bootstrap framework → 200
    ImageCase(
        label="4_png_gemini_bootstrap",
        data=_make_png(2, 2, (0, 255, 0)),
        filename="landing.png", mime="image/png",
        model="gemini", framework="bootstrap",
        api_key="sk-test-dummy",
        expected_status=200, expected_code="",
    ),
    # 5. PNG, gpt4o-mini model → 200
    ImageCase(
        label="5_png_gpt4o_mini",
        data=_make_png(8, 8, (0, 0, 255)),
        filename="dashboard.png", mime="image/png",
        model="gpt4o-mini", framework="react",
        api_key="sk-test-dummy",
        expected_status=200, expected_code="",
    ),
    # 6. Geçersiz MIME (PDF) → INVALID_MIME
    ImageCase(
        label="6_invalid_mime_pdf",
        data=b"%PDF-1.4\n%fake",
        filename="doc.pdf", mime="application/pdf",
        model="claude", framework="html",
        api_key="sk-test-dummy",
        expected_status=400, expected_code="INVALID_MIME",
    ),
    # 7. Geçersiz MIME (SVG) → INVALID_MIME
    ImageCase(
        label="7_invalid_mime_svg",
        data=b"<svg xmlns='http://www.w3.org/2000/svg'><rect width='1' height='1'/></svg>",
        filename="icon.svg", mime="image/svg+xml",
        model="claude", framework="html",
        api_key="sk-test-dummy",
        expected_status=400, expected_code="INVALID_MIME",
    ),
    # 8. Boş API key → INVALID_API_KEY
    ImageCase(
        label="8_empty_api_key",
        data=_make_png(),
        filename="test.png", mime="image/png",
        model="claude", framework="html",
        api_key="",
        expected_status=400, expected_code="INVALID_API_KEY",
    ),
    # 9. Bilinmeyen model → INVALID_MODEL
    ImageCase(
        label="9_unknown_model",
        data=_make_png(),
        filename="test.png", mime="image/png",
        model="llama-9999", framework="html",
        api_key="sk-test-dummy",
        expected_status=422, expected_code="INVALID_MODEL",
    ),
    # 10. Bilinmeyen framework → INVALID_FRAMEWORK
    ImageCase(
        label="10_unknown_framework",
        data=_make_png(),
        filename="test.png", mime="image/png",
        model="claude", framework="angular",
        api_key="sk-test-dummy",
        expected_status=422, expected_code="INVALID_FRAMEWORK",
    ),
]

@pytest.mark.parametrize("case", IMAGE_CASES, ids=[c.label for c in IMAGE_CASES])
async def test_image_regression(client: AsyncClient, case: ImageCase):
    """Regresyon: 10 görsel vakası — validasyon ve hata yolları."""
    r = await client.post(
        "/api/generate",
        files={"image": (case.filename, io.BytesIO(case.data), case.mime)},
        data={
            "api_key":   case.api_key,
            "model":     case.model,
            "framework": case.framework,
        },
    )
    assert r.status_code == case.expected_status, (
        f"[{case.label}] Beklenen {case.expected_status}, alınan {r.status_code}: {r.text[:200]}"
    )
    if case.expected_code:
        body = r.json()
        assert body.get("code") == case.expected_code, (
            f"[{case.label}] Beklenen kod '{case.expected_code}', alınan: {body}"
        )


# ─── 10 URL Regresyon Vakası ─────────────────────────────────────────────────

class UrlCase(NamedTuple):
    label: str
    url: str
    api_key: str
    expected_status: int
    expected_code: str   # boşsa güvenli URL (başarı beklenir — URL fetch aşamasında failse OK)


URL_CASES: list[UrlCase] = [
    # Güvenli public URL'ler — validasyonu geçmeli (fetch başarısız olabilir, ama 400 değil)
    UrlCase("1_https_public",       "https://example.com",           "sk-test", 200, ""),
    UrlCase("2_https_news",         "https://news.ycombinator.com",  "sk-test", 200, ""),
    UrlCase("3_https_github",       "https://github.com",            "sk-test", 200, ""),
    UrlCase("4_http_plain",         "http://example.com",            "sk-test", 200, ""),
    UrlCase("5_https_subdomain",    "https://docs.python.org",       "sk-test", 200, ""),
    # Engellenmiş URL'ler — URL_BLOCKED veya INVALID_URL dönmeli
    UrlCase("6_localhost",          "http://localhost:3000",          "sk-test", 400, "URL_BLOCKED"),
    UrlCase("7_private_192",        "http://192.168.1.1/admin",      "sk-test", 400, "URL_BLOCKED"),
    UrlCase("8_private_10",         "http://10.0.0.1/secret",        "sk-test", 400, "URL_BLOCKED"),
    UrlCase("9_aws_metadata",       "http://169.254.169.254/latest", "sk-test", 400, "URL_BLOCKED"),
    UrlCase("10_empty_api_key",     "https://example.com",           "",        400, "INVALID_API_KEY"),
]

@pytest.mark.parametrize("case", URL_CASES, ids=[c.label for c in URL_CASES])
async def test_url_regression(client: AsyncClient, case: UrlCase):
    """Regresyon: 10 URL vakası — güvenlik filtresi ve validasyon."""
    r = await client.post(
        "/api/generate/from-url",
        json={
            "url":       case.url,
            "api_key":   case.api_key,
            "model":     "claude",
            "framework": "html",
        },
    )

    if case.expected_code:
        # Engellenmiş vakalar: hata kodu kontrolü
        assert r.status_code in (400, 422, 403), (
            f"[{case.label}] Hata beklendi, alınan {r.status_code}"
        )
        body = r.json()
        assert body.get("code") == case.expected_code, (
            f"[{case.label}] Beklenen '{case.expected_code}', alınan: {body}"
        )
    else:
        # Güvenli URL'ler: URL validasyonu geçmeli.
        # URL fetch veya AI çağrısı başarısız olabilir (bu test ortamında beklenir),
        # ama URL_BLOCKED / INVALID_URL / INVALID_API_KEY 400 almamalıyız.
        if r.status_code == 400:
            body = r.json()
            assert body.get("code") not in ("URL_BLOCKED", "INVALID_URL", "INVALID_API_KEY"), (
                f"[{case.label}] Güvenli URL beklenmedik şekilde engellendi: {body}"
            )


# ─── 10 Metin Prompt Regresyon Vakası ────────────────────────────────────────

class TextCase(NamedTuple):
    label: str
    description: str
    model: str
    framework: str
    api_key: str
    expected_status: int
    expected_code: str


TEXT_CASES: list[TextCase] = [
    # Geçerli promptlar — validasyonu geçmeli (AI hatası test edilmiyor)
    TextCase(
        "1_landing_html",
        "A modern SaaS landing page with a hero section, three feature cards, and a CTA button in dark mode",
        "claude", "html", "sk-test-dummy", 200, "",
    ),
    TextCase(
        "2_dashboard_react",
        "An analytics dashboard with a sidebar, header with user avatar, KPI stat cards, and a line chart area",
        "claude", "react", "sk-test-dummy", 200, "",
    ),
    TextCase(
        "3_login_vue",
        "A login form centered on the page with email and password fields, remember me checkbox, and forgot password link",
        "gpt4o", "vue", "sk-test-dummy", 200, "",
    ),
    TextCase(
        "4_ecommerce_bootstrap",
        "An e-commerce product listing page with a grid of product cards, each with image placeholder, name, price and add-to-cart button",
        "claude", "bootstrap", "sk-test-dummy", 200, "",
    ),
    TextCase(
        "5_profile_html",
        "A user profile page with avatar, bio, follower count, tabbed sections for posts and media, and an edit button",
        "claude-haiku", "html", "sk-test-dummy", 200, "",
    ),
    TextCase(
        "6_pricing_react",
        "A three-tier pricing table with monthly/yearly toggle, highlighted recommended plan, and feature comparison rows",
        "gpt4o-mini", "react", "sk-test-dummy", 200, "",
    ),
    TextCase(
        "7_blog_html",
        "A blog post page with a wide hero image, author byline with avatar, reading time, and a comments section at the bottom",
        "gemini", "html", "sk-test-dummy", 200, "",
    ),
    # Geçersiz vakalar — hata dönmeli
    TextCase(
        "8_empty_api_key",
        "A simple contact form with name, email and message fields and a submit button",
        "claude", "html", "", 400, "INVALID_API_KEY",
    ),
    TextCase(
        "9_unknown_model",
        "A task management board with columns for Todo, In Progress, and Done with draggable cards",
        "gpt-x-turbo-99", "html", "sk-test-dummy", 422, "INVALID_MODEL",
    ),
    TextCase(
        "10_description_too_short",
        "short",   # < 10 karakter — Pydantic min_length ile reddedilmeli
        "claude", "html", "sk-test-dummy", 422, "",
    ),
]

@pytest.mark.parametrize("case", TEXT_CASES, ids=[c.label for c in TEXT_CASES])
async def test_text_regression(client: AsyncClient, case: TextCase):
    """Regresyon: 10 metin prompt vakası — validasyon ve hata yolları."""
    r = await client.post(
        "/api/generate/from-text",
        json={
            "description": case.description,
            "api_key":     case.api_key,
            "model":       case.model,
            "framework":   case.framework,
        },
    )
    assert r.status_code == case.expected_status, (
        f"[{case.label}] Beklenen {case.expected_status}, alınan {r.status_code}: {r.text[:200]}"
    )
    if case.expected_code:
        body = r.json()
        assert body.get("code") == case.expected_code, (
            f"[{case.label}] Beklenen kod '{case.expected_code}', alınan: {body}"
        )


# ─── Çapraz kontrol: model × framework matrisi ───────────────────────────────

# Tüm sağlayıcılardan temsili modeller (validasyon matrisi için)
SUPPORTED_MODELS = [
    # Anthropic
    "claude", "claude-haiku", "claude-sonnet-4-6",
    # OpenAI
    "gpt4o", "gpt4o-mini", "gpt-4-1",
    # Google
    "gemini",
    # DeepSeek (text-only: sadece from-text ile çalışır)
    "deepseek",
    # Alibaba Qwen
    "qwen-vl-plus",
    # Moonshot (text-only)
    "kimi",
]
# 6 framework (svelte + alpine dahil)
SUPPORTED_FRAMEWORKS = ["html", "react", "vue", "bootstrap", "svelte", "alpine"]

@pytest.mark.parametrize("model", SUPPORTED_MODELS)
@pytest.mark.parametrize("framework", SUPPORTED_FRAMEWORKS)
async def test_text_model_framework_matrix(client: AsyncClient, model: str, framework: str):
    """
    Desteklenen tüm model × framework kombinasyonları validasyonu geçmeli.
    AI çağrısı mock değil — validasyon katmanı test ediliyor.
    """
    r = await client.post(
        "/api/generate/from-text",
        json={
            "description": "A responsive navigation bar with logo, links and a hamburger menu for mobile",
            "api_key":     "sk-test-dummy",
            "model":       model,
            "framework":   framework,
        },
    )
    # Validasyon katmanı geçmeli → 200 (stream) veya AI hatası (400/500 ama INVALID_MODEL/FRAMEWORK değil)
    if r.status_code in (400, 422):
        body = r.json()
        assert body.get("code") not in ("INVALID_MODEL", "INVALID_FRAMEWORK"), (
            f"[{model}/{framework}] Desteklenen kombinasyon reddedildi: {body}"
        )


# ─── Özet sayım testi ────────────────────────────────────────────────────────

def test_regression_dataset_counts():
    """Regresyon veri setinin tam olduğunu doğrular."""
    assert len(IMAGE_CASES) == 10, f"Beklenen 10 görsel vakası, var: {len(IMAGE_CASES)}"
    assert len(URL_CASES)   == 10, f"Beklenen 10 URL vakası, var: {len(URL_CASES)}"
    assert len(TEXT_CASES)  == 10, f"Beklenen 10 metin vakası, var: {len(TEXT_CASES)}"

    # Etiketler benzersiz olmalı
    img_labels  = [c.label for c in IMAGE_CASES]
    url_labels  = [c.label for c in URL_CASES]
    text_labels = [c.label for c in TEXT_CASES]

    assert len(img_labels)  == len(set(img_labels)),  "Görsel etiketleri çakışıyor"
    assert len(url_labels)  == len(set(url_labels)),  "URL etiketleri çakışıyor"
    assert len(text_labels) == len(set(text_labels)), "Metin etiketleri çakışıyor"
