"""
Sprint 3 S9 — Lightweight in-memory metrics.

Tracks: request count, error count, per-endpoint latencies (last 1 000 samples).
Thread-safe via a single Lock.
"""

import time
from collections import defaultdict, deque
from threading import Lock
from typing import Any

_lock = Lock()
_request_count: int = 0
_error_count: int = 0
_start_time: float = time.monotonic()

# endpoint → deque of latency floats (seconds)
_latencies: dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))


def record_request(endpoint: str, latency_s: float, is_error: bool = False) -> None:
    """Record a completed request. Call this after the response is sent."""
    global _request_count, _error_count
    with _lock:
        _request_count += 1
        if is_error:
            _error_count += 1
        _latencies[endpoint].append(latency_s)


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    idx = max(0, int(len(values) * pct) - 1)
    return values[idx]


def get_metrics() -> dict[str, Any]:
    """Return a snapshot of current metrics."""
    with _lock:
        total = _request_count
        errors = _error_count
        uptime = time.monotonic() - _start_time

        per_endpoint: dict[str, dict] = {}
        for ep, lats in _latencies.items():
            lst = sorted(lats)
            per_endpoint[ep] = {
                "count": len(lst),
                "avg_s": round(sum(lst) / len(lst), 3) if lst else 0,
                "p95_s": round(_percentile(lst, 0.95), 3),
                "p99_s": round(_percentile(lst, 0.99), 3),
                "max_s": round(lst[-1], 3) if lst else 0,
            }

        return {
            "uptime_s": round(uptime, 1),
            "requests_total": total,
            "errors_total": errors,
            "error_rate": round(errors / total, 4) if total else 0.0,
            "endpoints": per_endpoint,
        }


def reset_metrics() -> None:
    """Reset all counters (for testing)."""
    global _request_count, _error_count, _start_time
    with _lock:
        _request_count = 0
        _error_count = 0
        _start_time = time.monotonic()
        _latencies.clear()
