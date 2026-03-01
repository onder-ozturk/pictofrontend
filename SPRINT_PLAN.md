# PicToFrontend — Sprint Planı
## MVP'den Platforma Geçiş — 3 Sprint × 2 Hafta

---

## Sprint 1 — Core Stabilizasyon + Güvenli Üretim Akışı (Hafta 1-2)

### Backend
| # | Görev | SP |
|---|-------|----|
| S1 | Pydantic ile tipli payload şeması (GenerateRequest, GenerateChunk, GenerateError) | 5 |
| S2 | Model seçimini `backend/models.py` modülüne taşı | 3 |
| S3 | Hata formatını `{type, code, message}` olarak standartlaştır | 3 |
| S4 | Upload validasyonu: MIME tipi, boyut limiti (20MB), timeout | 3 |
| S5 | Streaming resource cleanup — `finally` bloğu ile güvenli kapanış | 3 |
| S12 | IP tabanlı rate-limit middleware → 429 yanıtı | 5 |

### Frontend
| # | Görev | SP |
|---|-------|----|
| S6 | UI durum makinesi: `idle / sending / streaming / success / error` | 5 |
| S7 | API key doğrulama ve anlık hata geri bildirimi | 2 |
| S8 | Stream içeriği ve hata mesajını ayrı alanlarda göster | 2 |
| S9 | Kredi tüketimi yarış durumu koruması (negatif bakiye engeli) | 3 |

### Güvenlik
| # | Görev | SP |
|---|-------|----|
| S10 | Log maskeleme — API key loglarda `sk-***` şeklinde gizlenmeli | 2 |
| S11 | CORS sıkılaştırma — wildcard kaldır, izinli origin listesi tanımla | 3 |

### QA
| # | Görev | SP |
|---|-------|----|
| S13 | Test iskeleti: `tests/test_api_contracts.py`, `tests/test_validation.py` | 5 |
| S14 | 5 kritik e2e senaryo: boş alan, geçersiz dosya, geçersiz key, başarılı stream, hata | 5 |
| S15 | README: stream state'leri ve hata formatı dökümantasyonu | 2 |

**Sprint 1 Toplam: 52 SP**

**Çıkış Kriterleri:**
- Tüm hata yanıtları tutarlı JSON formatında
- UI state deterministik, butonlar doğru kilitleniyor
- MIME/boyut/timeout validasyonu devrede
- En az 5 otomatik test yeşil

---

## Sprint 2 — Kritik Özellik Eşleşmesi (Hafta 3-4)

### Backend
| # | Görev | SP |
|---|-------|----|
| S1 | `POST /api/generate/from-url` endpoint'i | 8 |
| S2 | `POST /api/generate/from-text` endpoint'i | 8 |
| S3 | URL screenshot helper servisi (timeout, redirect, SSL hata yönetimi) | 8 |
| S4 | `session_id` ile iteratif iyileştirme / geçmiş bağlam desteği | 13 |
| S5 | 3+ yeni model ekleme + metadata ile `/api/models` zenginleştirme | 8 |

### Frontend
| # | Görev | SP |
|---|-------|----|
| S6 | Sekmeli çoklu giriş modu: Screenshot / URL / Text | 8 |
| S7 | "Revise" butonu — önceki çıktı bağlamı ile yeniden üretim | 8 |
| S8 | Bootstrap framework seçeneği eklenmesi | 5 |
| S9 | Üretim ilerleme durumu göstergesi (status satırı) | 3 |

### Güvenlik
| # | Görev | SP |
|---|-------|----|
| S10 | Model payload doğrulama → desteklenmeyen model: 400/422 | 5 |
| S11 | URL güvenlik filtresi: localhost, private IP, blacklist engeli | 5 |

### QA
| # | Görev | SP |
|---|-------|----|
| S12 | 3 endpoint entegrasyon testleri: success + fail senaryoları | 5 |
| S13 | Regresyon verisi: 10 görsel + 10 URL + 10 metin prompt | 8 |

**Sprint 2 Toplam: 102 SP**

**Çıkış Kriterleri:**
- URL ve metin girişi demo olarak çalışıyor
- Iteratif iyileştirme (follow-up) en az tek tur çalışıyor
- En az 3 yeni model UI ve API'de görünür
- Güvenlik filtreleri kötü inputları engelliyor

---

## Sprint 3 — Ürün Olgunlaştırma + Dağıtım Hazırlığı (Hafta 5-6)

### Backend
| # | Görev | SP |
|---|-------|----|
| S1 | WebSocket katmanı (feature flag ile, HTTP fallback korunur) | 13 |
| S2 | `/api/models` metadata zenginleştirme: provider, cost, context_window | 5 |
| S3 | Kod post-process modülü: normalize, temizleme | 5 |
| S4 | Session bazlı commit/version geçmişi (son 5 versiyon) | 8 |
| S9 | Basit metrik ve hata sayacı (request count, error rate, latency) | 5 |

### Frontend
| # | Görev | SP |
|---|-------|----|
| S5 | Varyant karşılaştırma UI: Current / Variant B sekmeli | 8 |
| S6 | Kod editörü geliştirme: syntax highlight, düzenlenebilir alan | 8 |
| S7 | WS event durum görselleştirmesi: thinking/status paneli | 5 |

### DevOps
| # | Görev | SP |
|---|-------|----|
| S8 | Docker + docker-compose yeniden eklenmesi | 5 |
| S10 | CI pipeline: lint + test + e2e + smoke | 8 |

### QA / Güvenlik
| # | Görev | SP |
|---|-------|----|
| S11 | Yük testleri: 100 görsel isteği, başarı oranı ve latency ölçümü | 8 |
| S12 | Güvenli dağıtım hardening checklist (HTTPS, CORS, rate-limit, log redaction) | 5 |

**Sprint 3 Toplam: 83 SP**

**Çıkış Kriterleri:**
- WebSocket opsiyonel ve stabil
- Commit/variant altyapısı MVP düzeyde çalışıyor
- Docker ile tek komut deploy
- CI pipeline yeşil olmadan release yok

---

## Özet Tablo

| Sprint | Süre | SP | Odak |
|--------|------|----|------|
| Sprint 1 | Hafta 1-2 | 52 | Stabilizasyon + Güvenlik |
| Sprint 2 | Hafta 3-4 | 102 | Özellik Eşleşmesi |
| Sprint 3 | Hafta 5-6 | 83 | Platform Olgunluğu |
| **TOPLAM** | **6 Hafta** | **237** | |

---

## Sonraki Adım (Sprint 4 önerisi)

- Full değerlendirme framework (A/B test, pairwise comparison)
- Advanced observability (Langfuse veya benzeri)
- Kullanıcı hesapları ve kalıcı kredi sistemi
- Ekran kaydı / video girişi backend desteği
