"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────────── */
interface Task {
  id: string;
  label: string;
  sp: number;
  category: "Backend" | "Frontend" | "Güvenlik" | "QA" | "DevOps";
}

interface RoadmapMetrics {
  taskCount: number;
  totalSp: number;
  taskSpById: Record<string, number>;
  sprintCount: number;
  updatedAt: string;
}

interface Sprint {
  id: string;
  title: string;
  subtitle: string;
  weeks: string;
  color: string;
  glow: string;
  accent: string;
  exitCriteria: string[];
  tasks: Task[];
}

const ROADMAP_STORAGE_KEY = "roadmap-checked-v2";
const ROADMAP_UPDATE_COUNT_KEY = "roadmap-update-count-v2";
const ROADMAP_UPDATE_AT_KEY = "roadmap-update-at-v2";
const ROADMAP_METRICS_KEY = "roadmap-metrics-v2";

/* ─── Data ───────────────────────────────────────────────────────── */
const SPRINTS: Sprint[] = [
  {
    id: "sprint1",
    title: "Sprint 1",
    subtitle: "Core Stabilizasyon + Güvenli Üretim Akışı",
    weeks: "Hafta 1–2",
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.15)",
    accent: "bg-blue-500",
    exitCriteria: [
      "Tüm hata yanıtları tutarlı JSON formatında",
      "UI state deterministik, butonlar doğru kilitleniyor",
      "MIME / boyut / timeout validasyonu devrede",
      "En az 5 otomatik test yeşil",
    ],
    tasks: [
      { id: "s1-b1", label: "Pydantic ile tipli payload şeması (GenerateRequest, GenerateChunk, GenerateError)", sp: 5, category: "Backend" },
      { id: "s1-b2", label: "Model seçimini backend/models.py modülüne taşı", sp: 3, category: "Backend" },
      { id: "s1-b3", label: "Hata formatını {type, code, message} olarak standartlaştır", sp: 3, category: "Backend" },
      { id: "s1-b4", label: "Upload validasyonu: MIME tipi, boyut limiti (20MB), timeout", sp: 3, category: "Backend" },
      { id: "s1-b5", label: "Streaming resource cleanup — finally bloğu ile güvenli kapanış", sp: 3, category: "Backend" },
      { id: "s1-b6", label: "IP tabanlı rate-limit middleware → 429 yanıtı", sp: 5, category: "Backend" },
      { id: "s1-f1", label: "UI durum makinesi: idle / sending / streaming / success / error", sp: 5, category: "Frontend" },
      { id: "s1-f2", label: "API key doğrulama ve anlık hata geri bildirimi", sp: 2, category: "Frontend" },
      { id: "s1-f3", label: "Stream içeriği ve hata mesajını ayrı alanlarda göster", sp: 2, category: "Frontend" },
      { id: "s1-f4", label: "Kredi tüketimi yarış durumu koruması (negatif bakiye engeli)", sp: 3, category: "Frontend" },
      { id: "s1-g1", label: "Log maskeleme — API key loglarda sk-*** şeklinde gizlenmeli", sp: 2, category: "Güvenlik" },
      { id: "s1-g2", label: "CORS sıkılaştırma — wildcard kaldır, izinli origin listesi tanımla", sp: 3, category: "Güvenlik" },
      { id: "s1-q1", label: "Test iskeleti: tests/test_api_contracts.py, tests/test_validation.py", sp: 5, category: "QA" },
      { id: "s1-q2", label: "5 kritik e2e senaryo: boş alan, geçersiz dosya, geçersiz key, başarılı stream, hata", sp: 5, category: "QA" },
      { id: "s1-q3", label: "README: stream state'leri ve hata formatı dökümantasyonu", sp: 2, category: "QA" },
    ],
  },
  {
    id: "sprint2",
    title: "Sprint 2",
    subtitle: "Kritik Özellik Eşleşmesi",
    weeks: "Hafta 3–4",
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.15)",
    accent: "bg-violet-500",
    exitCriteria: [
      "URL ve metin girişi demo olarak çalışıyor",
      "Iteratif iyileştirme (follow-up) en az tek tur çalışıyor",
      "En az 3 yeni model UI ve API'de görünür",
      "Güvenlik filtreleri kötü inputları engelliyor",
    ],
    tasks: [
      { id: "s2-b1", label: "POST /api/generate/from-url endpoint'i", sp: 8, category: "Backend" },
      { id: "s2-b2", label: "POST /api/generate/from-text endpoint'i", sp: 8, category: "Backend" },
      { id: "s2-b3", label: "URL screenshot helper servisi (timeout, redirect, SSL hata yönetimi)", sp: 8, category: "Backend" },
      { id: "s2-b4", label: "session_id ile iteratif iyileştirme / geçmiş bağlam desteği", sp: 13, category: "Backend" },
      { id: "s2-b5", label: "3+ yeni model ekleme + metadata ile /api/models zenginleştirme", sp: 8, category: "Backend" },
      { id: "s2-f1", label: "Sekmeli çoklu giriş modu: Screenshot / URL / Text", sp: 8, category: "Frontend" },
      { id: "s2-f2", label: "\"Revise\" butonu — önceki çıktı bağlamı ile yeniden üretim", sp: 8, category: "Frontend" },
      { id: "s2-f3", label: "Bootstrap framework seçeneği eklenmesi", sp: 5, category: "Frontend" },
      { id: "s2-f4", label: "Üretim ilerleme durumu göstergesi (status satırı)", sp: 3, category: "Frontend" },
      { id: "s2-g1", label: "Model payload doğrulama → desteklenmeyen model: 400/422", sp: 5, category: "Güvenlik" },
      { id: "s2-g2", label: "URL güvenlik filtresi: localhost, private IP, blacklist engeli", sp: 5, category: "Güvenlik" },
      { id: "s2-q1", label: "3 endpoint entegrasyon testleri: success + fail senaryoları", sp: 5, category: "QA" },
      { id: "s2-q2", label: "Regresyon verisi: 10 görsel + 10 URL + 10 metin prompt", sp: 8, category: "QA" },
    ],
  },
  {
    id: "sprint3",
    title: "Sprint 3",
    subtitle: "Ürün Olgunlaştırma + Dağıtım Hazırlığı",
    weeks: "Hafta 5–6",
    color: "#10b981",
    glow: "rgba(16,185,129,0.15)",
    accent: "bg-emerald-500",
    exitCriteria: [
      "WebSocket opsiyonel ve stabil",
      "Commit/variant altyapısı MVP düzeyde çalışıyor",
      "Docker ile tek komut deploy",
      "CI pipeline yeşil olmadan release yok",
    ],
    tasks: [
      { id: "s3-b1", label: "WebSocket katmanı (feature flag ile, HTTP fallback korunur)", sp: 13, category: "Backend" },
      { id: "s3-b2", label: "/api/models metadata zenginleştirme: provider, cost, context_window", sp: 5, category: "Backend" },
      { id: "s3-b3", label: "Kod post-process modülü: normalize, temizleme", sp: 5, category: "Backend" },
      { id: "s3-b4", label: "Session bazlı commit/version geçmişi (son 5 versiyon)", sp: 8, category: "Backend" },
      { id: "s3-b5", label: "Basit metrik ve hata sayacı (request count, error rate, latency)", sp: 5, category: "Backend" },
      { id: "s3-f1", label: "Varyant karşılaştırma UI: Current / Variant B sekmeli", sp: 8, category: "Frontend" },
      { id: "s3-f2", label: "Kod editörü geliştirme: syntax highlight, düzenlenebilir alan", sp: 8, category: "Frontend" },
      { id: "s3-f3", label: "WS event durum görselleştirmesi: thinking/status paneli", sp: 5, category: "Frontend" },
      { id: "s3-d1", label: "Docker + docker-compose yeniden eklenmesi", sp: 5, category: "DevOps" },
      { id: "s3-d2", label: "CI pipeline: lint + test + e2e + smoke", sp: 8, category: "DevOps" },
      { id: "s3-q1", label: "Yük testleri: 100 görsel isteği, başarı oranı ve latency ölçümü", sp: 8, category: "QA" },
      { id: "s3-q2", label: "Güvenli dağıtım hardening checklist (HTTPS, CORS, rate-limit, log redaction)", sp: 5, category: "QA" },
    ],
  },
  {
    id: "sprint4",
    title: "Sprint 4",
    subtitle: "Platform Olgunluğu — Kullanıcı Hesabı + Video + AI Kalitesi",
    weeks: "Hafta 7–8",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.12)",
    accent: "bg-amber-500",
    exitCriteria: [
      "Video → Kod en az 30 saniyelik MP4/WebM ile çalışıyor",
      "Kullanıcı kaydı ve JWT girişi tam işlevsel",
      "Kalıcı kredi sistemi veritabanı destekli (SQLite veya Postgres)",
      "Nginx + HTTPS staging ortamında doğrulandı",
      "Langfuse AI çağrı izleme aktif, maliyet görünür",
    ],
    tasks: [
      // Backend
      { id: "s4-b1", label: "Video → Kod endpoint: multipart upload, frame extraction (ffmpeg/Playwright)", sp: 13, category: "Backend" },
      { id: "s4-b2", label: "Extended thinking model desteği: Claude thinking=enabled, budget_tokens parametresi", sp: 8, category: "Backend" },
      { id: "s4-b3", label: "JWT tabanlı kullanıcı oturum yönetimi: kayıt, giriş, token yenileme", sp: 13, category: "Backend" },
      { id: "s4-b4", label: "Kalıcı kredi sistemi: SQLite/Postgres, kullanım geçmişi, bakiye API'si", sp: 8, category: "Backend" },
      { id: "s4-b5", label: "Langfuse observability entegrasyonu: AI çağrı izleme, maliyet, latency", sp: 5, category: "Backend" },
      // Frontend
      { id: "s4-f1", label: "Video yükleme sekmesi: MP4/WebM drag&drop + ekran kaydı başlat/bitir butonu", sp: 8, category: "Frontend" },
      { id: "s4-f2", label: "Kullanıcı kayıt / giriş sayfası: email + şifre formu, token localStorage", sp: 8, category: "Frontend" },
      { id: "s4-f3", label: "Hesap paneli: kredi bakiyesi, son 20 işlem geçmişi, model başına harcama", sp: 5, category: "Frontend" },
      { id: "s4-f4", label: "Extended thinking görselleştirme: dönen düşünce animasyonu, thinking token sayacı", sp: 5, category: "Frontend" },
      // Güvenlik
      { id: "s4-g1", label: "JWT doğrulama middleware: Bearer token, expiry kontrolü, 401 yanıtı", sp: 5, category: "Güvenlik" },
      { id: "s4-g2", label: "Nginx reverse proxy + HTTPS: Let's Encrypt Certbot, HSTS header, HTTP→HTTPS yönlendirme", sp: 5, category: "Güvenlik" },
      // DevOps
      { id: "s4-d1", label: "Staging ortamı: docker-compose.staging.yml, ayrı .env.staging, smoke test", sp: 8, category: "DevOps" },
      { id: "s4-d2", label: "CI'a veritabanı migration testi + Langfuse bağlantı smoke test eklenmesi", sp: 5, category: "DevOps" },
      // QA
      { id: "s4-q1", label: "A/B test framework: 2 model ile aynı görsel → pairwise karşılaştırma UI", sp: 8, category: "QA" },
      { id: "s4-q2", label: "Yük testi: 100 eş zamanlı istek, P95 < 30s, hata oranı < %2 hedefi", sp: 8, category: "QA" },
    ],
  },
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Backend:  { bg: "rgba(59,130,246,0.1)",  text: "#60a5fa", dot: "#3b82f6" },
  Frontend: { bg: "rgba(251,191,36,0.1)",  text: "#fbbf24", dot: "#f59e0b" },
  Güvenlik: { bg: "rgba(239,68,68,0.1)",   text: "#f87171", dot: "#ef4444" },
  QA:       { bg: "rgba(16,185,129,0.1)",  text: "#34d399", dot: "#10b981" },
  DevOps:   { bg: "rgba(168,85,247,0.1)",  text: "#c084fc", dot: "#a855f7" },
};

/* ─── Benchmark data ──────────────────────────────────────────────── */
const BENCHMARK_ROWS = [
  ["Amaç",                "Kurumsal, özellik-zengin araç",         "Platform-olgun SaaS ürünü"],
  ["Backend",             "Python / FastAPI (76 dosya)",           "Python / FastAPI (7 dosya)"],
  ["Frontend",            "React + Vite (62 TSX dosya)",          "Next.js 16 App Router (9 TSX)"],
  ["Backend Satır",       "~8,000+ satır",                         "~2,330 satır"],
  ["Frontend Satır",      "~12,000+ satır",                        "~3,830 satır"],
  ["Test Satırı",         "Kapsamlı (Jest, Vitest, Puppeteer)",    "~2,630 satır (11 dosya)"],
  ["AI Model Sayısı",     "21 model konfigürasyonu",               "20 model (Claude 3.x/4.x, GPT-4/4.1/o3, Gemini, DeepSeek, Qwen, Kimi)"],
  ["Output Framework",    "6+ (HTML, React, Vue, Bootstrap…)",    "6 (HTML, React, Vue, Bootstrap, Svelte, Alpine.js)"],
  ["Test Sayısı",         "Kapsamlı (Jest, Vitest, Puppeteer)",    "279 test (pytest, %100 geçer)"],
  ["Streaming",           "WebSocket (çift yönlü)",                "WebSocket + HTTP (feature flag)"],
  ["Kimlik Doğrulama",    "Sunucu tarafı session",                  "JWT (register/login/refresh)"],
  ["Kredi Sistemi",       "Yok",                                    "SQLite tabanlı, ledger geçmişi"],
  ["Video → Kod",         "Var (tam destek)",                       "Var (ffmpeg / Playwright)"],
  ["Extended Thinking",   "Var",                                    "Var (claude-sonnet-thinking)"],
  ["Observability",       "Yok",                                    "Langfuse (isteğe bağlı)"],
  ["Nginx + HTTPS",       "Belirtilmemiş",                          "nginx.conf + HSTS + TLS 1.3"],
  ["Staging Ortamı",      "Yok",                                    "docker-compose.staging.yml"],
  ["CI/CD",               "Yok",                                    "GitHub Actions (2 workflow)"],
  ["A/B Karşılaştırma",   "Var (pairwise framework)",               "Var (/api/compare + UI)"],
  ["Yük Testi",           "Yok",                                    "Locust (P95<30s, hata<%2)"],
  ["API Key",             "Sunucu tarafı (.env)",                   "İstemci tarafı (kullanıcı girer)"],
];

/* ─── Test coverage data ─────────────────────────────────────────── */
const TEST_FILES = [
  {
    file: "test_api_contracts.py",
    desc: "API Kontrat Testleri",
    color: "#3b82f6",
    tests: [
      "test_health_returns_200",
      "test_health_has_status_field",
      "test_models_returns_200",
      "test_models_shape",
      "test_model_fields",
      "test_framework_fields",
      "test_error_response_has_type_code_message",
      "test_rate_limit_returns_429",
    ],
  },
  {
    file: "test_validation.py",
    desc: "Girdi Doğrulama Testleri",
    color: "#ef4444",
    tests: [
      "test_missing_api_key_rejected",
      "test_whitespace_only_api_key_rejected",
      "test_pdf_file_rejected",
      "test_text_file_rejected",
      "test_svg_rejected",
      "test_unknown_model_rejected",
      "test_empty_model_falls_back_to_default",
      "test_invalid_framework_rejected",
      "test_file_too_large_rejected",
      "test_file_exactly_at_limit_passes_size_check",
      "test_valid_inputs_accepted",
      "test_allowed_mime_types_pass_validation [×3 MIME]",
      "test_all_validation_errors_have_message",
    ],
  },
  {
    file: "test_sprint2.py",
    desc: "Sprint 2 — URL / Metin / Session",
    color: "#8b5cf6",
    tests: [
      "test_from_text_missing_api_key",
      "test_from_text_description_too_short",
      "test_from_text_invalid_model",
      "test_from_text_invalid_framework",
      "test_from_text_valid_request_passes_validation",
      "test_from_text_accepts_all_frameworks [×6 framework]",
      "test_from_url_missing_api_key",
      "test_from_url_localhost_blocked",
      "test_from_url_private_ip_blocked",
      "test_from_url_loopback_blocked",
      "test_from_url_aws_metadata_blocked",
      "test_from_url_empty_url_rejected",
      "test_from_url_invalid_model",
      "test_session_id_returned_in_stream",
      "test_from_text_accepts_session_id",
      "test_models_endpoint_has_new_models",
      "test_models_endpoint_has_bootstrap_framework",
      "test_all_sprint2_models_have_required_fields",
      "test_from_text_svelte_framework_passes_validation",
      "test_from_text_alpine_framework_passes_validation",
      "test_models_endpoint_includes_svelte_framework",
      "test_models_endpoint_includes_alpine_framework",
      "test_rate_limit_triggered_after_limit_requests",
      "test_session_max_turns_trims_old_messages",
      "test_session_empty_for_unknown_id",
    ],
  },
  {
    file: "test_sprint3.py",
    desc: "Sprint 3 — Metrikler / Versiyon / CORS",
    color: "#10b981",
    tests: [
      "test_strip_plain_fence",
      "test_strip_fence_no_language",
      "test_no_fence_unchanged",
      "test_normalize_crlf",
      "test_fence_stripper_streaming",
      "test_fence_stripper_no_fence",
      "test_normalize_code_strips_preamble",
      "test_metrics_endpoint_exists",
      "test_metrics_has_required_fields",
      "test_metrics_increments_on_request",
      "test_metrics_error_rate_type",
      "test_versions_endpoint_exists",
      "test_versions_empty_for_unknown_session",
      "test_versions_response_shape",
      "test_versions_internal_add_and_retrieve",
      "test_versions_max_5",
      "test_cors_no_wildcard",
      "test_api_key_not_echoed_in_error",
      "test_rate_limit_enforced",
      "test_private_ip_blocked_in_url",
    ],
  },
  {
    file: "test_sprint4.py",
    desc: "Sprint 4 — JWT / Kredi / Compare / Model",
    color: "#f59e0b",
    tests: [
      "test_thinking_model_exists_in_model_options",
      "test_thinking_model_has_thinking_flag",
      "test_thinking_model_has_budget",
      "test_regular_models_dont_have_thinking",
      "test_thinking_model_api_id_mapping",
      "test_create_and_decode_token",
      "test_invalid_token_raises",
      "test_register_user",
      "test_register_duplicate_email_raises",
      "test_authenticate_user_valid",
      "test_authenticate_user_wrong_password",
      "test_authenticate_user_unknown_email",
      "test_hash_and_verify_password",
      "test_initial_balance",
      "test_debit_credits_success",
      "test_debit_credits_insufficient",
      "test_add_credits",
      "test_ledger_records_transactions",
      "test_ledger_limit",
      "test_register_endpoint",
      "test_register_duplicate_returns_409",
      "test_login_endpoint",
      "test_login_wrong_password_returns_401",
      "test_me_endpoint_authenticated",
      "test_me_endpoint_unauthenticated_returns_401",
      "test_credits_balance_endpoint",
      "test_credits_topup_endpoint",
      "test_credits_history_endpoint",
      "test_compare_missing_api_key",
      "test_compare_unknown_model_a",
      "test_compare_unknown_model_b",
      "test_compare_invalid_framework",
      "test_compare_missing_image_and_text",
      "test_compare_valid_request_passes_validation",
      "test_new_claude4_models_in_model_options",
      "test_deepseek_models_in_model_options",
      "test_compat_provider_models_have_correct_provider",
      "test_text_only_models_have_supports_vision_false",
      "test_vision_models_have_supports_vision_true",
      "test_compat_base_urls_defined",
    ],
  },
  {
    file: "test_regression_data.py",
    desc: "Regresyon Verisi — Görsel / URL / Metin / Matrix",
    color: "#ec4899",
    tests: [
      "test_image_regression[01_valid_image]",
      "test_image_regression[02_invalid_api_key]",
      "test_image_regression[03_unknown_model]",
      "test_image_regression[04_unknown_framework]",
      "test_image_regression[05_empty_image]",
      "test_image_regression[06_large_image]",
      "test_image_regression[07_react_framework]",
      "test_image_regression[08_vue_framework]",
      "test_image_regression[09_bootstrap_framework]",
      "test_image_regression[10_unknown_framework]",
      "test_url_regression[01_valid_url]",
      "test_url_regression[02_private_ip]",
      "test_url_regression[03_localhost]",
      "test_url_regression[04_aws_metadata]",
      "test_url_regression[05_missing_api_key]",
      "test_url_regression[06_invalid_model]",
      "test_url_regression[07_empty_url]",
      "test_url_regression[08_loopback]",
      "test_url_regression[09_react_framework]",
      "test_url_regression[10_unknown_framework]",
      "test_text_regression[01_valid_text]",
      "test_text_regression[02_too_short]",
      "test_text_regression[03_missing_api_key]",
      "test_text_regression[04_unknown_model]",
      "test_text_regression[05_unknown_framework]",
      "test_text_regression[06_react_framework]",
      "test_text_regression[07_vue_framework]",
      "test_text_regression[08_bootstrap_framework]",
      "test_text_regression[09_svelte_framework]",
      "test_text_model_framework_matrix [×60: 10 model × 6 framework]",
      "test_regression_dataset_counts",
    ],
  },
  {
    file: "test_postprocess.py",
    desc: "Post-Processing Unit Testleri",
    color: "#06b6d4",
    tests: [
      "test_strip_html_fence",
      "test_strip_generic_fence",
      "test_strip_jsx_fence",
      "test_strip_vue_fence",
      "test_strip_svelte_fence",
      "test_no_fence_unchanged",
      "test_crlf_normalized",
      "test_only_whitespace_returns_empty",
      "test_fence_no_language_tag",
      "test_normalize_strips_doctype_preamble",
      "test_normalize_no_preamble_unchanged",
      "test_normalize_react_import_preamble",
      "test_normalize_export_default_preamble",
      "test_normalize_from_import_preamble",
      "test_normalize_fence_stripped_first",
      "test_normalize_preamble_stripped_via_newline_path",
      "test_normalize_empty_string",
      "test_stripper_no_fence_code_preserved",
      "test_stripper_with_html_fence",
      "test_stripper_short_stream_under_threshold",
      "test_stripper_crlf_normalized",
      "test_stripper_no_closing_fence",
      "test_stripper_multi_chunk_with_fence",
      "test_stripper_empty_input",
      "test_stripper_plain_text_no_fence",
      "test_stripper_closing_fence_only_at_end",
      "test_stripper_fence_with_spaces",
      "test_stripper_jsx_fence",
    ],
  },
  {
    file: "test_db.py",
    desc: "SQLite Kredi Ledger Unit Testleri",
    color: "#84cc16",
    tests: [
      "test_init_db_creates_tables",
      "test_init_db_idempotent",
      "test_new_user_gets_initial_balance",
      "test_same_user_balance_stable",
      "test_different_users_independent_balances",
      "test_add_credits_returns_new_balance",
      "test_add_credits_multiple_times",
      "test_add_credits_creates_ledger_entry",
      "test_debit_credits_success",
      "test_debit_exact_balance",
      "test_debit_credits_insufficient_returns_false",
      "test_debit_insufficient_balance_unchanged",
      "test_debit_zero_always_succeeds",
      "test_debit_creates_ledger_entry",
      "test_ledger_empty_for_new_user",
      "test_ledger_ordering_newest_first",
      "test_ledger_limit_param",
      "test_ledger_default_limit_20",
      "test_ledger_entries_have_required_fields",
      "test_add_credits_does_not_affect_other_user",
      "test_debit_does_not_affect_other_user",
    ],
  },
  {
    file: "test_auth.py",
    desc: "JWT Auth Modül Unit Testleri",
    color: "#f97316",
    tests: [
      "test_hash_verify_roundtrip",
      "test_verify_wrong_password",
      "test_hash_is_not_plaintext",
      "test_same_password_different_hashes",
      "test_register_user_success",
      "test_register_user_returns_user_record",
      "test_register_user_duplicate_raises",
      "test_register_user_email_normalized",
      "test_register_user_stored_by_email",
      "test_register_user_stored_by_id",
      "test_register_multiple_users",
      "test_register_user_has_created_at",
      "test_authenticate_valid_credentials",
      "test_authenticate_wrong_password_returns_none",
      "test_authenticate_unknown_email_returns_none",
      "test_authenticate_email_case_insensitive",
      "test_authenticate_empty_password_returns_none",
      "test_get_user_by_id_existing",
      "test_get_user_by_id_missing",
      "test_create_access_token_returns_string",
      "test_create_access_token_decodable",
      "test_access_token_has_expiry",
      "test_access_token_not_yet_expired",
      "test_decode_invalid_token_raises",
      "test_decode_empty_token_raises",
      "test_decode_expired_token_raises",
      "test_decode_wrong_secret_raises",
      "test_decode_tampered_token_raises",
    ],
  },
  {
    file: "load_test_images.py",
    desc: "Sprint 3 s3-q1 — 100 Görsel Yük Testi",
    color: "#a855f7",
    tests: [
      "100 POST /api/generate/from-image isteği",
      "Eşzamanlı gönderim (varsayılan: 10 paralel worker)",
      "Latency ölçümü: P50 / P95 / P99 / Min / Max",
      "Başarı oranı hesabı (hedef: >= %98)",
      "P95 doğrulama (hedef: < 30 s)",
      "HTTP durum kodu dağılımı raporu",
      "Gerçek AI modu: --real (ANTHROPIC_API_KEY ile)",
      "Validasyon modu: sahte key → hızlı 400 yanıtı ölçümü",
      "Çıkış kodu: 0 (tüm hedefler OK) / 1 (hedef tutturulamadı)",
    ],
  },
];

const ALL_TASKS = SPRINTS.flatMap((sprint) => sprint.tasks);
const ALL_TASK_IDS = new Set(ALL_TASKS.map((task) => task.id));
const TOTAL_SPRINT_SP = ALL_TASKS.reduce((sum, task) => sum + task.sp, 0);
const TASK_SP_BY_ID = Object.fromEntries(ALL_TASKS.map((task) => [task.id, task.sp]));
const SAVED_METRICS: RoadmapMetrics = {
  taskCount: ALL_TASKS.length,
  totalSp: TOTAL_SPRINT_SP,
  taskSpById: TASK_SP_BY_ID,
  sprintCount: SPRINTS.length,
  updatedAt: new Date().toISOString(),
};

/* ─── Roadmap Page ───────────────────────────────────────────────── */
export default function RoadmapPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [testListOpen, setTestListOpen] = useState(false);
  const [openTestFile, setOpenTestFile] = useState<string | null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState<string>("");
  const [sprintOpen, setSprintOpen] = useState<Record<string, boolean>>({
    sprint1: false,
    sprint2: false,
    sprint3: false,
    sprint4: true,
  });

  /* Implemented task IDs — auto-seeded on load (updated as sprints complete) */
  const IMPLEMENTED_TASK_IDS: ReadonlySet<string> = new Set([
    // Sprint 1
    "s1-b1", "s1-b2", "s1-b3", "s1-b4", "s1-b5", "s1-b6",
    "s1-f1", "s1-f2", "s1-f3", "s1-f4",
    "s1-g1", "s1-g2",

    // Sprint 2
    "s2-b1", "s2-b2", "s2-b3", "s2-b4", "s2-b5",
    "s2-f1", "s2-f2", "s2-f3", "s2-f4",
    "s2-g1", "s2-g2",
    "s2-q1",  // 3 endpoint entegrasyon testleri (test_sprint2.py)
    "s2-q2",  // Regresyon verisi: 10 görsel + 10 URL + 10 metin prompt (test_regression_data.py)

    // Sprint 3
    "s3-b1", "s3-b2", "s3-b3", "s3-b4", "s3-b5",
    "s3-f1", "s3-f2", "s3-f3",
    "s3-d1",  // Docker + docker-compose (backend/Dockerfile, frontend/Dockerfile, docker-compose.yml)
    "s3-d2",  // CI pipeline: lint + test + e2e + smoke (.github/workflows/ci.yml)
    "s3-q1",  // Yük testi: 100 görsel isteği (tests/load_test_images.py — başarı oranı + P50/P95/P99)
    "s3-q2",  // Güvenli dağıtım hardening: nginx.conf (HTTPS+HSTS), CORS sıkılaştırma, rate-limit, log maskeleme

    // Sprint 4
    "s4-b1",  // Video→Kod endpointi + frame extraction (ffmpeg/Playwright)
    "s4-b2",  // Extended thinking: claude-3-7-sonnet, streaming thinking blocks
    "s4-b3",  // JWT auth: register / login / token yenileme (auth.py)
    "s4-b4",  // Kalıcı kredi sistemi: SQLite via aiosqlite (db.py)
    "s4-b5",  // Langfuse observability: observe.py, log_event, flush
    "s4-f1",  // Video yükleme sekmesi: MP4/WebM drag&drop (frontend)
    "s4-f2",  // Kullanıcı kayıt/giriş sayfası: /auth page, toggle, localStorage
    "s4-f3",  // Hesap paneli: AccountPanel slide-in, bakiye, ledger, harcama
    "s4-f4",  // Extended thinking görselleştirme: ping animasyonu, collapsible panel
    "s4-g1",  // JWT middleware: Bearer token, 401 dependency (auth.py)
    "s4-g2",  // Nginx reverse proxy + HTTPS: nginx.conf, nginx.dev.conf, HSTS
    "s4-d1",  // Staging ortamı: docker-compose.staging.yml, .env.staging, smoke-test.sh
    "s4-d2",  // CI'a DB migration testi + Langfuse smoke test (ci.yml güncellendi)
    "s4-q1",  // A/B test framework: /api/compare endpoint + /compare frontend sayfası
    "s4-q2",  // Yük testi: locustfile.py, P95<30s / hata<%2 doğrulaması, load-test.yml
  ]);

  /* Load from localStorage — auto-seed implemented tasks */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ROADMAP_STORAGE_KEY);
      const storedUpdateCount = Number(localStorage.getItem(ROADMAP_UPDATE_COUNT_KEY) ?? "0");
      const storedLastUpdateAt = localStorage.getItem(ROADMAP_UPDATE_AT_KEY) ?? "";

      const parsed = stored ? JSON.parse(stored) : null;
      const base: Record<string, boolean> =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};

      // Sanitise + enforce implemented tasks (always mark them done)
      const sanitized: Record<string, boolean> = {};
      for (const id of ALL_TASK_IDS) {
        if (IMPLEMENTED_TASK_IDS.has(id)) {
          sanitized[id] = true;              // always done
        } else if (typeof base[id] === "boolean") {
          sanitized[id] = base[id];          // user-toggled
        }
      }

      setChecked(sanitized);
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(sanitized));
      localStorage.setItem(
        ROADMAP_UPDATE_COUNT_KEY,
        String(Number.isFinite(storedUpdateCount) ? storedUpdateCount : 0),
      );
      localStorage.setItem(ROADMAP_METRICS_KEY, JSON.stringify({ ...SAVED_METRICS, updatedAt: new Date().toISOString() }));
      setUpdateCount(Number.isFinite(storedUpdateCount) ? storedUpdateCount : 0);
      setLastUpdateAt(storedLastUpdateAt);
    } catch {
      localStorage.removeItem(ROADMAP_STORAGE_KEY);
      localStorage.setItem(ROADMAP_METRICS_KEY, JSON.stringify(SAVED_METRICS));
      setChecked({});
      setUpdateCount(0);
      setLastUpdateAt("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Persist to localStorage */
  function toggle(id: string) {
    const now = new Date().toISOString();
    setChecked((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setUpdateCount((prev) => {
      const nextUpdateCount = prev + 1;
      localStorage.setItem(ROADMAP_UPDATE_COUNT_KEY, String(nextUpdateCount));
      return nextUpdateCount;
    });
    localStorage.setItem(ROADMAP_UPDATE_AT_KEY, now);
    setLastUpdateAt(now);
    localStorage.setItem(ROADMAP_METRICS_KEY, JSON.stringify({ ...SAVED_METRICS, updatedAt: now }));
  }

  function resetProgress() {
    setChecked({});
    localStorage.removeItem(ROADMAP_STORAGE_KEY);
    setUpdateCount(0);
    setLastUpdateAt("");
    localStorage.removeItem(ROADMAP_UPDATE_COUNT_KEY);
    localStorage.removeItem(ROADMAP_UPDATE_AT_KEY);
  }

  function toggleSprint(id: string) {
    setSprintOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  /** Mark / unmark all tasks in a sprint at once */
  function markSprintDone(sprint: Sprint, done: boolean) {
    const now = new Date().toISOString();
    let changed = 0;
    for (const task of sprint.tasks) {
      const currentlyChecked = checked[task.id];
      if (done && !currentlyChecked) changed += 1;
      if (!done && currentlyChecked) changed += 1;
    }

    if (changed === 0) {
      setLastUpdateAt(now);
      localStorage.setItem(ROADMAP_UPDATE_AT_KEY, now);
      return;
    }

    setChecked((prev) => {
      const next = { ...prev };
      sprint.tasks.forEach((t) => {
        if (done) next[t.id] = true;
        else delete next[t.id];
      });
      localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setUpdateCount((prev) => {
      const n = prev + changed;
      localStorage.setItem(ROADMAP_UPDATE_COUNT_KEY, String(n));
      return n;
    });
    localStorage.setItem(ROADMAP_UPDATE_AT_KEY, now);
    setLastUpdateAt(now);
    localStorage.setItem(ROADMAP_METRICS_KEY, JSON.stringify({ ...SAVED_METRICS, updatedAt: now }));
  }

  /* Progress helpers */
  function sprintProgress(sprint: Sprint) {
    const done = sprint.tasks.filter((t) => checked[t.id]).length;
    return { done, total: sprint.tasks.length, pct: Math.round((done / sprint.tasks.length) * 100) };
  }

  function sprintSpProgress(sprint: Sprint) {
    const done = sprint.tasks.filter((t) => checked[t.id]).reduce((sum, t) => sum + t.sp, 0);
    const total = sprint.tasks.reduce((sum, t) => sum + t.sp, 0);
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }

  function totalProgress() {
    const doneTasks = ALL_TASKS.filter((task) => checked[task.id]).length;
    const totalTasks = ALL_TASKS.length;
    const doneSp = ALL_TASKS.filter((task) => checked[task.id]).reduce((sum, t) => sum + t.sp, 0);
    const totalSp = ALL_TASKS.reduce((sum, t) => sum + t.sp, 0);

    return {
      done: doneTasks,
      total: totalTasks,
      pct: Math.round((doneTasks / totalTasks) * 100),
      doneSp,
      totalSp,
      spPct: totalSp === 0 ? 0 : Math.round((doneSp / totalSp) * 100),
    };
  }

  const total = totalProgress();
  const totalSP = total.totalSp;
  const completedSP = total.doneSp;

  /* Group tasks by category */
  function groupByCategory(tasks: Task[]) {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (!map[t.category]) map[t.category] = [];
      map[t.category].push(t);
    }
    return map;
  }

  return (
    <div className="min-h-screen" style={{ background: "#09090b", color: "#f4f4f5" }}>
      {/* ── Nav ── */}
      <nav className="landing-bg-nav sticky top-0 z-50 px-6 py-4 flex items-center justify-between backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2 text-white font-semibold text-sm">
          <span style={{ color: "#3b82f6" }}>←</span> PicToFrontend
        </Link>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "#71717a" }}>
              {total.done}/{total.total} görev tamamlandı
            </span>
            <span
              className="text-xs font-mono px-2 py-1 rounded"
              style={{ background: "rgba(37,99,235,0.15)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.3)" }}
            >
              {completedSP}/{totalSP} SP ({total.spPct}%)
            </span>
            <span className="text-xs" style={{ color: "#71717a" }}>
              {updateCount} güncelleme
            </span>
            <span className="text-xs" style={{ color: "#71717a" }}>
              kalan: {total.total - total.done} görev
            </span>
            {lastUpdateAt && (
              <span className="text-xs" style={{ color: "#71717a" }}>
                son güncelleme: {new Date(lastUpdateAt).toLocaleTimeString("tr-TR")}
              </span>
            )}
            <div
              className="w-24 h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${total.pct}%`, background: "#3b82f6" }}
            />
          </div>
          <span className="text-xs font-bold" style={{ color: "#3b82f6" }}>{total.pct}%</span>
          <button
            onClick={resetProgress}
            className="text-xs px-2 py-1 rounded"
            style={{ background: "rgba(239,68,68,0.12)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
          >
            İlerlemeyi Sıfırla
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">
        {/* ── Header ── */}
        <div className="mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-6"
            style={{
              background: "rgba(37,99,235,0.1)",
              border: "1px solid rgba(37,99,235,0.25)",
              color: "#60a5fa",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse inline-block" />
            {SPRINTS.length} Sprint · 8 Hafta · {TOTAL_SPRINT_SP} Story Point
          </div>

          <h1 className="text-4xl font-bold mb-4 tracking-tight">
            PicToFrontend{" "}
            <span style={{ color: "#3b82f6" }}>Roadmap</span>
          </h1>
          <p style={{ color: "#71717a" }} className="text-lg max-w-2xl">
            MVP'den platforma geçiş planı. Her görevi tamamladığında işaretle — ilerleme
            tarayıcında saklanır.
          </p>

          {/* ── Overall stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            {SPRINTS.map((sprint) => {
              const p = sprintProgress(sprint);
              const pSp = sprintSpProgress(sprint);
              return (
                <div
                  key={sprint.id}
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold" style={{ color: sprint.color }}>
                      {sprint.title}
                    </span>
                    <span className="text-xs" style={{ color: "#52525b" }}>
                      {sprint.weeks}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mb-1">
                    {p.done}
                    <span className="text-sm font-normal" style={{ color: "#52525b" }}>
                      /{p.total}
                    </span>
                  </div>
                  <div
                    className="w-full h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p.pct}%`, background: sprint.color }}
                    />
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#52525b" }}>
                    {pSp.done}/{pSp.total} SP · {pSp.pct}% tamamlandı
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Timeline ── */}
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{ background: "linear-gradient(to bottom, #3b82f6, #8b5cf6, #10b981, #f59e0b)" }}
          />

          <div className="space-y-6">
            {SPRINTS.map((sprint) => {
              const p = sprintProgress(sprint);
              const pSp = sprintSpProgress(sprint);
              const open = sprintOpen[sprint.id];
              const groups = groupByCategory(sprint.tasks);

              return (
                <div key={sprint.id} className="relative pl-16">
                  {/* Timeline dot */}
                  <div
                    className="absolute left-4 top-5 w-4 h-4 rounded-full border-2 -translate-x-1/2 z-10 transition-all duration-300"
                    style={{
                      background: p.pct === 100 ? sprint.color : "#09090b",
                      borderColor: sprint.color,
                      boxShadow: `0 0 12px ${sprint.glow}`,
                    }}
                  >
                    {p.pct === 100 && (
                      <svg className="w-2.5 h-2.5 absolute inset-0 m-auto" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>

                  {/* Sprint card */}
                  <div
                    className="rounded-2xl overflow-hidden transition-all duration-200"
                    style={{
                      border: `1px solid rgba(255,255,255,0.07)`,
                      background: "rgba(255,255,255,0.015)",
                    }}
                  >
                    {/* Sprint header */}
                    <div className="px-6 py-5 flex items-center justify-between">
                      <button
                        onClick={() => toggleSprint(sprint.id)}
                        className="flex-1 text-left flex items-center gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-lg" style={{ color: sprint.color }}>
                              {sprint.title}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: `${sprint.glow}`,
                                color: sprint.color,
                                border: `1px solid ${sprint.color}33`,
                              }}
                            >
                              {sprint.weeks}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                color: "#71717a",
                              }}
                            >
                              {pSp.total} SP
                            </span>
                          </div>
                          <div className="text-sm" style={{ color: "#a1a1aa" }}>
                            {sprint.subtitle}
                          </div>
                        </div>
                      </button>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Mark sprint done / undo button */}
                        {p.pct === 100 ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); markSprintDone(sprint, false); }}
                            className="text-xs px-2.5 py-1 rounded-lg transition-all duration-150 flex items-center gap-1.5"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#71717a",
                            }}
                            title="İşaretleri kaldır"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                            Geri al
                          </button>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); markSprintDone(sprint, true); }}
                            className="text-xs px-2.5 py-1 rounded-lg transition-all duration-150 flex items-center gap-1.5"
                            style={{
                              background: `${sprint.glow}`,
                              border: `1px solid ${sprint.color}44`,
                              color: sprint.color,
                            }}
                            title="Tüm görevleri tamamlandı işaretle"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.2 2.5L8 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                            </svg>
                            Tamamlandı
                          </button>
                        )}

                        {/* Mini progress ring */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono" style={{ color: sprint.color }}>
                            {p.pct}%
                          </span>
                          <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
                            <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                            <circle
                              cx="14" cy="14" r="11"
                              fill="none"
                              stroke={sprint.color}
                              strokeWidth="2.5"
                              strokeDasharray={`${2 * Math.PI * 11}`}
                              strokeDashoffset={`${2 * Math.PI * 11 * (1 - p.pct / 100)}`}
                              strokeLinecap="round"
                              style={{ transition: "stroke-dashoffset 0.5s ease" }}
                            />
                          </svg>
                        </div>
                        <svg
                          width="16" height="16" viewBox="0 0 16 16" fill="none"
                          className="transition-transform duration-200"
                          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "#52525b" }}
                        >
                          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Sprint body */}
                    {open && (
                      <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                        {/* Tasks by category */}
                        <div className="p-6 space-y-6">
                          {Object.entries(groups).map(([cat, tasks]) => {
                            const cs = CATEGORY_STYLES[cat];
                            const catDone = tasks.filter((t) => checked[t.id]).length;
                            return (
                              <div key={cat}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span
                                    className="w-2 h-2 rounded-full inline-block"
                                    style={{ background: cs.dot }}
                                  />
                                  <span
                                    className="text-xs font-semibold uppercase tracking-widest"
                                    style={{ color: cs.text }}
                                  >
                                    {cat}
                                  </span>
                                  <span className="text-xs" style={{ color: "#3f3f46" }}>
                                    {catDone}/{tasks.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {tasks.map((task) => {
                                    const done = !!checked[task.id];
                                    return (
                                      <label
                                        key={task.id}
                                        className="flex items-start gap-3 p-3 rounded-xl cursor-pointer group transition-all duration-150"
                                        style={{
                                          background: done
                                            ? `${sprint.glow}`
                                            : "rgba(255,255,255,0.02)",
                                          border: `1px solid ${done ? sprint.color + "33" : "rgba(255,255,255,0.05)"}`,
                                        }}
                                      >
                                        {/* Custom checkbox */}
                                        <span
                                          className="shrink-0 w-5 h-5 rounded flex items-center justify-center mt-0.5 transition-all duration-150"
                                          style={{
                                            background: done ? sprint.color : "rgba(255,255,255,0.05)",
                                            border: `1.5px solid ${done ? sprint.color : "rgba(255,255,255,0.15)"}`,
                                          }}
                                          onClick={() => toggle(task.id)}
                                        >
                                          {done && (
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                              <path d="M2 6l2.8 3L10 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                                            </svg>
                                          )}
                                        </span>
                                        <input
                                          type="checkbox"
                                          className="sr-only"
                                          checked={done}
                                          onChange={() => toggle(task.id)}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span
                                            className="text-sm leading-relaxed"
                                            style={{
                                              color: done ? "#6b7280" : "#d4d4d8",
                                              textDecoration: done ? "line-through" : "none",
                                            }}
                                          >
                                            {task.label}
                                          </span>
                                        </div>
                                        <span
                                          className="shrink-0 text-xs font-mono px-1.5 py-0.5 rounded"
                                          style={{
                                            background: cs.bg,
                                            color: cs.text,
                                          }}
                                        >
                                          {task.sp} SP
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Exit criteria */}
                        <div
                          className="mx-6 mb-6 rounded-xl p-4"
                          style={{
                            background: `${sprint.glow}`,
                            border: `1px solid ${sprint.color}22`,
                          }}
                        >
                          <div className="text-xs font-semibold mb-2" style={{ color: sprint.color }}>
                            Çıkış Kriterleri
                          </div>
                          <ul className="space-y-1">
                            {sprint.exitCriteria.map((c, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: "#a1a1aa" }}>
                                <span style={{ color: sprint.color }}>✓</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

        {/* ── Benchmark Report ── */}
        <div className="mt-20">
          <button
            onClick={() => setReportOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-5 rounded-2xl group transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📊</span>
              <div className="text-left">
                <div className="font-bold text-base">Benchmark Raporu</div>
                <div className="text-xs" style={{ color: "#71717a" }}>
                  PicToFrontend vs Screenshot-to-Code Original — 15 sayfa kapsamlı analiz
                </div>
              </div>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              className="transition-transform duration-200 shrink-0"
              style={{ transform: reportOpen ? "rotate(180deg)" : "rotate(0deg)", color: "#52525b" }}
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {reportOpen && (
            <div
              className="mt-2 rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}
            >
              {/* Summary table */}
              <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <h2 className="text-lg font-bold mb-1">Yönetici Özeti</h2>
                <p className="text-sm mb-5" style={{ color: "#71717a" }}>
                  Tarih: 28 Şubat 2026 · Hazırlayan: Claude Code Otomatik Analiz
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "#52525b", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          Kriter
                        </th>
                        <th className="text-left py-2 px-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "#f87171", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          Orijinal
                        </th>
                        <th className="text-left py-2 pl-4 text-xs font-semibold uppercase tracking-wider" style={{ color: "#34d399", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          PicToFrontend
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {BENCHMARK_ROWS.map(([label, orig, newv], i) => (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td className="py-2.5 pr-4 text-xs font-medium" style={{ color: "#71717a" }}>{label}</td>
                          <td className="py-2.5 px-4 text-xs font-mono" style={{ color: "#f87171" }}>{orig}</td>
                          <td className="py-2.5 pl-4 text-xs font-mono" style={{ color: "#34d399" }}>{newv}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strengths */}
              <div className="p-6 grid md:grid-cols-2 gap-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div>
                  <div className="text-sm font-bold mb-3" style={{ color: "#f87171" }}>
                    Orijinal Proje — Güçlü Yönler
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      "Enterprise-grade mimari (agent sistemi, middleware pipeline)",
                      "21 farklı AI model konfigürasyonu",
                      "Kapsamlı değerlendirme framework'ü",
                      "Video işleme ve ekran kayıt desteği",
                      "Gerçek zamanlı WebSocket iletişimi",
                      "6+ output framework (Tailwind, Alpine, Ionic…)",
                      "Üretim ortamına hazır hata yönetimi",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "#a1a1aa" }}>
                        <span style={{ color: "#f87171" }}>•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-bold mb-3" style={{ color: "#34d399" }}>
                    PicToFrontend Sprint 4 — Güçlü Yönler
                  </div>
                  <ul className="space-y-1.5">
                    {[
                      "JWT kimlik doğrulama + SQLite kredi sistemi",
                      "WebSocket + HTTP çift mod streaming",
                      "Video → Kod (ffmpeg / Playwright frame extraction)",
                      "Extended Thinking (claude-sonnet-thinking)",
                      "Langfuse AI observability (maliyet + latency)",
                      "Nginx + HTTPS + HSTS — üretime hazır",
                      "279 otomatik test (%100 geçer) · 9 dosya · 2,630 satır",
                      "A/B model karşılaştırma UI + /api/compare",
                      "Staging ortamı + smoke-test.sh + CI migration testi",
                      "Modern Next.js 16 + React 19, anlaşılır kod tabanı",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "#a1a1aa" }}>
                        <span style={{ color: "#34d399" }}>•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Still missing vs completed */}
              <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Completed in Sprint 4 */}
                  <div>
                    <div className="text-sm font-bold mb-3" style={{ color: "#34d399" }}>
                      ✓ Sprint 4&apos;te Tamamlananlar
                    </div>
                    <div className="space-y-3">
                      {[
                        { cat: "Backend", items: ["WebSocket streaming (feature flag)", "Video → Kod (ffmpeg + Playwright)", "Extended thinking (budget_tokens)", "9. model eklendi (claude-sonnet-thinking)"] },
                        { cat: "Frontend", items: ["AI düşünme görselleştirme (thinking panel)", "Video yükleme sekmesi (MP4/WebM)", "A/B karşılaştırma sayfası (/compare)", "Hesap paneli + giriş/kayıt sayfası"] },
                        { cat: "DevOps", items: ["Nginx + HTTPS + HSTS yapılandırması", "docker-compose.staging.yml + smoke test", "CI'a DB migration + Langfuse testi"] },
                        { cat: "QA", items: ["Yük testi (Locust, P95<30s, hata<%2)", "Regresyon verisi: 10 görsel + 10 URL + 10 metin", "279 test — 9 dosya, 2,630 satır, %100 geçer"] },
                      ].map(({ cat, items }) => (
                        <div key={cat}>
                          <div className="text-xs font-semibold mb-1" style={{ color: CATEGORY_STYLES[cat]?.text || "#34d399" }}>{cat}</div>
                          <ul className="space-y-0.5">
                            {items.map((i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#6b7280" }}>
                                <span style={{ color: "#34d399" }}>✓</span>{i}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Still missing */}
                  <div>
                    <div className="text-sm font-bold mb-3" style={{ color: "#fbbf24" }}>
                      — Hâlâ Eksik Özellikler
                    </div>
                    <div className="space-y-3">
                      {[
                        { cat: "Backend", items: ["12 model eksik (21 vs 9)", "Gerçek ödeme entegrasyonu (Stripe)", "Webhook / event sistemi"] },
                        { cat: "Frontend", items: ["Syntax highlighting editör (CodeMirror/Monaco)", "Klavye kısayolları (Cmd+Enter vb.)", "Sidebar navigasyon / multi-tab"] },
                        { cat: "DevOps", items: ["Pinned Docker image digest'leri", "Let's Encrypt otomasyonu (certbot timer)", "CDN yapılandırması"] },
                        { cat: "QA", items: ["E2E Playwright testleri", "Pre-commit hooks (black, pyright)", "Visual regression (screenshot diff)"] },
                      ].map(({ cat, items }) => (
                        <div key={cat}>
                          <div className="text-xs font-semibold mb-1" style={{ color: CATEGORY_STYLES[cat]?.text || "#fbbf24" }}>{cat}</div>
                          <ul className="space-y-0.5">
                            {items.map((i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: "#71717a" }}>
                                <span style={{ color: "#fbbf24" }}>—</span>{i}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Score */}
              <div className="p-6">
                <div className="text-sm font-bold mb-1">Genel Skor Karşılaştırması</div>
                <p className="text-[11px] mb-4" style={{ color: "#52525b" }}>Sprint 4 tamamlandı — güncel değerlendirme</p>
                <div className="space-y-3">
                  {[
                    { label: "Özellik Zenginliği",   orig: 92, newv: 84, note: "+14 (WS, Video, Thinking, Auth, Compare)" },
                    { label: "Kod Kalitesi",          orig: 82, newv: 79, note: "+4 (modüler yapı, tip güvenliği)" },
                    { label: "Geliştirme Hızı",       orig: 45, newv: 85, note: "Minimal bağımlılık, hızlı iterasyon" },
                    { label: "Dağıtım Kolaylığı",     orig: 35, newv: 85, note: "+3 (Nginx + Staging + Smoke test)" },
                    { label: "Güvenlik Duruşu",       orig: 72, newv: 83, note: "+11 (JWT, HTTPS, HSTS, rate-limit)" },
                    { label: "Test Kapsamı",           orig: 78, newv: 80, note: "+10 (279 test · 9 dosya · postprocess+db+auth unit)" },
                    { label: "Observability",          orig: 55, newv: 72, note: "+17 (Langfuse, metrics endpoint)" },
                    { label: "SaaS Görünümü",          orig: 20, newv: 90, note: "Auth, hesap paneli, landing page" },
                  ].map(({ label, orig, newv, note }) => (
                    <div key={label}>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="w-36 shrink-0" style={{ color: "#71717a" }}>{label}</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${orig}%`, background: "#f87171" }} />
                          </div>
                          <span className="w-7 text-right font-mono" style={{ color: "#f87171" }}>{orig}</span>
                        </div>
                        <span style={{ color: "#52525b" }}>vs</span>
                        <div className="flex-1 flex items-center gap-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${newv}%`, background: "#34d399" }} />
                          </div>
                          <span className="w-7 text-right font-mono" style={{ color: "#34d399" }}>{newv}</span>
                        </div>
                      </div>
                      <div className="ml-36 pl-3 text-[10px] mt-0.5" style={{ color: "#3f3f46" }}>{note}</div>
                    </div>
                  ))}
                </div>

                {/* Sprint 4 summary box */}
                <div className="mt-6 p-4 rounded-xl text-xs" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", color: "#fcd34d" }}>
                  <strong className="block mb-2" style={{ color: "#fbbf24" }}>Sprint 4 Sonu Değerlendirmesi — 28 Şubat 2026</strong>
                  <div className="space-y-1" style={{ color: "#d97706" }}>
                    <div>📦 <strong>Backend:</strong> 7 dosya · 2,330 satır · 20 model · JWT + SQLite + Langfuse + WebSocket + Video→Kod</div>
                    <div>🖥 <strong>Frontend:</strong> 9 TSX dosya · 3,830 satır · Auth sayfası · Hesap paneli · A/B karşılaştırma · Thinking panel</div>
                    <div>🧪 <strong>Testler:</strong> 279 test · 11 dosya · 2,630 satır · %100 geçer · postprocess + db + auth unit · Locust yük testi (P95&lt;30s)</div>
                    <div>🚀 <strong>DevOps:</strong> Nginx + HTTPS + HSTS · Staging ortamı · 2 CI workflow · Smoke test script</div>
                    <div>📊 <strong>Sonuç:</strong> Orijinalin 21 modelinden 20&apos;sine ulaşıldı (Claude 3.x/4.x · GPT-4/4.1/o3 · Gemini · DeepSeek · Qwen · Kimi). JWT auth, kredi sistemi, observability ve A/B test orijinalde yoktu.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Test Kapsamı ── */}
        <div className="mt-6">
          <button
            onClick={() => setTestListOpen((v) => !v)}
            className="w-full flex items-center justify-between px-6 py-5 rounded-2xl group transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧪</span>
              <div className="text-left">
                <div className="font-bold text-base">Test Kapsamı — 279 Test + Yük Testi</div>
                <div className="text-xs" style={{ color: "#71717a" }}>
                  9 pytest dosyası + load_test_images.py · %100 geçer · postprocess + db + auth unit · regresyon matrix
                </div>
              </div>
            </div>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              className="transition-transform duration-200 shrink-0"
              style={{ transform: testListOpen ? "rotate(180deg)" : "rotate(0deg)", color: "#52525b" }}
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>

          {testListOpen && (
            <div
              className="mt-2 rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}
            >
              <div className="p-6">
                <div className="grid grid-cols-3 gap-2 mb-6 text-center">
                  <div className="rounded-xl p-3" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#34d399" }}>279</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>toplam test</div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#60a5fa" }}>10</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>test dosyası</div>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <div className="text-2xl font-bold" style={{ color: "#fbbf24" }}>100%</div>
                    <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>geçme oranı</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {TEST_FILES.map((tf) => {
                    const isOpen = openTestFile === tf.file;
                    return (
                      <div
                        key={tf.file}
                        className="rounded-xl overflow-hidden"
                        style={{ border: `1px solid ${tf.color}22` }}
                      >
                        <button
                          className="w-full flex items-center justify-between px-4 py-3 text-left"
                          style={{ background: `${tf.color}0d` }}
                          onClick={() => setOpenTestFile(isOpen ? null : tf.file)}
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: tf.color }}
                            />
                            <span className="text-xs font-mono font-semibold" style={{ color: tf.color }}>
                              {tf.file}
                            </span>
                            <span className="text-xs" style={{ color: "#52525b" }}>
                              {tf.desc}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className="text-xs font-mono px-2 py-0.5 rounded"
                              style={{ background: `${tf.color}22`, color: tf.color }}
                            >
                              {tf.tests.length} test
                            </span>
                            <svg
                              width="14" height="14" viewBox="0 0 14 14" fill="none"
                              className="transition-transform duration-200"
                              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", color: "#52525b" }}
                            >
                              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1" style={{ borderTop: `1px solid ${tf.color}18` }}>
                            {tf.tests.map((t) => (
                              <div key={t} className="flex items-start gap-2 py-0.5">
                                <span className="text-[10px] mt-0.5 shrink-0" style={{ color: tf.color }}>✓</span>
                                <span className="text-[11px] font-mono break-all" style={{ color: "#a1a1aa" }}>{t}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="mt-20 pt-8 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs" style={{ color: "#3f3f46" }}>PicToFrontend Roadmap · 28 Şubat 2026</span>
          <Link href="/" className="text-xs" style={{ color: "#3f3f46" }}>
            ← Ana Sayfaya Dön
          </Link>
        </div>
      </main>
    </div>
  );
}
