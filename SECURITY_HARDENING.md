# Security Hardening Checklist — Sprint 3 S12

## HTTPS / Transport

- [ ] HTTPS termination at reverse proxy (Nginx/Caddy) — never expose HTTP directly
- [ ] HSTS header enabled (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- [ ] SSL certificate auto-renewal (Let's Encrypt via Certbot or Caddy)
- [ ] Redirect all HTTP → HTTPS (301)

## CORS

- [x] No wildcard `*` allowed — origins restricted to `ALLOWED_ORIGINS` env var
- [x] `allow_credentials=True` with explicit origins (not `*`)
- [ ] Set `ALLOWED_ORIGINS` to production domain only in prod `.env`
- [ ] Do not include `localhost` in production `ALLOWED_ORIGINS`

## Rate Limiting

- [x] In-app rate limiter: 10 req/60s per IP (`RATE_LIMIT_REQUESTS`, `RATE_LIMIT_WINDOW`)
- [ ] Nginx-level rate limiting as additional layer (`limit_req_zone`)
- [ ] Consider per-API-key rate limiting for authenticated endpoints

## Log Redaction

- [x] API keys masked in all log output (`mask_api_key()` — `sk-ant-abc...` → `sk-ant-***`)
- [x] No raw API keys logged anywhere in the codebase
- [ ] Verify no PII in log lines (no user emails, IPs beyond anonymized form)
- [ ] Use log level `INFO` in production (not `DEBUG`)
- [ ] Rotate logs (logrotate or Docker log driver limits)

## SSRF Prevention

- [x] `validate_url()` blocks localhost, 127.0.0.1, 0.0.0.0
- [x] Private IP ranges blocked: 10.x, 172.16-31.x, 192.168.x
- [x] Link-local blocked: 169.254.x (AWS/GCP metadata)
- [x] Known metadata hostnames blocked: `metadata.google.internal`, `169.254.169.254`
- [ ] Consider DNS rebinding protection (resolve hostname and check again before request)

## File Upload Security

- [x] MIME type whitelist: `image/png`, `image/jpeg`, `image/webp`, `image/gif` only
- [x] File size limit: 20 MB (`MAX_FILE_SIZE`)
- [x] File content NOT executed server-side (passed to AI API, never saved to disk)
- [ ] Consider magic-byte validation in addition to Content-Type header check

## API Key Handling

- [x] API keys never stored server-side (sent per-request, not persisted)
- [x] API keys not echoed in any response body
- [x] Keys validated for format before forwarding to providers
- [ ] Consider encrypting keys at rest if future persistence is added

## Docker / Infrastructure

- [x] Non-root user in Docker containers (`appuser` / `nextjs` user)
- [ ] Read-only root filesystem where possible (`--read-only` Docker flag)
- [ ] Limit container capabilities (`--cap-drop=ALL`)
- [ ] Network isolation: frontend can reach backend, backend cannot reach frontend
- [ ] Pin base image digests (not just tags) for reproducible builds

## Dependency Management

- [ ] Pin all Python package versions in `requirements.txt` (already done)
- [ ] Run `pip audit` / `safety check` in CI to catch known CVEs
- [ ] Run `npm audit` for frontend deps in CI
- [ ] Enable Dependabot for automated security updates

## Session Security

- [x] Sessions are in-memory only (no database, no persistent storage)
- [x] Session IDs are UUID v4 (unpredictable)
- [x] Sessions expire by turn limit (`SESSION_MAX_TURNS = 10`)
- [ ] Add TTL-based session expiry (sessions older than N hours purged)
- [ ] Consider server-restart session invalidation warning to users

## Monitoring / Alerting

- [x] `/api/metrics` endpoint for request count, error rate, latency
- [ ] Alert on error rate > 5% for 5 consecutive minutes
- [ ] Alert on P99 latency > 60s
- [ ] Monitor and alert on rate-limit trigger frequency
- [ ] Structured JSON logging for log aggregation (ELK / Loki)

## Production Deployment Checklist

Before any production release, verify:
1. `ALLOWED_ORIGINS` set to exact production domain
2. All API provider keys stored in secure secrets manager (not `.env` files on disk)
3. HTTPS enforced end-to-end
4. `DEBUG` mode disabled in all services
5. CI passes: lint + tests + security scan + smoke test
6. Docker images built from pinned base image digests
7. Rate limits tested under realistic load
8. SSRF tests run against production URL
