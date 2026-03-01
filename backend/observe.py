"""
PicToFrontend — Langfuse AI observability layer.

Sprint 4 — s4-b5
Langfuse observability entegrasyonu: AI çağrı izleme, maliyet, latency.

Activation:
  Set LANGFUSE_SECRET_KEY + LANGFUSE_PUBLIC_KEY in .env
  Optionally set LANGFUSE_HOST (default: https://cloud.langfuse.com)

When keys are absent the module stubs all calls so the app runs unmodified.
"""

import logging
import os
from time import monotonic
from typing import Any, Optional

logger = logging.getLogger("pictofrontend.observe")

# ─── Langfuse client (lazy init) ─────────────────────────────────────────────

_langfuse: Any = None
_enabled: bool = False


def _get_client() -> Optional[Any]:
    global _langfuse, _enabled
    if _langfuse is not None:
        return _langfuse if _enabled else None

    secret_key = os.getenv("LANGFUSE_SECRET_KEY")
    public_key  = os.getenv("LANGFUSE_PUBLIC_KEY")

    if not (secret_key and public_key):
        logger.info(
            "Langfuse observability disabled — "
            "set LANGFUSE_SECRET_KEY + LANGFUSE_PUBLIC_KEY to enable."
        )
        _enabled = False
        _langfuse = object()  # sentinel so we only log once
        return None

    try:
        from langfuse import Langfuse
        host = os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")
        _langfuse = Langfuse(
            secret_key=secret_key,
            public_key=public_key,
            host=host,
        )
        _enabled = True
        logger.info("Langfuse observability enabled — host: %s", host)
        return _langfuse
    except Exception as exc:
        logger.warning("Langfuse init failed: %s", exc)
        _enabled = False
        _langfuse = object()
        return None


# ─── Context manager: trace one AI generation call ───────────────────────────

class GenerationTrace:
    """
    Context manager that wraps a single AI generation with Langfuse tracing.

    Usage:
        async with GenerationTrace(model="claude", endpoint="/api/generate") as trace:
            # call AI...
            trace.set_result(input_tokens=..., output_tokens=..., cost_usd=...)
    """

    def __init__(
        self,
        model: str,
        endpoint: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        self.model      = model
        self.endpoint   = endpoint
        self.user_id    = user_id
        self.session_id = session_id
        self.metadata   = metadata or {}
        self._trace: Any = None
        self._gen: Any   = None
        self._start: float = 0.0

    def __enter__(self) -> "GenerationTrace":
        self._start = monotonic()
        client = _get_client()
        if client and _enabled:
            try:
                self._trace = client.trace(
                    name=f"generate:{self.endpoint}",
                    user_id=self.user_id,
                    session_id=self.session_id,
                    metadata=self.metadata,
                )
                self._gen = self._trace.generation(
                    name=self.model,
                    model=self.model,
                    metadata=self.metadata,
                )
            except Exception as exc:
                logger.debug("Langfuse trace start error: %s", exc)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        latency_ms = int((monotonic() - self._start) * 1000)
        if self._gen:
            try:
                status = "ERROR" if exc_type else "SUCCESS"
                self._gen.end(
                    metadata={**self.metadata, "latency_ms": latency_ms, "status": status},
                )
            except Exception as exc:
                logger.debug("Langfuse trace end error: %s", exc)
        return None   # don't suppress exceptions

    # Optional: call after streaming completes to record token usage
    def set_usage(
        self,
        input_tokens: int = 0,
        output_tokens: int = 0,
        cost_usd: Optional[float] = None,
    ) -> None:
        if not self._gen:
            return
        try:
            usage: dict = {"input": input_tokens, "output": output_tokens}
            if cost_usd is not None:
                usage["unit"] = "TOKENS"
            self._gen.update(
                usage=usage,
                metadata={**self.metadata, "cost_usd": cost_usd},
            )
        except Exception as exc:
            logger.debug("Langfuse usage update error: %s", exc)


# ─── Simple event logger (non-blocking) ──────────────────────────────────────

def log_event(name: str, metadata: Optional[dict] = None) -> None:
    """Fire-and-forget: log a named event to Langfuse."""
    client = _get_client()
    if not (client and _enabled):
        return
    try:
        client.event(name=name, metadata=metadata or {})
    except Exception as exc:
        logger.debug("Langfuse event error: %s", exc)


def flush() -> None:
    """Call at shutdown to ensure all events are sent."""
    client = _get_client()
    if client and _enabled:
        try:
            client.flush()
            logger.info("Langfuse flush completed.")
        except Exception as exc:
            logger.debug("Langfuse flush error: %s", exc)
