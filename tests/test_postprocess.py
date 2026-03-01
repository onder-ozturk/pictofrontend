"""
Unit tests for backend/postprocess.py
Covers: strip_code_fences, normalize_code, FenceStripper

Sprint 3 — S3 (streaming fence stripper & code normalizer)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import pytest
from postprocess import FenceStripper, normalize_code, strip_code_fences


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _run_stripper(chunks: list[str]) -> str:
    """Feed chunks through FenceStripper and collect full output."""
    s = FenceStripper()
    out = ""
    for c in chunks:
        out += s.feed(c)
    out += s.flush()
    return out


# ─── strip_code_fences ────────────────────────────────────────────────────────

def test_strip_html_fence():
    raw = "```html\n<!DOCTYPE html>\n<html></html>\n```"
    assert strip_code_fences(raw) == "<!DOCTYPE html>\n<html></html>"


def test_strip_generic_fence():
    raw = "```\n<div>hello</div>\n```"
    assert strip_code_fences(raw) == "<div>hello</div>"


def test_strip_jsx_fence():
    raw = "```jsx\nfunction App() { return <div/>; }\n```"
    assert strip_code_fences(raw) == "function App() { return <div/>; }"


def test_strip_vue_fence():
    raw = "```vue\n<template><div/></template>\n```"
    assert strip_code_fences(raw) == "<template><div/></template>"


def test_strip_svelte_fence():
    raw = "```svelte\n<script>let x = 1;</script>\n<p>{x}</p>\n```"
    result = strip_code_fences(raw)
    assert "```" not in result
    assert "<p>{x}</p>" in result


def test_no_fence_unchanged():
    raw = "<!DOCTYPE html>\n<html></html>"
    assert strip_code_fences(raw) == raw


def test_crlf_normalized():
    raw = "hello\r\nworld\r\n"
    result = strip_code_fences(raw)
    assert "\r" not in result
    assert "hello" in result and "world" in result


def test_only_whitespace_returns_empty():
    assert strip_code_fences("   \n  ") == ""


def test_fence_no_language_tag():
    raw = "```\nsome code here\n```"
    result = strip_code_fences(raw)
    assert result == "some code here"
    assert "```" not in result


# ─── normalize_code ───────────────────────────────────────────────────────────

def test_normalize_strips_doctype_preamble():
    raw = "Here is the generated HTML:\n<!DOCTYPE html>\n<html></html>"
    result = normalize_code(raw)
    assert result.startswith("<!DOCTYPE html>")


def test_normalize_no_preamble_unchanged():
    raw = "<!DOCTYPE html>\n<html><body>test</body></html>"
    assert normalize_code(raw) == raw


def test_normalize_react_import_preamble():
    raw = "Sure! Here is the React component:\nimport React from 'react';\nexport default function App() {}"
    result = normalize_code(raw)
    assert result.startswith("import React")


def test_normalize_export_default_preamble():
    """Preamble before export/function code must be stripped."""
    raw = "Here you go:\nexport default function Dashboard() { return <div/>; }"
    result = normalize_code(raw)
    # Preamble text gone, code preserved (exact start depends on _DOC_STARTERS order)
    assert "Here you go" not in result
    assert "Dashboard" in result


def test_normalize_from_import_preamble():
    """Preamble before 'from' import is stripped."""
    raw = "Here is the Vue component:\nfrom .components import App\n"
    result = normalize_code(raw)
    assert "Here is the Vue" not in result


def test_normalize_fence_stripped_first():
    raw = "```html\n<!DOCTYPE html><html></html>\n```"
    result = normalize_code(raw)
    assert "```" not in result
    assert "<!DOCTYPE html>" in result


def test_normalize_preamble_stripped_via_newline_path():
    """When preamble is followed by \\n<!DOCTYPE, it gets stripped (no length limit on \\n path)."""
    long_preamble = "x" * 250
    raw = long_preamble + "\n<!DOCTYPE html><html></html>"
    result = normalize_code(raw)
    # The \\n + starter path always strips regardless of preamble length
    assert result.startswith("<!DOCTYPE html>")


def test_normalize_empty_string():
    assert normalize_code("") == ""


# ─── FenceStripper ────────────────────────────────────────────────────────────

def test_stripper_no_fence_code_preserved():
    code = "<!DOCTYPE html><html><body>Hello World</body></html>"
    chunks = [code[i:i + 10] for i in range(0, len(code), 10)]
    result = _run_stripper(chunks)
    assert "Hello World" in result


def test_stripper_with_html_fence():
    code = "```html\n<!DOCTYPE html><html><body>test</body></html>\n```"
    chunks = [code[i:i + 5] for i in range(0, len(code), 5)]
    result = _run_stripper(chunks)
    assert "test" in result
    assert "```" not in result
    assert result.strip().startswith("<!DOCTYPE")


def test_stripper_short_stream_under_threshold():
    """Stream shorter than PREFIX_THRESHOLD — flush must handle everything."""
    result = _run_stripper(["```html\n<p>hi</p>\n```"])
    assert "```" not in result
    assert "<p>hi</p>" in result


def test_stripper_crlf_normalized():
    code = "```html\r\n<div>test</div>\r\n```"
    result = _run_stripper([code])
    assert "\r" not in result
    assert "<div>test</div>" in result


def test_stripper_no_closing_fence():
    """No closing fence — code should still be emitted."""
    result = _run_stripper(["```html\n<!DOCTYPE html><html><body>test</body></html>"])
    assert "test" in result


def test_stripper_multi_chunk_with_fence():
    """Fence open in first chunk, code split across many chunks."""
    chunks = ["```html\n<!DOC", "TYPE html><html>", "<body>content</body>", "</html>\n```"]
    result = _run_stripper(chunks)
    assert "content" in result
    assert "```" not in result


def test_stripper_empty_input():
    result = _run_stripper([])
    assert result == ""


def test_stripper_plain_text_no_fence():
    chunks = ["Hello ", "World ", "from ", "streamed ", "output."]
    result = _run_stripper(chunks)
    assert "Hello World from streamed output" in result


def test_stripper_closing_fence_only_at_end():
    """Closing fence only in the last chunk."""
    chunks = ["```html\n<!DOCTYPE html>", "<html>", "<body>done</body>", "</html>\n```"]
    result = _run_stripper(chunks)
    assert "done" in result
    assert "```" not in result


def test_stripper_fence_with_spaces():
    """Some models emit ``` followed by a space."""
    result = _run_stripper(["``` \n<div>content</div>\n```"])
    # May or may not strip depending on regex — code should be preserved
    assert "<div>content</div>" in result


def test_stripper_jsx_fence():
    code = "```jsx\nfunction App() {\n  return <div>hello</div>;\n}\n```"
    result = _run_stripper([code])
    assert "```" not in result
    assert "hello" in result
