"""
Sprint 3 S3 — Code post-processing: normalize and clean AI-generated code.

Problems addressed:
  - AI sometimes wraps output in markdown code fences (```html ... ```)
  - CRLF line endings returned by some providers
  - Stray explanation text before <!DOCTYPE html>
"""

import re

# Matches opening fence: ```html, ```jsx, ```vue, ``` (with optional language tag)
_OPEN_FENCE = re.compile(r"^```[a-z]*\s*\n?", re.IGNORECASE)

# Matches closing fence at end of string
_CLOSE_FENCE = re.compile(r"\n?```\s*$")

# CRLF → LF
_CRLF = re.compile(r"\r\n")

# Opening of a real HTML doc or common framework output
_DOC_STARTERS = (
    "<!DOCTYPE", "<!doctype",
    "<html",
    "import ", "from ",   # React/Vue
    "<template",          # Vue
    "function ", "const ", "export ",  # JS components
)


def strip_code_fences(text: str) -> str:
    """Remove markdown code fences and normalize a complete code string."""
    text = _CRLF.sub("\n", text).strip()
    text = _OPEN_FENCE.sub("", text, count=1)
    text = _CLOSE_FENCE.sub("", text)
    return text.strip()


def normalize_code(text: str) -> str:
    """
    Full normalization pipeline for a complete (non-streaming) code string:
    1. Normalize line endings
    2. Strip code fences
    3. If there's preamble text before the actual code, drop it
    """
    text = strip_code_fences(text)

    # If the code starts with explanation text before the actual doc/component,
    # try to find where the real code begins and trim the preamble.
    if not any(text.startswith(s) for s in _DOC_STARTERS):
        for starter in _DOC_STARTERS:
            idx = text.find("\n" + starter)
            if idx != -1:
                text = text[idx + 1:]  # skip the leading newline
                break
            idx = text.find(starter)
            if idx > 0 and idx < 200:  # preamble shorter than 200 chars
                text = text[idx:]
                break

    return text.strip()


class FenceStripper:
    """
    Stateful, streaming-aware fence stripper.

    Feed chunks to feed(); call flush() at end of stream.
    Safe to use with SESSION_MESSAGES/SESSION_ID pass-through chunks.
    """

    _PREFIX_THRESHOLD = 40  # chars needed before committing to fence-strip

    def __init__(self) -> None:
        self._buf = ""        # prefix accumulation buffer
        self._checked = False  # have we decided on fence presence?
        self._tail = ""       # rolling tail buffer (last 8 chars) for closing fence

    def feed(self, chunk: str) -> str:
        """Process one stream chunk; returns text safe to emit (may be empty)."""
        chunk = _CRLF.sub("\n", chunk)

        if not self._checked:
            self._buf += chunk
            if len(self._buf) < self._PREFIX_THRESHOLD:
                return ""   # still accumulating prefix
            self._checked = True
            self._buf = _OPEN_FENCE.sub("", self._buf, count=1)
            return self._push(self._buf)

        return self._push(chunk)

    def _push(self, text: str) -> str:
        """Route text through the rolling tail buffer; return safe-to-emit portion."""
        combined = self._tail + text
        safe_len = max(0, len(combined) - 8)
        self._tail = combined[safe_len:]
        return combined[:safe_len]

    def flush(self) -> str:
        """Must be called at end of stream to emit buffered tail (stripped of closing fence)."""
        if not self._checked:
            # Stream shorter than threshold — strip fences from whatever we have
            self._buf = _OPEN_FENCE.sub("", self._buf, count=1)
            out = _CLOSE_FENCE.sub("", self._buf).rstrip()
        else:
            out = _CLOSE_FENCE.sub("", self._tail).rstrip()
        self._buf = self._tail = ""
        return out
