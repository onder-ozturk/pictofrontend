"""
PicToFrontend — Backend API
FastAPI + Claude/GPT-4o/Gemini Vision streaming

Sprint 1: S1-S5, S10-S12
Sprint 2:
  S1  — POST /api/generate/from-url
  S2  — POST /api/generate/from-text
  S3  — URL screenshot via Playwright (timeout, redirect, SSL handling)
  S4  — session_id iterative improvement / conversation history
  S5  — 3+ new models + /api/models metadata enrichment
  S8  — Bootstrap framework support
  S10 — Model payload validation (already in Sprint 1)
  S11 — URL security filter (localhost/private IP/blacklist)

Sprint 3:
  S3  — Code post-processing: strip markdown fences, normalize output
  S4  — Session-based version history (last 5 generated versions per session)
  S9  — In-memory metrics: request count, error rate, latency P95/P99

Sprint 4:
  s4-b2 — Extended thinking: Claude 3.7 Sonnet thinking streaming
  s4-b3 — JWT auth: register + login endpoints
  s4-b4 — Persistent credit system: SQLite via db.py
  s4-g1 — JWT middleware: Bearer token validation via auth.py
"""

import asyncio
import base64
import json
import logging
import os
import shutil
import tempfile
import uuid
from collections import defaultdict
from contextlib import asynccontextmanager
from pathlib import Path
from time import monotonic
from threading import Lock
from typing import Any, AsyncGenerator, Literal, Optional

import aiohttp
import anthropic
import openai
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, RedirectResponse
from pydantic import BaseModel, Field as PydanticField

from models import (
    ALLOWED_FRAMEWORKS,
    ALLOWED_MIME_TYPES,
    ALLOWED_VIDEO_MIME_TYPES,
    FRAMEWORKS,
    GENERATE_TIMEOUT,
    MAX_FILE_SIZE,
    MODEL_OPTIONS,
    RATE_LIMIT_REQUESTS,
    RATE_LIMIT_WINDOW,
    SESSION_MAX_TURNS,
    STREAM_CHUNK_SIZE,
    URL_SCREENSHOT_TIMEOUT,
    ErrorCode,
    ErrorResponse,
    GenerateError,
    TextGenerateRequest,
    URLGenerateRequest,
    mask_api_key,
    validate_url,
)
from postprocess import FenceStripper, normalize_code
import metrics as _metrics
import auth as auth_module
import db
import observe

load_dotenv()

# ─── Logging setup (S10 — log masking) ───────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("pictofrontend")

WEBSOCKET_STREAMING_ENABLED: bool = os.getenv(
    "ENABLE_WEBSOCKET_GENERATION",
    "false",
).lower() in {"1", "true", "yes", "on"}

# ─── CORS (S11 — no wildcard) ─────────────────────────────────────────────────
_raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.142:3000",
)
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",") if o.strip()]

# ─── GitHub / Google OAuth (S4) ───────────────────────────────────────────────
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_URL = os.getenv("ORIGIN_FRONTEND", "https://pictofrontend.com")

# ─── Rate limiter (S12) ───────────────────────────────────────────────────────
_rate_lock = Lock()
_rate_store: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(ip: str) -> bool:
    """Return True if the request is allowed; False if rate-limited."""
    now = monotonic()
    window_start = now - RATE_LIMIT_WINDOW
    with _rate_lock:
        _rate_store[ip] = [t for t in _rate_store[ip] if t > window_start]
        if len(_rate_store[ip]) >= RATE_LIMIT_REQUESTS:
            return False
        _rate_store[ip].append(now)
        return True


# ─── Error helper (S3) ────────────────────────────────────────────────────────
def _error(code: str, message: str, status: int = 400) -> HTTPException:
    """Create an HTTPException with standardised {type, code, message} body."""
    return HTTPException(
        status_code=status,
        detail={"type": "error", "code": code, "message": message},
    )


# ─── System prompt ────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert Frontend Developer. Your task is to convert the provided screenshot/image into pixel-perfect HTML and Tailwind CSS code.

STRICT REQUIREMENTS:
1. Create a SINGLE index.html file containing all HTML, CSS (Tailwind), and JavaScript
2. The code must be FULLY RESPONSIVE (mobile, tablet, desktop)
3. Match the design EXACTLY - colors, spacing, fonts, layout, shadows
4. Use Tailwind CSS classes for all styling
5. Use FontAwesome for icons (CDN: https://cdnjs.cloudflare.com/ajax/libs/fontawesome/6.4.0/css/all.min.css)
6. Use placehold.co for placeholder images
7. Include necessary JavaScript for interactive elements
8. Add comments explaining complex sections

OUTPUT RULES:
- Return ONLY the complete HTML code
- Start with <!DOCTYPE html>
- No markdown code blocks, no explanations outside code
- Ensure the code is production-ready"""


def _framework_prompt(framework: str) -> str:
    prompts = {
        "react":     "\n\nREACT SPECIFIC:\n- Functional components with hooks\n- Tailwind in className\n- Return JSX",
        "vue":       "\n\nVUE SPECIFIC:\n- Vue 3 Composition API\n- <template>, <script setup>, <style>\n- Tailwind classes",
        "html":      "\n\nHTML SPECIFIC:\n- Single HTML file\n- External Tailwind CDN (https://cdn.tailwindcss.com)",
        "bootstrap": "\n\nBOOTSTRAP 5 SPECIFIC:\n- Single HTML file\n- Bootstrap 5 CDN (https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css)\n- Bootstrap JS bundle CDN\n- Use Bootstrap classes ONLY, no Tailwind",
        "svelte":    "\n\nSVELTE SPECIFIC:\n- Single .svelte file with <script>, template, and <style> sections\n- Tailwind via CDN in <svelte:head> or class attributes\n- Use Svelte reactive declarations ($:) and event directives (on:click)\n- No build step assumed — keep it self-contained",
        "alpine":    "\n\nALPINE.JS SPECIFIC:\n- Single HTML file\n- Alpine.js CDN: <script defer src=\"https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js\"></script>\n- Tailwind CDN for styling\n- Use x-data, x-bind, x-on, x-show, x-for directives\n- No Vue/React — pure Alpine.js interactivity",
    }
    return prompts.get(framework, prompts["html"])

def _model_api_id(model_id: str) -> str:
    """Map our model ID to the actual API model string."""
    mapping = {
        # Anthropic — Claude 3.x
        "claude":                  "claude-3-5-sonnet-20241022",
        "claude-opus":             "claude-3-opus-20240229",
        "claude-haiku":            "claude-3-5-haiku-20241022",
        "claude-sonnet-thinking":  "claude-3-7-sonnet-20250219",
        # Anthropic — Claude 4.x
        "claude-sonnet-4-5":       "claude-sonnet-4-5-20250929",
        "claude-sonnet-4-6":       "claude-sonnet-4-6",
        "claude-opus-4-5":         "claude-opus-4-5-20251101",
        "claude-opus-4-6":         "claude-opus-4-6",
        # OpenAI
        "gpt4o":                   "gpt-4o",
        "gpt4o-mini":              "gpt-4o-mini",
        "gpt4-turbo":              "gpt-4-turbo",
        "gpt-4-1":                 "gpt-4.1-2025-04-14",
        "o3-mini":                 "o3-mini",
        # Google
        "gemini":                  "gemini-1.5-flash",
        "gemini-pro":              "gemini-1.5-pro",
        # DeepSeek
        "deepseek":                "deepseek-chat",
        "deepseek-r1":             "deepseek-reasoner",
        # Alibaba Qwen
        "qwen-vl":                 "qwen-vl-max",
        "qwen-vl-plus":            "qwen-vl-plus",
        # Moonshot (Kimi)
        "kimi":                    "moonshot-v1-128k",
    }
    return mapping.get(model_id, model_id)


# ── OpenAI-compatible provider base URLs ─────────────────────────────────────
_COMPAT_BASE_URLS: dict[str, str] = {
    "DeepSeek": "https://api.deepseek.com/v1",
    "Alibaba":  "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "Moonshot": "https://api.moonshot.cn/v1",
}


# ─── Image helpers ────────────────────────────────────────────────────────────
def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


async def _stream_chunks(text: str) -> AsyncGenerator[str, None]:
    """Yield a long text in fixed-size chunks (simulated streaming)."""
    for i in range(0, len(text), STREAM_CHUNK_SIZE):
        yield text[i: i + STREAM_CHUNK_SIZE]
        await asyncio.sleep(0)


# ─── Provider streaming generators ───────────────────────────────────────────

async def _stream_claude(
    api_key: str,
    image_b64: Optional[str],
    framework: str,
    media_type: str = "image/png",
    model_id: str = "claude",
    history: Optional[list[dict]] = None,
    text_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    Claude streaming — supports image, text-only, session history (S4),
    and extended thinking (Sprint 4 s4-b2).

    Thinking chunks are prefixed with \\x00THINK\\x00 so the frontend
    can route them to the thinking visualisation panel without
    interfering with the actual code output.
    """
    client: Optional[anthropic.AsyncAnthropic] = None
    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        system = SYSTEM_PROMPT + _framework_prompt(framework)
        api_model = _model_api_id(model_id)

        model_info   = MODEL_OPTIONS.get(model_id)
        has_thinking = model_info.has_thinking if model_info else False
        thinking_budget = model_info.thinking_budget if model_info else 10_000

        # Build current user message
        if image_b64:
            user_content: list[dict] = [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": text_prompt or "Convert this screenshot to code. Match the design exactly."},
            ]
        else:
            user_content = [{"type": "text", "text": text_prompt or "Generate code based on the description."}]

        messages = list(history or []) + [{"role": "user", "content": user_content}]

        stream_kwargs: dict = {
            "model":      api_model,
            "max_tokens": 16_000 if has_thinking else 4096,
            "system":     system,
            "messages":   messages,
        }
        if has_thinking:
            # Extended thinking: temperature must be default (1) for thinking models
            stream_kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": thinking_budget,
            }
        else:
            stream_kwargs["temperature"] = 0.1

        async with client.messages.stream(**stream_kwargs) as stream:
            full_response = ""

            if has_thinking:
                # Iterate raw stream events to capture both thinking and text blocks.
                # Thinking deltas → prefixed with \x00THINK\x00 for frontend routing.
                # Text deltas    → emitted as plain code chunks.
                async for event in stream:
                    etype = getattr(event, "type", None)
                    if etype == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        if delta is None:
                            continue
                        dtype = getattr(delta, "type", None)
                        if dtype == "thinking_delta":
                            thinking_text = getattr(delta, "thinking", "")
                            if thinking_text:
                                yield f"\x00THINK\x00{thinking_text}"
                        elif dtype == "text_delta":
                            text_chunk = getattr(delta, "text", "")
                            if text_chunk:
                                full_response += text_chunk
                                yield text_chunk
            else:
                async for text in stream.text_stream:
                    full_response += text
                    yield text

            # Session persistence tail (always emitted)
            messages.append({"role": "assistant", "content": full_response})
            yield f"\n\n[SESSION_MESSAGES]{json.dumps(messages)}"

    except anthropic.AuthenticationError:
        yield GenerateError(code=ErrorCode.INVALID_API_KEY, message="Invalid Claude API key.").model_dump_json() + "\n"
    except anthropic.RateLimitError:
        yield GenerateError(code=ErrorCode.RATE_LIMITED, message="Claude rate limit exceeded.").model_dump_json() + "\n"
    except asyncio.CancelledError:
        logger.info("Claude stream cancelled by client.")
    except Exception as exc:
        logger.error("Claude error: %s", exc)
        yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=str(exc)).model_dump_json() + "\n"
    finally:
        if client:
            await client.close()


async def _stream_openai(
    api_key: str,
    image_b64: Optional[str],
    framework: str,
    model_id: str = "gpt4o",
    history: Optional[list[dict]] = None,
    text_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """OpenAI streaming — supports image, text-only, and session history (S4)."""
    client: Optional[openai.AsyncOpenAI] = None
    try:
        client = openai.AsyncOpenAI(api_key=api_key)
        sys_prompt = SYSTEM_PROMPT + _framework_prompt(framework)
        api_model = _model_api_id(model_id)

        if image_b64:
            user_content: list[dict] = [
                {"type": "text", "text": text_prompt or "Convert this screenshot to code. Match the design exactly."},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}", "detail": "high"}},
            ]
        else:
            user_content = [{"type": "text", "text": text_prompt or "Generate code based on the description."}]

        messages = [{"role": "system", "content": sys_prompt}] + list(history or []) + [
            {"role": "user", "content": user_content}
        ]

        stream = await client.chat.completions.create(
            model=api_model, messages=messages,
            max_tokens=4096, temperature=0.1, stream=True,
        )

        full_response = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_response += delta
                yield delta

        # Session tail (strip system message before saving)
        history_messages = [m for m in messages if m["role"] != "system"]
        history_messages.append({"role": "assistant", "content": full_response})
        yield f"\n\n[SESSION_MESSAGES]{json.dumps(history_messages)}"

    except openai.AuthenticationError:
        yield GenerateError(code=ErrorCode.INVALID_API_KEY, message="Invalid OpenAI API key.").model_dump_json() + "\n"
    except openai.RateLimitError:
        yield GenerateError(code=ErrorCode.RATE_LIMITED, message="OpenAI rate limit exceeded.").model_dump_json() + "\n"
    except asyncio.CancelledError:
        logger.info("OpenAI stream cancelled by client.")
    except Exception as exc:
        logger.error("OpenAI error: %s", exc)
        yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=str(exc)).model_dump_json() + "\n"
    finally:
        if client:
            await client.close()


async def _stream_openai_compat(
    api_key: str,
    base_url: str,
    model_api_name: str,
    image_b64: Optional[str],
    media_type: str,
    framework: str,
    supports_vision: bool = True,
    history: Optional[list[dict]] = None,
    text_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """
    OpenAI-compatible streaming for DeepSeek, Alibaba Qwen, and Moonshot (Kimi) providers.
    Uses the openai SDK with a custom base_url pointing to the provider's API.
    """
    client: Optional[openai.AsyncOpenAI] = None
    try:
        client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        sys_prompt = SYSTEM_PROMPT + _framework_prompt(framework)

        if image_b64 and supports_vision:
            user_content: list[dict] = [
                {"type": "text", "text": text_prompt or "Convert this screenshot to code. Match the design exactly."},
                {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_b64}", "detail": "high"}},
            ]
        else:
            user_content = [{"type": "text", "text": text_prompt or "Generate code based on the description."}]

        messages = [{"role": "system", "content": sys_prompt}] + list(history or []) + [
            {"role": "user", "content": user_content}
        ]

        stream = await client.chat.completions.create(
            model=model_api_name, messages=messages,
            max_tokens=4096, temperature=0.1, stream=True,
        )

        full_response = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_response += delta
                yield delta

        # Session tail (strip system message before saving)
        history_messages = [m for m in messages if m["role"] != "system"]
        history_messages.append({"role": "assistant", "content": full_response})
        yield f"\n\n[SESSION_MESSAGES]{json.dumps(history_messages)}"

    except openai.AuthenticationError:
        yield GenerateError(code=ErrorCode.INVALID_API_KEY, message="Invalid API key for this provider.").model_dump_json() + "\n"
    except openai.RateLimitError:
        yield GenerateError(code=ErrorCode.RATE_LIMITED, message="Provider rate limit exceeded.").model_dump_json() + "\n"
    except asyncio.CancelledError:
        logger.info("Compat stream cancelled by client.")
    except Exception as exc:
        logger.error("Compat provider error (%s): %s", base_url, exc)
        yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=str(exc)).model_dump_json() + "\n"
    finally:
        if client:
            await client.close()


def _gemini_text(payload: dict) -> str:
    candidates = payload.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts if isinstance(p, dict))


async def _stream_gemini(
    api_key: str,
    image_b64: Optional[str],
    framework: str,
    media_type: str = "image/png",
    model_id: str = "gemini",
    history: Optional[list[dict]] = None,
    text_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Gemini generator — supports image, text-only, session history, and multiple models (S4/S5)."""
    prompt = SYSTEM_PROMPT + _framework_prompt(framework)
    api_model = _model_api_id(model_id)

    # Build multi-turn contents from history
    contents: list[dict] = []
    for msg in (history or []):
        role = "model" if msg["role"] == "assistant" else "user"
        content = msg.get("content", "")
        if isinstance(content, str):
            contents.append({"role": role, "parts": [{"text": content}]})
        elif isinstance(content, list):
            # Extract text-only parts from prior turns (ignore images in history)
            text_parts = [{"text": p.get("text", "")} for p in content
                          if isinstance(p, dict) and p.get("type") == "text" and p.get("text")]
            if text_parts:
                contents.append({"role": role, "parts": text_parts})

    # Current user turn
    user_parts: list[dict] = []
    user_parts.append({"text": text_prompt or "Convert this screenshot to code. Match the design exactly."})
    if image_b64:
        user_parts.append({"inline_data": {"mime_type": media_type, "data": image_b64}})
    contents.append({"role": "user", "parts": user_parts})

    body = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": prompt}]},
        "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.1},
    }

    session: Optional[aiohttp.ClientSession] = None
    try:
        session = aiohttp.ClientSession()
        # Try requested model first; fall back to flash on 404
        models_to_try = [api_model] if api_model not in ("gemini-1.5-flash", "gemini-1.5-flash-latest") \
            else [api_model, "gemini-1.5-flash-latest"]

        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1/models/{model_name}:generateContent"
            async with session.post(
                url,
                headers={"Content-Type": "application/json"},
                params={"key": api_key},
                json=body,
                timeout=aiohttp.ClientTimeout(total=GENERATE_TIMEOUT),
            ) as resp:
                if resp.status == 404:
                    continue
                if resp.status == 401:
                    yield GenerateError(code=ErrorCode.INVALID_API_KEY, message="Invalid Gemini API key.").model_dump_json() + "\n"
                    return
                if not resp.ok:
                    err = await resp.text()
                    yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=f"Gemini {resp.status}: {err[:200]}").model_dump_json() + "\n"
                    return
                data = await resp.json()
                text = _gemini_text(data)
                if not text:
                    yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message="Gemini returned no output.").model_dump_json() + "\n"
                    return
                async for chunk in _stream_chunks(text):
                    yield chunk
                # Session persistence tail
                history_messages = list(history or [])
                user_text = text_prompt or "Convert this screenshot to code. Match the design exactly."
                history_messages.append({"role": "user", "content": user_text})
                history_messages.append({"role": "assistant", "content": text})
                yield f"\n\n[SESSION_MESSAGES]{json.dumps(history_messages)}"
                return

        yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message="Gemini model unavailable. Try later.").model_dump_json() + "\n"

    except aiohttp.ClientError as exc:
        yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=f"Gemini connection error: {exc}").model_dump_json() + "\n"
    except asyncio.CancelledError:
        logger.info("Gemini stream cancelled by client.")
    except Exception as exc:
        logger.error("Gemini error: %s", exc)
        yield GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=str(exc)).model_dump_json() + "\n"
    finally:
        if session and not session.closed:
            await session.close()


# ─── Video utilities (s4-b1) ────────────────────────────────────────────────
_VIDEO_EXTENSIONS = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/quicktime": ".mov",
}


def _normalize_base64_payload(data_url: str) -> tuple[bytes, str]:
    """
    Accept raw base64 or data URL and return binary payload + MIME type.
    """
    if not data_url:
        raise ValueError("Missing payload data.")

    media_type = "image/png"
    raw_payload = data_url

    if data_url.startswith("data:"):
        header, _, payload = data_url.partition(",")
        if not payload:
            raise ValueError("Malformed data URL payload.")
        media_type = header[5:].split(";", 1)[0]
        raw_payload = payload

    try:
        return base64.b64decode(raw_payload, validate=True), media_type
    except Exception as exc:
        raise ValueError("Invalid base64 payload.") from exc


async def _extract_video_frame_with_ffmpeg(
    video_path: Path,
    output_path: Path,
) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel", "error",
        "-ss", "0.5",
        "-i", str(video_path),
        "-vframes", "1",
        str(output_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        message = (stderr or b"").decode(errors="ignore").strip()
        raise RuntimeError(f"Frame extraction failed: {message or 'ffmpeg error'}")
    return output_path.read_bytes()


async def _extract_video_frame_with_playwright(
    video_path: Path,
) -> bytes:
    from playwright.async_api import async_playwright, Error as PWError

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            page = await browser.new_page(viewport={"width": 1280, "height": 720})
            await page.set_content(
                """
                <!doctype html>
                <html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;">
                  <video id="video" playsinline muted crossorigin="anonymous"></video>
                </body></html>
                """,
            )

            frame_data = await page.evaluate(
                """
                async (videoUrl) => {
                    const video = document.querySelector('#video');
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    return new Promise((resolve, reject) => {
                        video.addEventListener('loadedmetadata', async () => {
                            try {
                                const seekTime = video.duration
                                    ? Math.max(0, Math.min(video.duration - 0.01, 0.5))
                                    : 0;
                                video.currentTime = seekTime;
                            } catch (err) {
                                reject(err);
                            }
                        }, { once: true });

                        video.addEventListener('seeked', () => {
                            try {
                                canvas.width = video.videoWidth || 1;
                                canvas.height = video.videoHeight || 1;
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                resolve(canvas.toDataURL('image/png'));
                            } catch (err) {
                                reject(err);
                            }
                        }, { once: true });

                        video.addEventListener('error', () => {
                            const msg = video.error ? video.error.message : 'Video decode error';
                            reject(new Error(msg));
                        }, { once: true });

                        video.src = videoUrl;
                        video.load();
                    });
                }
                """,
                video_path.as_uri(),
            )
            if (
                not isinstance(frame_data, str)
                or not frame_data.startswith("data:image/png;base64,")
            ):
                raise RuntimeError("No frame extracted from video.")

            return base64.b64decode(frame_data.split(",", 1)[1], validate=True)
        except PWError as exc:
            raise RuntimeError(f"Playwright frame extraction failed: {exc}") from exc
        finally:
            await browser.close()


async def _extract_video_frame(video_data: bytes, media_type: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / f"input{_VIDEO_EXTENSIONS.get(media_type, '.mp4')}"
        output_path = Path(tmpdir) / "frame.png"
        input_path.write_bytes(video_data)

        if shutil.which("ffmpeg") is None:
            logger.warning("ffmpeg not found; falling back to Playwright frame extraction.")
            return await _extract_video_frame_with_playwright(input_path)

        try:
            return await _extract_video_frame_with_ffmpeg(input_path, output_path)
        except Exception:
            logger.warning("ffmpeg extraction failed; falling back to Playwright.")
            return await _extract_video_frame_with_playwright(input_path)


# ─── Session store (S4 — iterative improvement) ───────────────────────────────
# session_id → list of message dicts passed to the model
_sessions: dict[str, list[dict[str, Any]]] = {}
_sessions_lock = Lock()

def _get_session(session_id: str | None) -> list[dict[str, Any]]:
    if not session_id:
        return []
    with _sessions_lock:
        return list(_sessions.get(session_id, []))

def _save_session(session_id: str, messages: list[dict[str, Any]]) -> None:
    with _sessions_lock:
        # Keep last SESSION_MAX_TURNS user+assistant pairs
        _sessions[session_id] = messages[-(SESSION_MAX_TURNS * 2):]


# ─── Session version history (S3-S4) ─────────────────────────────────────────
_VERSION_MAX: int = 5
_session_versions: dict[str, list[str]] = {}
_versions_lock = Lock()


def _add_version(session_id: str, code: str) -> None:
    with _versions_lock:
        versions = _session_versions.setdefault(session_id, [])
        versions.append(code)
        _session_versions[session_id] = versions[-_VERSION_MAX:]


def _get_versions(session_id: str) -> list[str]:
    with _versions_lock:
        return list(_session_versions.get(session_id, []))

# ─── Generator router (selects provider based on model) ──────────────────────

def _build_generator(
    model: str,
    api_key: str,
    framework: str,
    image_b64: Optional[str] = None,
    media_type: str = "image/png",
    history: Optional[list[dict]] = None,
    text_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Route to the correct provider generator based on MODEL_OPTIONS provider field."""
    model_info = MODEL_OPTIONS[model]
    provider = model_info.provider.lower()
    if provider == "anthropic":
        return _stream_claude(api_key, image_b64, framework, media_type, model, history, text_prompt)
    elif provider == "openai":
        return _stream_openai(api_key, image_b64, framework, model, history, text_prompt)
    elif provider in ("deepseek", "alibaba", "moonshot"):
        base_url = _COMPAT_BASE_URLS[model_info.provider]
        return _stream_openai_compat(
            api_key, base_url, _model_api_id(model),
            image_b64, media_type, framework,
            supports_vision=model_info.supports_vision,
            history=history, text_prompt=text_prompt,
        )
    else:  # Google
        return _stream_gemini(api_key, image_b64, framework, media_type, model, history, text_prompt)


async def _session_aware_stream(
    gen: AsyncGenerator[str, None],
    session_id: str,
) -> AsyncGenerator[str, None]:
    """
    1. Pass through extended-thinking chunks (\x00THINK\x00 prefix) untouched
    2. Strip markdown code fences from generated code (S3-S3)
    3. Strip the [SESSION_MESSAGES] tail, persist session (S2-S4)
    4. Save generated code as a version snapshot (S3-S4)
    5. Emit [SESSION_ID] so the client knows which session to reuse
    """
    stripper = FenceStripper()
    full_code = ""

    async for chunk in gen:
        # ── Sprint 4 s4-b2: thinking chunks bypass the fence stripper ────────
        if chunk.startswith("\x00THINK\x00"):
            yield chunk   # pass-through; frontend routes to thinking panel
            continue

        if "\n\n[SESSION_MESSAGES]" in chunk:
            parts = chunk.split("\n\n[SESSION_MESSAGES]", 1)
            # Flush the fence stripper for any code in this chunk
            code_here = stripper.feed(parts[0]) if parts[0] else ""
            tail = stripper.flush()
            to_emit = code_here + tail
            full_code += to_emit
            if to_emit:
                yield to_emit
            # Persist session messages (post-process assistant content)
            try:
                messages = json.loads(parts[1])
                if messages and messages[-1].get("role") == "assistant":
                    raw = messages[-1].get("content", "")
                    if isinstance(raw, str):
                        messages[-1]["content"] = normalize_code(raw)
                _save_session(session_id, messages)
            except Exception as exc:
                logger.error("Session save error: %s", exc)
            # Save version snapshot
            if full_code.strip():
                _add_version(session_id, normalize_code(full_code))
            yield f"\n\n[SESSION_ID]{session_id}"
        else:
            out = stripper.feed(chunk)
            full_code += out
            if out:
                yield out

    # Flush fence stripper in case stream ended without [SESSION_MESSAGES]
    tail = stripper.flush()
    if tail:
        full_code += tail
        yield tail


async def _timed_stream(
    gen: AsyncGenerator[str, None],
) -> AsyncGenerator[str, None]:
    """Wrap a generator with GENERATE_TIMEOUT; emit error chunk on timeout."""
    try:
        async with asyncio.timeout(GENERATE_TIMEOUT):
            async for chunk in gen:
                yield chunk
    except asyncio.TimeoutError:
        yield GenerateError(
            code=ErrorCode.TIMEOUT,
            message=f"Generation timed out after {GENERATE_TIMEOUT}s.",
        ).model_dump_json() + "\n"


# ─── URL screenshot service (S3) ──────────────────────────────────────────────

async def take_screenshot(url: str) -> bytes:
    """
    Render the page with Playwright and return a PNG screenshot.
    Handles redirects, timeouts, and SSL errors gracefully.
    """
    from playwright.async_api import async_playwright, Error as PWError

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            ctx = await browser.new_context(
                ignore_https_errors=True,
                viewport={"width": 1440, "height": 900},
            )
            page = await ctx.new_page()
            await page.goto(
                url,
                timeout=URL_SCREENSHOT_TIMEOUT * 1000,
                wait_until="networkidle",
            )
            png = await page.screenshot(full_page=False)
            return png
        except PWError as exc:
            raise RuntimeError(f"Screenshot failed: {exc}") from exc
        finally:
            await browser.close()

# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PicToFrontend API starting — CORS origins: %s", ALLOWED_ORIGINS)
    await db.init_db()          # Sprint 4: s4-b4 — initialise SQLite schema
    logger.info("SQLite DB initialised at: %s", db.DB_PATH)
    observe._get_client()       # Sprint 4: s4-b5 — warm up Langfuse client (logs once)
    yield
    observe.flush()             # Sprint 4: s4-b5 — ensure all Langfuse events are sent
    logger.info("PicToFrontend API shutting down.")


# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="PicToFrontend API",
    description="Convert screenshots to production-ready code using AI",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS (S11 — no wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


# ─── Rate-limit middleware (S12) ──────────────────────────────────────────────
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        ip = request.client.host if request.client else "unknown"
        if not _check_rate_limit(ip):
            logger.warning("Rate limit exceeded for IP: %s", ip)
            return JSONResponse(
                status_code=429,
                content=ErrorResponse(
                    code=ErrorCode.RATE_LIMITED,
                    message="Too many requests. Please wait a moment.",
                ).model_dump(),
            )
    return await call_next(request)


# ─── Metrics middleware (S3-S9) ───────────────────────────────────────────────
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = monotonic()
    response = await call_next(request)
    latency = monotonic() - start
    is_error = response.status_code >= 400
    endpoint = request.url.path
    _metrics.record_request(endpoint, latency, is_error=is_error)
    return response


# ─── Exception handler for standardised errors (S3) ──────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        return JSONResponse(status_code=exc.status_code, content=detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            code=ErrorCode.INTERNAL_ERROR,
            message=str(detail),
        ).model_dump(),
    )


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"service": "PicToFrontend API", "version": "2.0.0", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/models")
async def get_models():
    return {
        "models": [m.model_dump() for m in MODEL_OPTIONS.values()],
        "frameworks": FRAMEWORKS,
    }


@app.post("/api/generate")
async def generate_code(
    request: Request,
    image: UploadFile = File(...),
    api_key: str = File(...),
    model: str = File(default="claude"),
    framework: str = File(default="html"),
    session_id: Optional[str] = Form(default=None),
):
    """
    Convert an uploaded screenshot to code (streaming response).

    - image      : PNG / JPG / WEBP — max 20 MB
    - api_key    : Provider API key (logged as sk-***)
    - model      : claude | claude-opus | claude-haiku | gpt4o | gpt4o-mini | gpt4-turbo | gemini | gemini-pro
    - framework  : html | react | vue | bootstrap
    - session_id : Optional — enables iterative improvement (S4)
    """

    # ── Validate MIME type ────────────────────────────────────────────────────
    if image.content_type not in ALLOWED_MIME_TYPES:
        raise _error(
            ErrorCode.INVALID_MIME,
            f"Unsupported file type '{image.content_type}'. Allowed: {sorted(ALLOWED_MIME_TYPES)}",
        )

    # ── Validate model ────────────────────────────────────────────────────────
    if not model or model not in MODEL_OPTIONS:
        raise _error(
            ErrorCode.INVALID_MODEL,
            f"Unknown model '{model}'. Allowed: {list(MODEL_OPTIONS)}",
            status=422,
        )

    # ── Validate framework ────────────────────────────────────────────────────
    if framework not in ALLOWED_FRAMEWORKS:
        raise _error(
            ErrorCode.INVALID_FRAMEWORK,
            f"Unknown framework '{framework}'. Allowed: {sorted(ALLOWED_FRAMEWORKS)}",
            status=422,
        )

    # ── Validate API key presence ─────────────────────────────────────────────
    key = api_key.strip()
    if not key:
        raise _error(ErrorCode.INVALID_API_KEY, "API key is required.")

    # ── Read & validate size ──────────────────────────────────────────────────
    image_data = await image.read()
    if len(image_data) > MAX_FILE_SIZE:
        raise _error(
            ErrorCode.FILE_TOO_LARGE,
            f"File too large ({len(image_data) // 1024 // 1024} MB). Max 20 MB.",
        )

    media_type = image.content_type or "image/png"
    image_b64 = _b64(image_data)

    # ── Session history (S4) ──────────────────────────────────────────────────
    sid = session_id or str(uuid.uuid4())
    history = _get_session(session_id) if session_id else []

    logger.info(
        "Generate request — model=%s framework=%s size=%d key=%s session=%s",
        model, framework, len(image_data), mask_api_key(key), sid,
    )

    gen = _build_generator(model, key, framework, image_b64, media_type, history)
    stream = _session_aware_stream(gen, sid)

    # Sprint 4 s4-b5 — Langfuse observability (no-op when keys not set)
    observe.log_event("generate.screenshot", {"model": model, "framework": framework})

    return StreamingResponse(
        _timed_stream(stream),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/generate/from-url")
async def generate_from_url(request: Request, req: URLGenerateRequest):
    """
    Screenshot a URL and convert it to code (streaming response).

    - url        : Public HTTP/HTTPS URL to screenshot
    - api_key    : Provider API key
    - model      : Model ID (same options as /api/generate)
    - framework  : html | react | vue | bootstrap
    - session_id : Optional session for iterative improvement (S4)
    """
    # ── Validate model ────────────────────────────────────────────────────────
    if not req.model or req.model not in MODEL_OPTIONS:
        raise _error(ErrorCode.INVALID_MODEL, f"Unknown model '{req.model}'.", status=422)

    if req.framework not in ALLOWED_FRAMEWORKS:
        raise _error(ErrorCode.INVALID_FRAMEWORK, f"Unknown framework '{req.framework}'.", status=422)

    key = req.api_key.strip()
    if not key:
        raise _error(ErrorCode.INVALID_API_KEY, "API key is required.")

    # ── Validate & sanitise URL (S11) ─────────────────────────────────────────
    try:
        safe_url = validate_url(req.url)
    except PermissionError as exc:
        raise _error(ErrorCode.URL_BLOCKED, str(exc))
    except ValueError as exc:
        raise _error(ErrorCode.INVALID_URL, str(exc))

    logger.info("from-url request — url=%s model=%s key=%s", safe_url, req.model, mask_api_key(key))

    # ── Take screenshot ───────────────────────────────────────────────────────
    try:
        image_data = await take_screenshot(safe_url)
    except Exception as exc:
        raise _error(ErrorCode.URL_FETCH_FAILED, f"Could not screenshot URL: {exc}")

    image_b64 = _b64(image_data)
    sid = req.session_id or str(uuid.uuid4())
    history = _get_session(req.session_id) if req.session_id else []

    gen = _build_generator(req.model, key, req.framework, image_b64, "image/png", history)
    stream = _session_aware_stream(gen, sid)

    observe.log_event("generate.from_url", {"model": req.model, "framework": req.framework})

    return StreamingResponse(
        _timed_stream(stream),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/generate/from-text")
async def generate_from_text(request: Request, req: TextGenerateRequest):
    """
    Generate code from a text description (streaming response).

    - description: Plain-text description of the UI to generate (10–4000 chars)
    - api_key    : Provider API key
    - model      : Model ID
    - framework  : html | react | vue | bootstrap
    - session_id : Optional session for iterative improvement (S4)
    """
    # ── Validate model ────────────────────────────────────────────────────────
    if not req.model or req.model not in MODEL_OPTIONS:
        raise _error(ErrorCode.INVALID_MODEL, f"Unknown model '{req.model}'.", status=422)

    if req.framework not in ALLOWED_FRAMEWORKS:
        raise _error(ErrorCode.INVALID_FRAMEWORK, f"Unknown framework '{req.framework}'.", status=422)

    key = req.api_key.strip()
    if not key:
        raise _error(ErrorCode.INVALID_API_KEY, "API key is required.")

    logger.info("from-text request — model=%s framework=%s key=%s", req.model, req.framework, mask_api_key(key))

    sid = req.session_id or str(uuid.uuid4())
    history = _get_session(req.session_id) if req.session_id else []

    text_prompt = (
        f"Create a complete, production-ready UI based on this description:\n\n{req.description}"
    )

    gen = _build_generator(req.model, key, req.framework, None, "image/png", history, text_prompt)
    stream = _session_aware_stream(gen, sid)

    observe.log_event("generate.from_text", {"model": req.model, "framework": req.framework})

    return StreamingResponse(
        _timed_stream(stream),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── s4-b1 — Video → Kod endpoint (multipart upload + frame extraction) ──────
@app.post("/api/generate/video")
async def generate_from_video(
    request: Request,
    video: UploadFile = File(...),
    api_key: str = File(...),
    model: str = File(default="claude"),
    framework: str = File(default="html"),
    session_id: Optional[str] = Form(default=None),
):
    """
    Convert an uploaded video to code by extracting a representative frame.

    - video      : MP4 / WebM / MOV — max 20 MB
    - api_key    : Provider API key (logged as sk-***)
    - model      : claude | claude-opus | claude-haiku | claude-sonnet-thinking | gpt4o | gpt4o-mini | gpt4-turbo | gemini | gemini-pro
    - framework  : html | react | vue | bootstrap
    - session_id : Optional — enables iterative improvement (S4)
    """

    if not video.content_type or video.content_type not in ALLOWED_VIDEO_MIME_TYPES:
        raise _error(
            ErrorCode.INVALID_MIME,
            f"Unsupported video type '{video.content_type}'. Allowed: {sorted(ALLOWED_VIDEO_MIME_TYPES)}",
        )

    if model not in MODEL_OPTIONS:
        raise _error(
            ErrorCode.INVALID_MODEL,
            f"Unknown model '{model}'. Allowed: {list(MODEL_OPTIONS)}",
            status=422,
        )

    if framework not in ALLOWED_FRAMEWORKS:
        raise _error(
            ErrorCode.INVALID_FRAMEWORK,
            f"Unknown framework '{framework}'. Allowed: {sorted(ALLOWED_FRAMEWORKS)}",
            status=422,
        )

    key = api_key.strip()
    if not key:
        raise _error(ErrorCode.INVALID_API_KEY, "API key is required.")

    video_data = await video.read()
    if len(video_data) > MAX_FILE_SIZE:
        raise _error(
            ErrorCode.FILE_TOO_LARGE,
            f"File too large ({len(video_data) // 1024 // 1024} MB). Max 20 MB.",
        )

    try:
        frame = await _extract_video_frame(video_data, video.content_type or "video/mp4")
    except Exception as exc:
        raise _error(ErrorCode.UPSTREAM_ERROR, f"Could not extract video frame: {exc}") from exc

    image_b64 = _b64(frame)
    sid = session_id or str(uuid.uuid4())
    history = _get_session(session_id) if session_id else []

    logger.info(
        "Generate video request — model=%s framework=%s size=%d key=%s session=%s",
        model, framework, len(video_data), mask_api_key(key), sid,
    )

    gen = _build_generator(model, key, framework, image_b64, "image/png", history)
    stream = _session_aware_stream(gen, sid)
    observe.log_event("generate.from_video", {"model": model, "framework": framework})

    return StreamingResponse(
        _timed_stream(stream),
        media_type="text/plain",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ─── s3-b1 — WebSocket layer (feature flag → HTTP fallback kept) ─────────────
@app.websocket("/api/generate/ws")
async def generate_ws(websocket: WebSocket):
    if not WEBSOCKET_STREAMING_ENABLED:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        payload_data = await websocket.receive_json()
        payload = GenerateWsRequest.model_validate(payload_data)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await websocket.send_text(
            GenerateError(code=ErrorCode.INTERNAL_ERROR, message=f"Invalid websocket payload: {exc}").model_dump_json()
        )
        await websocket.close(code=1003)
        return

    try:
        if not payload.api_key.strip():
            raise ValueError("api_key is required.")
        if payload.model not in MODEL_OPTIONS:
            raise ValueError(f"Unknown model '{payload.model}'.")
        if payload.framework not in ALLOWED_FRAMEWORKS:
            raise ValueError(f"Unknown framework '{payload.framework}'.")

        key = payload.api_key.strip()
        sid = payload.session_id or str(uuid.uuid4())
        mode = payload.input_mode

        if mode == "text":
            if not payload.description or len(payload.description.strip()) < 10:
                raise ValueError("description must be at least 10 characters.")
            history = _get_session(payload.session_id) if payload.session_id else []
            stream_prompt = payload.description
            gen = _build_generator(
                payload.model,
                key,
                payload.framework,
                None,
                "image/png",
                history,
                stream_prompt,
            )

        elif mode == "url":
            if not payload.url:
                raise ValueError("url is required for url mode.")
            safe_url = validate_url(payload.url.strip())
            image_data = await take_screenshot(safe_url)
            image_b64 = _b64(image_data)
            history = _get_session(payload.session_id) if payload.session_id else []
            gen = _build_generator(
                payload.model,
                key,
                payload.framework,
                image_b64,
                "image/png",
                history,
            )

        elif mode == "screenshot":
            if not payload.image_b64:
                raise ValueError("image_b64 is required for screenshot mode.")
            image_data, image_type = _normalize_base64_payload(payload.image_b64)
            history = _get_session(payload.session_id) if payload.session_id else []
            gen = _build_generator(
                payload.model,
                key,
                payload.framework,
                _b64(image_data),
                image_type or "image/png",
                history,
            )

        elif mode == "video":
            if not payload.video_b64:
                raise ValueError("video_b64 is required for video mode.")
            video_data, media_type = _normalize_base64_payload(payload.video_b64)
            frame = await _extract_video_frame(video_data, media_type or "video/mp4")
            history = _get_session(payload.session_id) if payload.session_id else []
            gen = _build_generator(
                payload.model,
                key,
                payload.framework,
                _b64(frame),
                "image/png",
                history,
            )
        else:
            raise ValueError(f"Unsupported input mode: {mode}")

    except ValueError as exc:
        await websocket.send_text(
            GenerateError(code=ErrorCode.INTERNAL_ERROR, message=str(exc)).model_dump_json()
        )
        await websocket.close(code=1003)
        return

    stream = _session_aware_stream(_timed_stream(gen), sid)
    try:
        async for chunk in stream:
            await websocket.send_text(chunk)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected during stream.")
    except Exception as exc:
        logger.error("WebSocket stream error: %s", exc)
        await websocket.send_text(
            GenerateError(code=ErrorCode.UPSTREAM_ERROR, message=str(exc)).model_dump_json()
        )
    finally:
        try:
            await websocket.close()
        except RuntimeError:
            pass


# ─── Sprint 3 endpoints ───────────────────────────────────────────────────────

@app.get("/api/metrics")
async def get_metrics():
    """S3-S9 — In-memory metrics: request count, error rate, latency percentiles."""
    return _metrics.get_metrics()


@app.get("/api/sessions/{session_id}/versions")
async def get_session_versions(session_id: str):
    """S3-S4 — Return the last up to 5 generated code versions for a session."""
    versions = _get_versions(session_id)
    return {
        "session_id": session_id,
        "count": len(versions),
        "versions": versions,  # oldest → newest
    }


# ─── Sprint 4: Auth schemas (s4-b3) ──────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str = PydanticField(..., description="User email address")
    password: str = PydanticField(..., min_length=8, description="Minimum 8 characters")


class LoginRequest(BaseModel):
    email: str
    password: str


class GenerateWsRequest(BaseModel):
    input_mode: Literal["screenshot", "url", "text", "video"]
    api_key: str
    model: str = "claude"
    framework: str = "html"
    session_id: Optional[str] = None
    image_b64: Optional[str] = None
    video_b64: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None


# ─── Sprint 4: Auth endpoints (s4-b3 + s4-g1) ────────────────────────────────

@app.post("/api/auth/register", status_code=201)
async def auth_register(req: RegisterRequest):
    """
    Register a new user account.
    Returns a JWT access token valid for 7 days.
    New accounts start with 100 credits.
    """
    try:
        user = auth_module.register_user(req.email, req.password)
    except ValueError as exc:
        msg = str(exc)
        if "already registered" in msg:
            raise _error(ErrorCode.INTERNAL_ERROR, msg, status=409)
        raise _error(ErrorCode.INTERNAL_ERROR, msg, status=400)

    # Seed the credit row in SQLite
    await db.get_balance(user.id)

    token = auth_module.create_access_token(user.id, user.email)
    logger.info("New user registered: %s", user.email)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      user.id,
        "email":        user.email,
    }


@app.post("/api/auth/login")
async def auth_login(req: LoginRequest):
    """
    Authenticate and return a JWT access token.
    """
    user = auth_module.authenticate_user(req.email, req.password)
    if not user:
        raise _error(ErrorCode.INVALID_API_KEY, "Invalid email or password.", status=401)

    token = auth_module.create_access_token(user.id, user.email)
    logger.info("User logged in: %s", user.email)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      user.id,
        "email":        user.email,
    }


@app.get("/api/auth/github/login")
async def github_login():
    """Redirect user to GitHub OAuth login."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured.")
    redirect_uri = f"https://github.com/login/oauth/authorize?client_id={GITHUB_CLIENT_ID}&scope=user:email"
    return RedirectResponse(redirect_uri)


@app.get("/api/auth/github/callback")
async def github_callback(code: str):
    """
    Exchange code for an access token, fetch user email, register/login,
    and redirect to frontend with JWT token in query params.
    """
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured.")

    async with aiohttp.ClientSession() as session:
        # 1. Exchange code for access token
        token_url = "https://github.com/login/oauth/access_token"
        headers = {"Accept": "application/json"}
        data = {
            "client_id": GITHUB_CLIENT_ID,
            "client_secret": GITHUB_CLIENT_SECRET,
            "code": code,
        }
        async with session.post(token_url, json=data, headers=headers) as resp:
            token_data = await resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail="Failed to retrieve GitHub access token.")

        # 2. Get user emails
        email_url = "https://api.github.com/user/emails"
        auth_headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.v3+json"}
        async with session.get(email_url, headers=auth_headers) as resp:
            if not resp.ok:
                raise HTTPException(status_code=400, detail="Failed to fetch GitHub email.")
            emails = await resp.json()

        # Find primary or first verified email
        primary_email = None
        for email_info in emails:
            if email_info.get("primary") and email_info.get("verified"):
                primary_email = email_info.get("email")
                break
        if not primary_email and emails:
            primary_email = emails[0].get("email")

        if not primary_email:
            raise HTTPException(status_code=400, detail="No email found in GitHub account.")

        # 3. Register or get user
        try:
            user = auth_module.register_oauth_user(primary_email)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        # Ensure they have a credit balance record (similar to normal register)
        await db.get_balance(user.id)

        # 4. Generate our JWT Token and redirect back to frontend
        ptf_token = auth_module.create_access_token(user.id, user.email)
        logger.info("GitHub user logged in over OAuth: %s", user.email)

        frontend_redirect = f"{FRONTEND_URL}/app?token={ptf_token}&email={user.email}&userId={user.id}"
        return RedirectResponse(frontend_redirect)


@app.get("/api/auth/google/login")
async def google_login():
    """Redirect user to Google OAuth login."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured.")
    
    redirect_uri = f"https://accounts.google.com/o/oauth2/v2/auth?" \
                   f"client_id={GOOGLE_CLIENT_ID}&" \
                   f"response_type=code&" \
                   f"scope=openid%20email%20profile&" \
                   f"redirect_uri={FRONTEND_URL}/api/auth/google/callback"
    return RedirectResponse(redirect_uri)


@app.get("/api/auth/google/callback")
async def google_callback(code: str):
    """
    Exchange code for an access token via Google API, fetch user email, 
    register/login, and redirect to frontend with JWT token in query params.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth not configured.")

    async with aiohttp.ClientSession() as session:
        # 1. Exchange code for access token
        token_url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": f"{FRONTEND_URL}/api/auth/google/callback"
        }
        async with session.post(token_url, data=data) as resp:
            token_data = await resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                raise HTTPException(status_code=400, detail="Failed to retrieve Google access token.")

        # 2. Get user profile / email
        userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        auth_headers = {"Authorization": f"Bearer {access_token}"}
        async with session.get(userinfo_url, headers=auth_headers) as resp:
            if not resp.ok:
                raise HTTPException(status_code=400, detail="Failed to fetch Google user info.")
            user_info = await resp.json()

        primary_email = user_info.get("email")
        if not primary_email:
            raise HTTPException(status_code=400, detail="No email found in Google account.")

        # 3. Register or get user
        try:
            user = auth_module.register_oauth_user(primary_email)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))

        # Ensure they have a credit balance record (similar to normal register)
        await db.get_balance(user.id)

        # 4. Generate our JWT Token and redirect back to frontend
        ptf_token = auth_module.create_access_token(user.id, user.email)
        logger.info("Google user logged in over OAuth: %s", user.email)

        frontend_redirect = f"{FRONTEND_URL}/app?token={ptf_token}&email={user.email}&userId={user.id}"
        return RedirectResponse(frontend_redirect)


@app.post("/api/auth/refresh")
async def auth_refresh(
    current_user: auth_module.UserRecord = Depends(auth_module.get_current_user),
):
    """
    Renew the authenticated user's JWT token.
    """
    token = auth_module.create_access_token(current_user.id, current_user.email)
    logger.info("Token refreshed for user: %s", current_user.email)
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user_id":      current_user.id,
        "email":        current_user.email,
    }


@app.get("/api/auth/me")
async def auth_me(
    current_user: auth_module.UserRecord = Depends(auth_module.get_current_user),
):
    """Return the authenticated user's profile and credit balance."""
    balance = await db.get_balance(current_user.id)
    return {
        "user_id":    current_user.id,
        "email":      current_user.email,
        "created_at": current_user.created_at.isoformat(),
        "balance":    balance,
    }


# ─── Sprint 4: Credit endpoints (s4-b4) ──────────────────────────────────────

@app.get("/api/credits/balance")
async def credits_balance(
    current_user: auth_module.UserRecord = Depends(auth_module.get_current_user),
):
    """Return the authenticated user's current credit balance."""
    balance = await db.get_balance(current_user.id)
    return {"user_id": current_user.id, "balance": balance}


@app.get("/api/credits/history")
async def credits_history(
    current_user: auth_module.UserRecord = Depends(auth_module.get_current_user),
):
    """Return the last 20 credit transactions for the authenticated user."""
    ledger = await db.get_ledger(current_user.id)
    return {"user_id": current_user.id, "transactions": ledger}


@app.post("/api/credits/topup")
async def credits_topup(
    amount: int = Body(50, ge=1, le=1000, description="Credits to add (1–1000)"),
    current_user: auth_module.UserRecord = Depends(auth_module.get_current_user),
):
    """
    Add credits to the authenticated user's balance.
    (Development/test endpoint — no real payment processing.)
    """
    new_balance = await db.add_credits(current_user.id, amount, note="topup")
    return {"user_id": current_user.id, "added": amount, "balance": new_balance}


# ─── A/B Compare endpoint (s4-q1) ─────────────────────────────────────────────

class CompareRequest(BaseModel):
    """Request body for /api/compare — A/B pairwise model comparison."""
    api_key: str = PydanticField(..., description="Provider API key (must work for both models)")
    model_a: str = PydanticField(..., description="First model ID (e.g. 'claude')")
    model_b: str = PydanticField(..., description="Second model ID (e.g. 'gpt4o')")
    framework: str = PydanticField("html", description="Output framework")
    # One of the following must be provided
    image_b64: Optional[str] = PydanticField(None, description="Base64-encoded image")
    media_type: str = PydanticField("image/png", description="Image MIME type")
    text_prompt: Optional[str] = PydanticField(None, description="Text prompt (if no image)")


@app.post("/api/compare")
async def compare_models(req: CompareRequest):
    """
    Sprint 4 — s4-q1: A/B test framework.

    Run the same input through two models concurrently and return both
    generated outputs as JSON for pairwise comparison.

    Returns:
        {
          "model_a": { "model": "claude", "output": "...", "error": null },
          "model_b": { "model": "gpt4o",  "output": "...", "error": null },
        }
    """
    key = req.api_key.strip()
    if not key:
        raise _error(ErrorCode.INVALID_API_KEY, "API key is required.")

    for m in (req.model_a, req.model_b):
        if m not in MODEL_OPTIONS:
            raise _error(
                ErrorCode.INVALID_MODEL,
                f"Unknown model '{m}'. Allowed: {list(MODEL_OPTIONS)}",
                status=422,
            )

    if req.framework not in ALLOWED_FRAMEWORKS:
        raise _error(
            ErrorCode.INVALID_FRAMEWORK,
            f"Unknown framework '{req.framework}'. Allowed: {sorted(ALLOWED_FRAMEWORKS)}",
            status=422,
        )

    if not req.image_b64 and not req.text_prompt:
        raise HTTPException(status_code=422, detail="Provide image_b64 or text_prompt.")

    async def _collect(model: str) -> dict:
        """Run one model and collect full streamed output into a string."""
        try:
            gen = _build_generator(
                model, key, req.framework,
                req.image_b64, req.media_type,
                history=None,
                text_prompt=req.text_prompt,
            )
            chunks: list[str] = []
            async with asyncio.timeout(GENERATE_TIMEOUT):
                async for chunk in gen:
                    if chunk.startswith("\x00THINK\x00"):
                        continue  # skip thinking blocks from output
                    chunks.append(chunk)
            return {"model": model, "output": "".join(chunks), "error": None}
        except asyncio.TimeoutError:
            return {"model": model, "output": "", "error": "timeout"}
        except Exception as exc:
            return {"model": model, "output": "", "error": str(exc)}

    observe.log_event("compare.start", {"model_a": req.model_a, "model_b": req.model_b})

    result_a, result_b = await asyncio.gather(
        _collect(req.model_a),
        _collect(req.model_b),
    )

    return {"model_a": result_a, "model_b": result_b}


# ─── Dev entrypoint ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
