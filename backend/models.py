"""
PicToFrontend — Shared data models, constants, and type definitions.

Sprint 1:
  S1  — Pydantic typed payload schemas
  S2  — Model definitions centralised here

Sprint 2:
  S5  — 3+ new models + metadata enrichment
  S8  — Bootstrap framework added
  URL/Text request schemas
  Session types

Sprint 4:
  s4-b2 — Extended thinking model support (has_thinking, thinking_budget fields)
"""

import re
import ipaddress
from typing import Literal, Optional
from pydantic import BaseModel, Field

# ─── File / Request Constraints ──────────────────────────────────────────────
ALLOWED_MIME_TYPES: frozenset[str] = frozenset([
    "image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif",
])
ALLOWED_VIDEO_MIME_TYPES: frozenset[str] = frozenset([
    "video/mp4",
    "video/webm",
    "video/quicktime",
])
MAX_FILE_SIZE: int        = 20 * 1024 * 1024   # 20 MB
GENERATE_TIMEOUT: int     = 120                 # seconds
URL_SCREENSHOT_TIMEOUT: int = 30               # seconds for URL fetch
STREAM_CHUNK_SIZE: int    = 2048               # bytes

# ─── Rate limiting ────────────────────────────────────────────────────────────
RATE_LIMIT_REQUESTS: int = 10
RATE_LIMIT_WINDOW: int   = 60                  # seconds

# ─── Session store ────────────────────────────────────────────────────────────
# session_id → list of {"role": ..., "content": ...} conversation turns
SESSION_MAX_TURNS: int = 10

# ─── Error codes ──────────────────────────────────────────────────────────────
class ErrorCode:
    INVALID_MIME       = "INVALID_MIME"
    FILE_TOO_LARGE     = "FILE_TOO_LARGE"
    INVALID_MODEL      = "INVALID_MODEL"
    INVALID_FRAMEWORK  = "INVALID_FRAMEWORK"
    INVALID_API_KEY    = "INVALID_API_KEY"
    INVALID_URL        = "INVALID_URL"
    URL_BLOCKED        = "URL_BLOCKED"
    URL_FETCH_FAILED   = "URL_FETCH_FAILED"
    RATE_LIMITED       = "RATE_LIMITED"
    TIMEOUT            = "TIMEOUT"
    UPSTREAM_ERROR     = "UPSTREAM_ERROR"
    INTERNAL_ERROR     = "INTERNAL_ERROR"

# ─── Pydantic payload schemas ─────────────────────────────────────────────────

class GenerateError(BaseModel):
    type: Literal["error"] = "error"
    code: str
    message: str

class GenerateChunk(BaseModel):
    type: Literal["chunk"] = "chunk"
    text: str

class ErrorResponse(BaseModel):
    type: Literal["error"] = "error"
    code: str    = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable explanation")

class URLGenerateRequest(BaseModel):
    api_key:    str
    url:        str
    model:      str = "claude"
    framework:  str = "html"
    session_id: Optional[str] = None

class TextGenerateRequest(BaseModel):
    api_key:     str
    description: str = Field(..., min_length=10, max_length=4000)
    model:       str = "claude"
    framework:   str = "html"
    session_id:  Optional[str] = None

# ─── AI Model definitions (S5 — 3+ new models) ───────────────────────────────

class ModelInfo(BaseModel):
    id: str
    name: str
    description: str
    credits: int
    provider: str
    context_window: Optional[int] = None
    cost_per_1k: Optional[float] = None
    has_thinking: bool = False        # Sprint 4: s4-b2 — Extended thinking support
    thinking_budget: int = 10_000    # Default budget_tokens for thinking
    supports_vision: bool = True     # False = metin giriş only, görsel gönderilemez

MODEL_OPTIONS: dict[str, ModelInfo] = {
    # ── Anthropic — Claude 3.x ─────────────────────────────────────────────
    "claude-haiku": ModelInfo(
        id="claude-haiku", name="Claude 3.5 Haiku",
        description="Fastest Claude — quick iterations",
        credits=1, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.0008,
    ),
    "claude": ModelInfo(
        id="claude", name="Claude 3.5 Sonnet",
        description="Best for UI/UX fidelity",
        credits=5, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.003,
    ),
    "claude-opus": ModelInfo(
        id="claude-opus", name="Claude 3 Opus",
        description="Most powerful Claude 3 — complex layouts",
        credits=15, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.015,
    ),
    "claude-sonnet-thinking": ModelInfo(
        id="claude-sonnet-thinking", name="Claude 3.7 Sonnet (Think)",
        description="Extended reasoning — complex layouts",
        credits=20, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.003,
        has_thinking=True, thinking_budget=10_000,
    ),
    # ── Anthropic — Claude 4.x ─────────────────────────────────────────────
    "claude-sonnet-4-5": ModelInfo(
        id="claude-sonnet-4-5", name="Claude Sonnet 4.5",
        description="Claude 4.5 Sonnet — hız ve kalite dengesi",
        credits=6, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.003,
    ),
    "claude-sonnet-4-6": ModelInfo(
        id="claude-sonnet-4-6", name="Claude Sonnet 4.6",
        description="En yeni Claude Sonnet — en yüksek kalite",
        credits=7, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.003,
    ),
    "claude-opus-4-5": ModelInfo(
        id="claude-opus-4-5", name="Claude Opus 4.5",
        description="Claude 4.5 Opus — premium akıl yürütme",
        credits=18, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.015,
    ),
    "claude-opus-4-6": ModelInfo(
        id="claude-opus-4-6", name="Claude Opus 4.6",
        description="En güçlü Anthropic modeli",
        credits=22, provider="Anthropic",
        context_window=200_000, cost_per_1k=0.015,
    ),
    # ── OpenAI ─────────────────────────────────────────────────────────────
    "gpt4o-mini": ModelInfo(
        id="gpt4o-mini", name="GPT-4o Mini",
        description="Most economical",
        credits=1, provider="OpenAI",
        context_window=128_000, cost_per_1k=0.00015,
    ),
    "gpt4o": ModelInfo(
        id="gpt4o", name="GPT-4o",
        description="Fast and balanced",
        credits=3, provider="OpenAI",
        context_window=128_000, cost_per_1k=0.005,
    ),
    "gpt4-turbo": ModelInfo(
        id="gpt4-turbo", name="GPT-4 Turbo",
        description="High quality, large context",
        credits=4, provider="OpenAI",
        context_window=128_000, cost_per_1k=0.01,
    ),
    "gpt-4-1": ModelInfo(
        id="gpt-4-1", name="GPT-4.1",
        description="OpenAI en yeni flagship — gelişmiş kodlama",
        credits=5, provider="OpenAI",
        context_window=1_000_000, cost_per_1k=0.002,
    ),
    "o3-mini": ModelInfo(
        id="o3-mini", name="o3-mini (Reasoning)",
        description="OpenAI reasoning modeli — metin giriş",
        credits=8, provider="OpenAI",
        context_window=200_000, cost_per_1k=0.0011,
        supports_vision=False,
    ),
    # ── Google ─────────────────────────────────────────────────────────────
    "gemini": ModelInfo(
        id="gemini", name="Gemini 1.5 Flash",
        description="Fast multimodal alternative",
        credits=2, provider="Google",
        context_window=1_000_000, cost_per_1k=0.000075,
    ),
    "gemini-pro": ModelInfo(
        id="gemini-pro", name="Gemini 1.5 Pro",
        description="Google's most capable model",
        credits=6, provider="Google",
        context_window=2_000_000, cost_per_1k=0.0035,
    ),
    # ── DeepSeek ───────────────────────────────────────────────────────────
    "deepseek": ModelInfo(
        id="deepseek", name="DeepSeek V3",
        description="En iyi açık kaynak model — vision destekli",
        credits=2, provider="DeepSeek",
        context_window=128_000, cost_per_1k=0.00027,
    ),
    "deepseek-r1": ModelInfo(
        id="deepseek-r1", name="DeepSeek R1 (Reasoning)",
        description="Açık kaynak reasoning — metin giriş",
        credits=4, provider="DeepSeek",
        context_window=128_000, cost_per_1k=0.00055,
        supports_vision=False,
    ),
    # ── Alibaba Qwen ───────────────────────────────────────────────────────
    "qwen-vl": ModelInfo(
        id="qwen-vl", name="Qwen VL Max",
        description="Alibaba vision-language — en güçlü Qwen",
        credits=4, provider="Alibaba",
        context_window=32_000, cost_per_1k=0.003,
    ),
    "qwen-vl-plus": ModelInfo(
        id="qwen-vl-plus", name="Qwen VL Plus",
        description="Alibaba vision-language — hızlı ekonomik",
        credits=2, provider="Alibaba",
        context_window=32_000, cost_per_1k=0.0015,
    ),
    # ── Moonshot (Kimi) ────────────────────────────────────────────────────
    "kimi": ModelInfo(
        id="kimi", name="Kimi (Moonshot 128k)",
        description="Çin uzun bağlam modeli — metin giriş",
        credits=3, provider="Moonshot",
        context_window=128_000, cost_per_1k=0.0024,
        supports_vision=False,
    ),
}

# ─── Frameworks (S8 — Bootstrap; extended with Svelte + Alpine) ──────────────

ALLOWED_FRAMEWORKS: frozenset[str] = frozenset(["html", "react", "vue", "bootstrap", "svelte", "alpine"])

FRAMEWORKS = [
    {"id": "html",      "name": "HTML + Tailwind"},
    {"id": "react",     "name": "React + Tailwind"},
    {"id": "vue",       "name": "Vue + Tailwind"},
    {"id": "bootstrap", "name": "HTML + Bootstrap 5"},
    {"id": "svelte",    "name": "Svelte + Tailwind"},
    {"id": "alpine",    "name": "HTML + Alpine.js"},
]

# ─── URL security filter (S11) ────────────────────────────────────────────────

_PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),   # link-local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]

_BLOCKED_HOSTNAMES = frozenset([
    "localhost", "metadata.google.internal",
    "169.254.169.254",     # AWS/GCP metadata
    "100.100.100.200",     # Alibaba metadata
])

def validate_url(url: str) -> str:
    """Return cleaned URL or raise ValueError with a human-readable reason."""
    import urllib.parse
    if not url:
        raise ValueError("URL cannot be empty")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception as exc:
        raise ValueError(f"Malformed URL: {exc}") from exc

    hostname = parsed.hostname or ""
    if not hostname:
        raise ValueError("URL has no hostname")

    # Block known hostnames
    if hostname.lower() in _BLOCKED_HOSTNAMES:
        raise PermissionError(f"Blocked hostname: {hostname}")

    # Resolve IP and check ranges
    try:
        addr = ipaddress.ip_address(hostname)
        for net in _PRIVATE_RANGES:
            if addr in net:
                raise PermissionError(f"Private/reserved IP blocked: {hostname}")
    except ValueError:
        pass  # not a raw IP — hostname is fine

    return url

# ─── API key masking utility ──────────────────────────────────────────────────

_KEY_PATTERN = re.compile(r"(sk-[a-zA-Z0-9-]{4})[a-zA-Z0-9-]+")

def mask_api_key(key: str) -> str:
    if not key:
        return "(empty)"
    if key.startswith("AIza"):
        return "AIza***"
    return _KEY_PATTERN.sub(r"\1***", key) if _KEY_PATTERN.match(key) else "***"
