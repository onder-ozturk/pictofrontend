#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLOUDFLARE_CONFIG="$ROOT_DIR/wrangler.toml"
WORKER_ENTRY="$ROOT_DIR/cloudflare/worker.mjs"

echo "=== PicToFrontend Deploy (Cloudflare Workers) ==="

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
    echo "CLOUDFLARE_API_TOKEN zorunlu."
    echo "Kullanım: CLOUDFLARE_API_TOKEN=<token> $0"
    exit 1
fi

if [[ ! -f "$CLOUDFLARE_CONFIG" || ! -f "$WORKER_ENTRY" ]]; then
    echo "wrangler.toml veya cloudflare/worker.mjs bulunamadı."
    exit 1
fi

if command -v wrangler >/dev/null 2>&1; then
    WRANGLER=(wrangler)
elif command -v npx >/dev/null 2>&1; then
    WRANGLER=(npx wrangler)
else
    echo "wrangler bulunamadı. Otomatik kurulum deneniyor: npm install -g wrangler"
    npm install -g wrangler || {
        echo "wrangler otomatik kurulamadı. Manuel kurun: npm install -g wrangler"
        exit 1
    }
    if ! command -v wrangler >/dev/null 2>&1; then
        echo "wrangler kuruldu ama pathte görünmüyor."
        exit 1
    fi
    WRANGLER=(wrangler)
fi

WRANGLER_CONFIG_DIR="/tmp/.wrangler-config"
WRANGLER_CACHE_DIR="/tmp/.wrangler-cache"
mkdir -p "$WRANGLER_CONFIG_DIR" "$WRANGLER_CACHE_DIR"
export XDG_CONFIG_HOME="$WRANGLER_CONFIG_DIR"
export XDG_CACHE_HOME="$WRANGLER_CACHE_DIR"

if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
    echo "Wrangler kimlik doğrulaması başarısız oldu."
    echo "Token geçerliliğini kontrol edin veya şunu çalıştırıp doğrulayın:"
    echo "CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN ${WRANGLER[*]} whoami"
    exit 1
fi

cd "$ROOT_DIR"
CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
    XDG_CONFIG_HOME="$WRANGLER_CONFIG_DIR" \
    "${WRANGLER[@]}" deploy --config "$CLOUDFLARE_CONFIG"

echo "✓ Wrangler deploy tamamlandı: https://pictofrontend.com"
