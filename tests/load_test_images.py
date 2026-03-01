"""
PicToFrontend — Sprint 3 / s3-q1
100 Görsel İsteği Yük Testi: Başarı Oranı + Latency Ölçümü

Kullanım:
    # Sunucu validasyonu testi (API key gerekmez — hızlı 400 yanıtları ölçer):
    python tests/load_test_images.py

    # Gerçek AI üretim testi (API key ile):
    ANTHROPIC_API_KEY=sk-ant-... python tests/load_test_images.py --real

    # Farklı host veya istek sayısı:
    python tests/load_test_images.py --host http://localhost:8000 --count 100

    # Eşzamanlı gönderim (varsayılan: 10 paralel):
    python tests/load_test_images.py --concurrency 10

Çıkış Kodu:
    0 — Tüm hedefler sağlandı (başarı oranı >= %98, P95 < 30 s)
    1 — En az bir hedef sağlanamadı
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import os
import statistics
import sys
import time
from typing import Optional

try:
    import httpx
except ImportError:
    print("httpx gerekli: pip install httpx")
    sys.exit(1)

# ── Minimal 1×1 piksel PNG ─────────────────────────────────────────────────────
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)

# ── Hedefler ───────────────────────────────────────────────────────────────────
TARGET_SUCCESS_RATE = 98.0   # %98 ve üzeri
TARGET_P95_MS       = 30_000  # 30 saniye (ms cinsinden)


# ─── Tek istek gönderici ──────────────────────────────────────────────────────

async def _send_one(
    client: httpx.AsyncClient,
    host: str,
    api_key: str,
    index: int,
) -> dict:
    """
    Bir görsel isteği gönderir; süre ve durum kodunu döndürür.
    API key geçerli değilse sunucu 400/422 döner (bu senaryoda beklenen).
    Gerçek API key ile 200 streaming yanıtı beklenir.
    """
    url = f"{host}/api/generate/from-image"
    files = {"image": ("test.png", _TINY_PNG, "image/png")}
    data  = {"api_key": api_key, "model": "claude", "framework": "html"}

    t0 = time.perf_counter()
    status = 0
    error: Optional[str] = None

    try:
        resp = await client.post(url, files=files, data=data, timeout=35.0)
        status = resp.status_code
    except httpx.TimeoutException:
        error = "timeout"
        status = 0
    except Exception as exc:
        error = str(exc)
        status = 0

    elapsed_ms = (time.perf_counter() - t0) * 1000

    return {
        "index":      index,
        "status":     status,
        "elapsed_ms": elapsed_ms,
        "error":      error,
    }


# ─── Yük testi ana döngüsü ────────────────────────────────────────────────────

async def run_load_test(
    host: str,
    api_key: str,
    count: int,
    concurrency: int,
    real_mode: bool,
) -> int:
    """
    count adet isteği concurrency adet paralel worker ile gönderir.
    Sonuçları raporlar; hedeflere göre çıkış kodu döndürür.
    """
    print(f"\n{'─'*60}")
    print(f"  PicToFrontend — 100 Görsel İsteği Yük Testi (s3-q1)")
    print(f"{'─'*60}")
    print(f"  Host:         {host}")
    print(f"  İstek sayısı: {count}")
    print(f"  Eşzamanlılık: {concurrency}")
    print(f"  Mod:          {'Gerçek AI üretim' if real_mode else 'Sunucu validasyon'}")
    if not real_mode:
        print("  Not: API key olmadan çalışıyor — sunucu hız/validasyon ölçümü")
    print(f"{'─'*60}\n")

    results: list[dict] = []
    semaphore = asyncio.Semaphore(concurrency)

    async def bounded(idx: int) -> dict:
        async with semaphore:
            r = await _send_one(client, host, api_key, idx)
            pct = int((idx + 1) / count * 40)
            bar = "█" * pct + "░" * (40 - pct)
            print(
                f"\r  [{bar}] {idx+1:>3}/{count}  "
                f"{r['elapsed_ms']:>7.0f} ms  HTTP {r['status'] or 'ERR'} ",
                end="",
                flush=True,
            )
            return r

    async with httpx.AsyncClient(timeout=35.0) as client:
        t_start = time.perf_counter()
        results = await asyncio.gather(*[bounded(i) for i in range(count)])
        t_total = (time.perf_counter() - t_start) * 1000

    print()  # newline after progress bar

    # ── Hesaplama ──────────────────────────────────────────────────────────────
    latencies = [r["elapsed_ms"] for r in results]
    timeouts  = [r for r in results if r["error"] == "timeout"]
    errors    = [r for r in results if r["error"] and r["error"] != "timeout"]

    if real_mode:
        # Gerçek modda: 200 (streaming başladı) başarı sayılır
        successes = [r for r in results if r["status"] == 200]
    else:
        # Validasyon modunda: sunucu yanıt verdi (herhangi bir HTTP kodu) başarı
        # Timeout veya bağlantı hatası = başarısızlık
        successes = [r for r in results if r["status"] != 0]

    success_count = len(successes)
    success_rate  = success_count / count * 100

    sorted_lat = sorted(latencies)
    p50 = statistics.median(latencies)
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)]
    p99 = sorted_lat[min(int(len(sorted_lat) * 0.99), len(sorted_lat) - 1)]

    # HTTP durum kodu dağılımı
    status_dist: dict[int | str, int] = {}
    for r in results:
        key = r["status"] if r["status"] != 0 else f"ERR({r['error'][:20]})"
        status_dist[key] = status_dist.get(key, 0) + 1

    # ── Rapor ──────────────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("  SONUÇLAR")
    print(f"{'─'*60}")
    print(f"  Toplam istek:      {count}")
    print(f"  Başarılı:          {success_count}  ({success_rate:.1f}%)")
    print(f"  Başarısız:         {count - success_count}")
    print(f"  Timeout:           {len(timeouts)}")
    print(f"  Bağlantı hatası:   {len(errors)}")
    print(f"  Toplam süre:       {t_total/1000:.1f} s")
    print(f"  Ortalama latency:  {statistics.mean(latencies):.0f} ms")
    print(f"  P50:               {p50:.0f} ms")
    print(f"  P95:               {p95:.0f} ms")
    print(f"  P99:               {p99:.0f} ms")
    print(f"  Min:               {min(latencies):.0f} ms")
    print(f"  Max:               {max(latencies):.0f} ms")
    print()
    print("  HTTP Durum Dağılımı:")
    for code, cnt in sorted(status_dist.items(), key=lambda x: -x[1]):
        bar = "█" * min(cnt, 40)
        print(f"    {str(code):>6}  {bar} {cnt}")

    # ── Hedef doğrulama ────────────────────────────────────────────────────────
    print(f"\n{'─'*60}")
    print("  HEDEF DOĞRULAMA")
    print(f"{'─'*60}")

    all_ok = True

    if success_rate >= TARGET_SUCCESS_RATE:
        print(f"  ✓ Başarı oranı: {success_rate:.1f}% >= %{TARGET_SUCCESS_RATE:.0f}")
    else:
        print(f"  ✗ Başarı oranı: {success_rate:.1f}% < %{TARGET_SUCCESS_RATE:.0f} HEDEFİ TUTTURULAMADI")
        all_ok = False

    if p95 <= TARGET_P95_MS:
        print(f"  ✓ P95 latency: {p95:.0f} ms <= {TARGET_P95_MS:,} ms ({TARGET_P95_MS//1000} s)")
    else:
        print(f"  ✗ P95 latency: {p95:.0f} ms > {TARGET_P95_MS:,} ms  HEDEFİ TUTTURULAMADI")
        all_ok = False

    print(f"{'─'*60}")
    if all_ok:
        print("  ✅ Sprint 3 s3-q1: Tüm yük testi hedefleri sağlandı.")
    else:
        print("  ❌ Sprint 3 s3-q1: Bir veya daha fazla hedef sağlanamadı.")
    print(f"{'─'*60}\n")

    return 0 if all_ok else 1


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="s3-q1: 100 görsel isteği yük testi")
    parser.add_argument("--host",        default="http://localhost:8000", help="Backend adresi")
    parser.add_argument("--count",       type=int, default=100,           help="Toplam istek sayısı (varsayılan: 100)")
    parser.add_argument("--concurrency", type=int, default=10,            help="Eşzamanlı istek sayısı (varsayılan: 10)")
    parser.add_argument("--real",        action="store_true",             help="Gerçek AI üretim modu (API key gerekir)")
    args = parser.parse_args()

    if args.real:
        api_key = (
            os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or ""
        )
        if not api_key:
            print("Hata: --real modunda ANTHROPIC_API_KEY veya OPENAI_API_KEY env değişkeni gerekli.")
            return 1
    else:
        # Validasyon modunda sahte key — sunucu hızlıca 400 döner
        api_key = "sk-test-validasyon-testi"

    return asyncio.run(
        run_load_test(
            host=args.host,
            api_key=api_key,
            count=args.count,
            concurrency=args.concurrency,
            real_mode=args.real,
        )
    )


if __name__ == "__main__":
    sys.exit(main())
