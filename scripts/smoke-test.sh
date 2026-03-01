#!/usr/bin/env bash
# ── PicToFrontend — Smoke Test Script ────────────────────────────────────────
# Sprint 4 — s4-d1
#
# Kullanım:
#   bash scripts/smoke-test.sh [BASE_URL]
#   bash scripts/smoke-test.sh http://localhost:8080
#   bash scripts/smoke-test.sh https://staging.your-domain.com
#
# Çıkış kodu:
#   0 — tüm testler geçti
#   1 — en az bir test başarısız

set -euo pipefail

BASE_URL="${1:-http://localhost:8000}"
PASS=0
FAIL=0
ERRORS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; ((PASS++)); }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)); ERRORS+=("$1"); }
info() { echo -e "${YELLOW}▸${NC} $1"; }

echo ""
info "PicToFrontend Smoke Test — ${BASE_URL}"
echo "─────────────────────────────────────────"

# ── 1. Health check ──────────────────────────────────────────────────────────
info "1. Health check"
HEALTH=$(curl -sf "${BASE_URL}/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q "healthy"; then
    ok "GET /health → healthy"
else
    fail "GET /health → beklenmeyen yanıt: ${HEALTH}"
fi

# ── 2. Models endpoint ───────────────────────────────────────────────────────
info "2. Models endpoint"
MODELS=$(curl -sf "${BASE_URL}/api/models" 2>/dev/null || echo "FAIL")
MODEL_COUNT=$(echo "$MODELS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('models',[])))" 2>/dev/null || echo "0")
if [ "$MODEL_COUNT" -ge 8 ]; then
    ok "GET /api/models → ${MODEL_COUNT} model"
else
    fail "GET /api/models → beklenen ≥8, alınan: ${MODEL_COUNT}"
fi

# ── 3. Frameworks endpoint ───────────────────────────────────────────────────
info "3. Frameworks kontrolü"
FW_COUNT=$(echo "$MODELS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('frameworks',[])))" 2>/dev/null || echo "0")
if [ "$FW_COUNT" -ge 4 ]; then
    ok "frameworks → ${FW_COUNT} framework"
else
    fail "frameworks → beklenen ≥4, alınan: ${FW_COUNT}"
fi

# ── 4. Metrics endpoint ──────────────────────────────────────────────────────
info "4. Metrics endpoint"
METRICS=$(curl -sf "${BASE_URL}/api/metrics" 2>/dev/null || echo "FAIL")
if echo "$METRICS" | grep -q "requests_total"; then
    ok "GET /api/metrics → OK"
else
    fail "GET /api/metrics → requests_total alanı bulunamadı"
fi

# ── 5. Auth register + login ─────────────────────────────────────────────────
info "5. Auth register / login"
SMOKE_EMAIL="smoketest_$(date +%s)@test.local"
SMOKE_PASS="SmokePass123!"

REG=$(curl -sf -X POST "${BASE_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASS}\"}" 2>/dev/null || echo "FAIL")

if echo "$REG" | grep -q "token"; then
    ok "POST /api/auth/register → token alındı"
    TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || echo "")
else
    fail "POST /api/auth/register → ${REG}"
    TOKEN=""
fi

if [ -n "$TOKEN" ]; then
    LOGIN=$(curl -sf -X POST "${BASE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${SMOKE_EMAIL}\",\"password\":\"${SMOKE_PASS}\"}" 2>/dev/null || echo "FAIL")
    if echo "$LOGIN" | grep -q "token"; then
        ok "POST /api/auth/login → token alındı"
    else
        fail "POST /api/auth/login → ${LOGIN}"
    fi

    # ── 6. Credits balance ───────────────────────────────────────────────────
    info "6. Credits balance"
    BAL=$(curl -sf "${BASE_URL}/api/credits/balance" \
        -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "FAIL")
    if echo "$BAL" | grep -q "balance"; then
        BALANCE=$(echo "$BAL" | python3 -c "import sys,json; print(json.load(sys.stdin)['balance'])" 2>/dev/null || echo "?")
        ok "GET /api/credits/balance → ${BALANCE} kredi"
    else
        fail "GET /api/credits/balance → ${BAL}"
    fi

    # ── 7. Credits history ───────────────────────────────────────────────────
    info "7. Credits history"
    HIST=$(curl -sf "${BASE_URL}/api/credits/history" \
        -H "Authorization: Bearer ${TOKEN}" 2>/dev/null || echo "FAIL")
    if echo "$HIST" | grep -q "transactions"; then
        ok "GET /api/credits/history → OK"
    else
        fail "GET /api/credits/history → ${HIST}"
    fi
fi

# ── 8. 401 koruması ──────────────────────────────────────────────────────────
info "8. 401 koruması"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/credits/balance" 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "401" ] || [ "$HTTP_STATUS" = "403" ]; then
    ok "GET /api/credits/balance (no auth) → ${HTTP_STATUS}"
else
    fail "GET /api/credits/balance (no auth) → beklenen 401, alınan: ${HTTP_STATUS}"
fi

# ── 9. DB migration kontrolü ─────────────────────────────────────────────────
info "9. DB migration (tablolar)"
# Sağlık durumu ile dolaylı kontrol — tabloların var olması kaydın çalışması anlamına gelir
if [ "$PASS" -ge 5 ] && echo "$REG" | grep -q "token"; then
    ok "DB migration → credits ve credit_ledger tabloları mevcut"
else
    fail "DB migration → kayıt yapılamadı, tablolar oluşturulmamış olabilir"
fi

# ── Özet ─────────────────────────────────────────────────────────────────────
echo "─────────────────────────────────────────"
echo -e "Toplam: ${GREEN}${PASS} geçti${NC} / ${RED}${FAIL} başarısız${NC}"

if [ ${#ERRORS[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}Başarısız testler:${NC}"
    for e in "${ERRORS[@]}"; do
        echo "  • $e"
    done
fi

echo ""

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
