# 🖼️ Screenshot to Code

Lokalde çalışan, yapay zeka destekli bir Screenshot-to-Code uygulaması. Ekran görüntülerini HTML, React veya Vue koduna dönüştürür.

![Screenshot](https://placehold.co/800x400/0f0f0f/6366f1?text=Screenshot+to+Code)

## ✨ Özellikler

- 🤖 **Birden Fazla AI Modeli**: Claude 3.5 Sonnet, GPT-4o, GPT-4o Mini, Gemini 1.5 Flash
- ⚡ **Gerçek Zamanlı Streaming**: Kod, karakter karakter yazılır gibi gelir
- 🎨 **Framework Seçimi**: HTML, React, Vue desteği
- 💰 **Kredi Sistemi**: Her model farklı kredi maliyeti (1-2-3-5)
- 🔒 **Güvenli**: API anahtarlarınız sadece AI servislerine gönderilir, saklanmaz
- 📱 **Responsive**: Modern dark mode arayüz

## 🚀 Hızlı Başlangıç

### 1. Projeyi İndir

```bash
cd screenshottocode_
```

### 2. Backend'i Kur ve Çalıştır

```bash
cd backend

# Sanal ortam oluştur (opsiyonel ama önerilir)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# veya: venv\Scripts\activate  # Windows

# Bağımlılıkları yükle
pip install -r requirements.txt

# Sunucuyu başlat
uvicorn main:app --reload
```

Backend çalışıyor olmalı: http://localhost:8000

### 3. Frontend'i Aç

Basit yöntem (VS Code):
```
1. VS Code'da frontend klasörünü aç
2. Live Server eklentisini kur
3. index.html'e sağ tık → "Open with Live Server"
```

Alternatif (Python):
```bash
cd frontend
python -m http.server 5500
```

Tarayıcıda aç: http://localhost:5500

### 4. API Anahtarı Al

- **OpenAI**: https://platform.openai.com/api-keys
- **Claude**: https://console.anthropic.com/settings/keys
- **Gemini**: https://aistudio.google.com/app/apikey

Anahtarınızı uygulamaya yapıştırın!

## 📁 Proje Yapısı

```
screenshottocode_/
├── backend/
│   ├── main.py              # FastAPI uygulaması
│   └── requirements.txt     # Python bağımlılıkları
├── frontend/
│   ├── index.html           # Ana HTML
│   ├── styles.css           # Stil dosyası
│   └── app.js               # Frontend mantığı
└── README.md                # Bu dosya
```

## 💳 Kredi Sistemi & Maliyetler

| Model | Kredi/Üretim | Tahmini Maliyet |
|-------|-------------|----------------|
| GPT-4o Mini | 1 | ~$0.001 |
| GPT-4o | 3 | ~$0.024 |
| Claude 3.5 Sonnet | 5 | ~$0.035 |
| Gemini 1.5 Flash | 2 | ~$0.007 |

Örnek: 100 üretim
- GPT-4o Mini: ~$0.12
- GPT-4o: ~$2.40
- Claude 3.5: ~$3.50
- Gemini 1.5 Flash: ~$1.75

## 🔧 API Endpoints

### Health Check
```bash
GET http://localhost:8000/health
```

### Kod Üretimi (Streaming)
```bash
POST http://localhost:8000/api/generate
Content-Type: multipart/form-data

Fields:
- image: File (PNG, JPG, WEBP)
- api_key: string
- model: "claude" | "gpt4o" | "gpt4o-mini" | "gemini"
- framework: "html" | "react" | "vue"

Response: text/plain (streaming)
```

### Modelleri Listele
```bash
GET http://localhost:8000/api/models
```

## 🛠️ Geliştirme

### Yeni Model Ekleme

`backend/main.py` içinde:

```python
async def generate_with_new_model(api_key, image_base64, framework):
    # Model entegrasyonu
    pass
```

### Prompt Özelleştirme

`SYSTEM_PROMPT` değişkenini `backend/main.py` içinde düzenleyin.

## 📝 Prompt Engineering İpuçları

Daha iyi sonuçlar için:

1. **Yüksek kaliteli screenshot** kullanın
2. **Claude 3.5 Sonnet** en iyi UI sonuçlarını verir
3. **Framework seçimini** doğru yapın (HTML = en hızlı)
4. **Low detail mode** basit UI'lar için yeterli (maliyet düşer)

## 🐛 Hata Ayıklama

### Backend bağlanmıyor
```bash
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
python -m http.server 5500
```

### CORS hatası
Backend `main.py` içinde `allow_origins=["*"]` ayarlıdır. Sorun devam ederse:
```python
allow_origins=["http://localhost:5500", "http://127.0.0.1:5500"]
```

### API Key hatası
- Key'in başında `sk-` (OpenAI), `sk-ant-` (Claude) veya `AIza` (Gemini) olduğundan emin olun
- Kredi/kota olup olmadığını kontrol edin

## 🎯 Yol Haritası

- [x] Temel kod üretimi
- [x] Streaming yanıt
- [x] Çoklu model desteği
- [x] Framework seçimi
- [ ] DALL-E/Stable Diffusion entegrasyonu (görsel üretimi)
- [ ] History/kayıt sistemi
- [ ] Export (ZIP, GitHub)
- [ ] Figma/Sketch entegrasyonu

## 📄 Lisans

MIT License - Özgürce kullanın ve geliştirin!

## 🤝 Katkıda Bulun

1. Fork yapın
2. Branch oluşturun (`git checkout -b feature/amazing`)
3. Commit yapın (`git commit -m 'Add amazing'`)
4. Push yapın (`git push origin feature/amazing`)
5. Pull Request açın

---

**Not**: API anahtarlarınızı asla paylaşmayın ve GitHub'a pushlamayın!
