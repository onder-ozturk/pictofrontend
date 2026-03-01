"""
PicToFrontend — Load Test (Locust)
Sprint 4 — s4-q2

Hedefler:
  - 100 eş zamanlı kullanıcı
  - P95 yanıt süresi < 30 s
  - Hata oranı < %2

Kurulum:
    pip install locust

Çalıştırma (headless, 100 kullanıcı, 60 saniye):
    locust -f tests/locustfile.py \
           --headless \
           --users 100 \
           --spawn-rate 10 \
           --run-time 60s \
           --host http://localhost:8000 \
           --html report/load-test-report.html \
           --csv  report/load-test

Web arayüzü ile:
    locust -f tests/locustfile.py --host http://localhost:8000
    # http://localhost:8089 adresini ziyaret edin

Doğrulama adımları (CI):
    python tests/locustfile.py --validate report/load-test_stats.csv
"""

from __future__ import annotations

import base64
import os
import sys
import random
import string
from pathlib import Path

from locust import HttpUser, TaskSet, task, between, events
from locust.env import Environment

# ── Minimal test PNG (1x1 transparent pixel — API key gerektirmeyen testler için) ──
_TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
_TINY_PNG = base64.b64decode(_TINY_PNG_B64)

# ── Test kullanıcı bilgileri (smoke / load) ────────────────────────────────────
TEST_EMAIL_PREFIX = "loadtest"
TEST_PASSWORD     = "LoadTest123!"

# ── Rastgele email üreteci ────────────────────────────────────────────────────
def _rand_email() -> str:
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{TEST_EMAIL_PREFIX}_{suffix}@load.test"


# ─── Görev setleri ────────────────────────────────────────────────────────────

class PublicTasks(TaskSet):
    """Oturum gerektirmeyen endpointler — yüksek trafik senaryosu."""

    @task(3)
    def health(self):
        """GET /health — temel canlılık kontrolü."""
        with self.client.get("/health", catch_response=True) as resp:
            if resp.status_code == 200 and "healthy" in resp.text:
                resp.success()
            else:
                resp.failure(f"Health check failed: {resp.status_code}")

    @task(2)
    def get_models(self):
        """GET /api/models — model listesi."""
        with self.client.get("/api/models", catch_response=True) as resp:
            if resp.status_code == 200:
                data = resp.json()
                if len(data.get("models", [])) >= 8:
                    resp.success()
                else:
                    resp.failure("Beklenen ≥8 model alınamadı")
            else:
                resp.failure(f"HTTP {resp.status_code}")

    @task(1)
    def get_metrics(self):
        """GET /api/metrics — metrik sayacı."""
        with self.client.get("/api/metrics", catch_response=True) as resp:
            if resp.status_code == 200 and "requests_total" in resp.text:
                resp.success()
            else:
                resp.failure(f"Metrics failed: {resp.status_code}")

    @task(1)
    def unauthorized_credits(self):
        """GET /api/credits/balance — token olmadan → 401 beklenir."""
        with self.client.get("/api/credits/balance", catch_response=True) as resp:
            if resp.status_code == 401:
                resp.success()
            else:
                resp.failure(f"Beklenen 401, alınan {resp.status_code}")


class AuthTasks(TaskSet):
    """Oturum gerektiren endpointler — kullanıcı başına işlemler."""

    token: str = ""
    email: str = ""

    def on_start(self):
        """Her kullanıcı başladığında kayıt + giriş yap."""
        self.email = _rand_email()
        reg = self.client.post(
            "/api/auth/register",
            json={"email": self.email, "password": TEST_PASSWORD},
        )
        if reg.status_code == 201:
            self.token = reg.json().get("token", "")
        elif reg.status_code == 409:
            # Zaten kayıtlı — giriş yap
            login = self.client.post(
                "/api/auth/login",
                json={"email": self.email, "password": TEST_PASSWORD},
            )
            if login.status_code == 200:
                self.token = login.json().get("token", "")

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task(3)
    def credits_balance(self):
        """GET /api/credits/balance — bakiye sorgulama."""
        with self.client.get(
            "/api/credits/balance",
            headers=self._auth_headers(),
            catch_response=True,
        ) as resp:
            if resp.status_code == 200 and "balance" in resp.text:
                resp.success()
            else:
                resp.failure(f"Balance failed: {resp.status_code}")

    @task(2)
    def credits_history(self):
        """GET /api/credits/history — işlem geçmişi."""
        with self.client.get(
            "/api/credits/history",
            headers=self._auth_headers(),
            catch_response=True,
        ) as resp:
            if resp.status_code == 200 and "transactions" in resp.text:
                resp.success()
            else:
                resp.failure(f"History failed: {resp.status_code}")

    @task(1)
    def auth_me(self):
        """GET /api/auth/me — kullanıcı profili."""
        with self.client.get(
            "/api/auth/me",
            headers=self._auth_headers(),
            catch_response=True,
        ) as resp:
            if resp.status_code == 200 and "email" in resp.text:
                resp.success()
            else:
                resp.failure(f"Me failed: {resp.status_code}")


# ─── Kullanıcı sınıfları ──────────────────────────────────────────────────────

class PublicUser(HttpUser):
    """Anonim kullanıcı — public endpointlere yük."""
    tasks       = [PublicTasks]
    wait_time   = between(0.5, 2.0)
    weight      = 60   # %60 anonim trafik


class AuthUser(HttpUser):
    """Kimlik doğrulamalı kullanıcı — credits / profile endpointlerine yük."""
    tasks       = [AuthTasks]
    wait_time   = between(1.0, 3.0)
    weight      = 40   # %40 kimlik doğrulamalı trafik


# ─── CLI doğrulama modu ───────────────────────────────────────────────────────

def _validate_csv(csv_path: str) -> None:
    """
    Locust CSV çıktısını okuyarak P95 ve hata oranı hedeflerini doğrular.
    Başarısız olursa sys.exit(1) ile çıkar.

    CSV Kolonları (locust stats CSV):
      Type, Name, Request Count, Failure Count, Median Response Time,
      Average Response Time, Min Response Time, Max Response Time,
      Average Content Size, Requests/s, Failures/s,
      50%, 66%, 75%, 80%, 90%, 95%, 98%, 99%, 99.9%, 99.99%, 100%
    """
    import csv

    path = Path(csv_path)
    if not path.exists():
        print(f"CSV bulunamadı: {csv_path}")
        sys.exit(1)

    print(f"\n── Load Test Doğrulama: {csv_path} ──")
    errors: list[str] = []

    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("Name") == "Aggregated":
                req_count = int(row.get("Request Count", 0) or 0)
                fail_count = int(row.get("Failure Count", 0) or 0)
                p95_ms = float(row.get("95%", 0) or 0)

                error_rate = (fail_count / req_count * 100) if req_count > 0 else 0

                print(f"  Toplam istek:  {req_count}")
                print(f"  Başarısız:     {fail_count}  ({error_rate:.2f}%)")
                print(f"  P95 süre:      {p95_ms:.0f} ms")

                # Hedef 1: P95 < 30 s (30,000 ms)
                if p95_ms > 30_000:
                    errors.append(
                        f"P95 ({p95_ms:.0f} ms) > 30,000 ms hedefini aştı"
                    )
                else:
                    print(f"  ✓ P95 < 30 s hedefi sağlandı ({p95_ms:.0f} ms)")

                # Hedef 2: Hata oranı < %2
                if error_rate > 2.0:
                    errors.append(
                        f"Hata oranı ({error_rate:.2f}%) > %2 hedefini aştı"
                    )
                else:
                    print(f"  ✓ Hata oranı < %2 hedefi sağlandı ({error_rate:.2f}%)")

                break

    if errors:
        print("\n✗ Doğrulama BAŞARISIZ:")
        for e in errors:
            print(f"  • {e}")
        sys.exit(1)
    else:
        print("\n✅ Tüm yük testi hedefleri sağlandı.")


# ─── Ana giriş ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if "--validate" in sys.argv:
        idx = sys.argv.index("--validate")
        csv_file = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        _validate_csv(csv_file)
    else:
        print(__doc__)
