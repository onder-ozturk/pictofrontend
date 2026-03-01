"use client";

/**
 * Sprint 4 — s4-q1
 * A/B Model Karşılaştırma Sayfası:
 *   - Aynı görsel / metin → 2 farklı model ile eş zamanlı üretim
 *   - Pairwise karşılaştırma: yan yana kod görüntüleme
 *   - Kazanan seçimi + notlar
 */

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Upload, Zap, CheckCircle2, XCircle,
  Loader2, RotateCcw, Copy, Check, Scale,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const MODELS = [
  { id: "claude",            label: "Claude 3.5 Sonnet" },
  { id: "claude-opus",       label: "Claude 3.5 Opus" },
  { id: "claude-haiku",      label: "Claude 3.5 Haiku" },
  { id: "gpt4o",             label: "GPT-4o" },
  { id: "gpt4o-mini",        label: "GPT-4o Mini" },
  { id: "gemini",            label: "Gemini 2.0 Flash" },
  { id: "gemini-pro",        label: "Gemini 1.5 Pro" },
];

const FRAMEWORKS = ["html", "react", "vue", "bootstrap", "svelte", "alpine"];

interface ModelResult {
  model: string;
  output: string;
  error: string | null;
}

interface CompareResult {
  model_a: ModelResult;
  model_b: ModelResult;
}

export default function ComparePage() {
  const [apiKey, setApiKey]       = useState("");
  const [modelA, setModelA]       = useState("claude");
  const [modelB, setModelB]       = useState("gpt4o");
  const [framework, setFramework] = useState("html");
  const [imageB64, setImageB64]   = useState<string | null>(null);
  const [imageMime, setImageMime] = useState("image/png");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<CompareResult | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const [winner, setWinner]   = useState<"a" | "b" | null>(null);
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const [header, b64] = dataUrl.split(",");
      const mime = header.match(/data:([^;]+)/)?.[1] ?? "image/png";
      setImageB64(b64);
      setImageMime(mime);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) handleFile(file);
    },
    [handleFile],
  );

  const handleCompare = async () => {
    if (!apiKey.trim()) { setError("API anahtarı gereklidir."); return; }
    if (!imageB64 && !textPrompt.trim()) { setError("Görsel veya metin prompt giriniz."); return; }
    if (modelA === modelB) { setError("İki farklı model seçiniz."); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    setWinner(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key:    apiKey.trim(),
          model_a:    modelA,
          model_b:    modelB,
          framework,
          image_b64:  imageB64 ?? undefined,
          media_type: imageMime,
          text_prompt: textPrompt.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `HTTP ${res.status}`);
      }

      const data: CompareResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async (code: string, side: "a" | "b") => {
    await navigator.clipboard.writeText(code);
    if (side === "a") { setCopiedA(true); setTimeout(() => setCopiedA(false), 1500); }
    else              { setCopiedB(true); setTimeout(() => setCopiedB(false), 1500); }
  };

  const reset = () => {
    setResult(null); setError(null); setWinner(null);
    setImageB64(null); setImagePreview(null); setTextPrompt("");
  };

  const modelLabel = (id: string) =>
    MODELS.find((m) => m.id === id)?.label ?? id;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-40 px-6 py-4 flex items-center gap-3 bg-[#09090b]/80 backdrop-blur-md border-b border-white/[0.06]">
        <Link href="/app" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <ArrowLeft size={15} />
          Geri
        </Link>
        <span className="text-white/20">/</span>
        <div className="flex items-center gap-2">
          <Scale size={14} className="text-violet-400" />
          <span className="text-sm font-semibold">A/B Model Karşılaştırma</span>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Model Karşılaştırma</h1>
          <p className="text-gray-500 text-sm">
            Aynı girdiyi iki farklı modele gönderin ve çıktıları yan yana karşılaştırın.
          </p>
        </div>

        {/* Config panel */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* API Key */}
          <div className="md:col-span-3">
            <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
              API Anahtarı
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... veya AIza..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-all"
            />
          </div>

          {/* Model A */}
          <div>
            <label className="block text-[11px] text-blue-400 font-semibold uppercase tracking-wide mb-1.5">
              Model A
            </label>
            <select
              value={modelA}
              onChange={(e) => setModelA(e.target.value)}
              className="w-full bg-white/[0.04] border border-blue-500/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#1a1a1a]">{m.label}</option>
              ))}
            </select>
          </div>

          {/* Model B */}
          <div>
            <label className="block text-[11px] text-violet-400 font-semibold uppercase tracking-wide mb-1.5">
              Model B
            </label>
            <select
              value={modelB}
              onChange={(e) => setModelB(e.target.value)}
              className="w-full bg-white/[0.04] border border-violet-500/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-all"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#1a1a1a]">{m.label}</option>
              ))}
            </select>
          </div>

          {/* Framework */}
          <div>
            <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
              Framework
            </label>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 transition-all"
            >
              {FRAMEWORKS.map((f) => (
                <option key={f} value={f} className="bg-[#1a1a1a]">{f.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Input area */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Image upload */}
          <div>
            <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
              Görsel (isteğe bağlı)
            </label>
            <div
              className={`relative border-2 border-dashed rounded-2xl transition-all cursor-pointer
                ${imagePreview ? "border-white/10" : "border-white/[0.08] hover:border-white/20"}`}
              style={{ minHeight: "140px" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !imagePreview && fileRef.current?.click()}
            >
              {imagePreview ? (
                <div className="relative p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Yüklenen görsel"
                    className="rounded-xl max-h-48 mx-auto object-contain"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); setImageB64(null); setImagePreview(null); }}
                    className="absolute top-3 right-3 p-1 rounded-full bg-black/60 text-white/60 hover:text-white"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
                  <Upload size={20} className="text-gray-600" />
                  <p className="text-gray-600 text-[12px]">
                    Görsel sürükleyin veya tıklayın<br />
                    <span className="text-gray-700">PNG, JPG, WEBP — maks 20 MB</span>
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Text prompt */}
          <div>
            <label className="block text-[11px] text-gray-500 font-semibold uppercase tracking-wide mb-1.5">
              Metin Prompt (isteğe bağlı)
            </label>
            <textarea
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="Karşılaştırmak istediğiniz açıklamayı yazın...&#10;Örnek: Koyu arka planlı, mavi butonlu ve üst menüde 'Anasayfa', 'Hakkında', 'İletişim' linkleri bulunan bir landing page oluştur."
              className="w-full h-[140px] bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all resize-none"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            <XCircle size={13} />
            {error}
          </div>
        )}

        {/* Compare button */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={handleCompare}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500
              disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all"
          >
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Karşılaştırılıyor…</>
              : <><Zap size={15} /> Karşılaştır</>}
          </button>
          {result && (
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08]
                text-gray-400 hover:text-white text-sm transition-all border border-white/[0.06]"
            >
              <RotateCcw size={13} /> Sıfırla
            </button>
          )}
        </div>

        {/* Results */}
        {result && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-bold">Karşılaştırma Sonuçları</h2>
              {winner && (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                  <CheckCircle2 size={12} />
                  Kazanan: {winner === "a" ? modelLabel(modelA) : modelLabel(modelB)}
                </span>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Model A */}
              <ResultPanel
                label="Model A"
                modelName={modelLabel(modelA)}
                result={result.model_a}
                accentColor="blue"
                isWinner={winner === "a"}
                onPickWinner={() => setWinner(winner === "a" ? null : "a")}
                onCopy={() => copyCode(result.model_a.output, "a")}
                copied={copiedA}
              />

              {/* Model B */}
              <ResultPanel
                label="Model B"
                modelName={modelLabel(modelB)}
                result={result.model_b}
                accentColor="violet"
                isWinner={winner === "b"}
                onPickWinner={() => setWinner(winner === "b" ? null : "b")}
                onCopy={() => copyCode(result.model_b.output, "b")}
                copied={copiedB}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─── Result Panel ─────────────────────────────────────────────────────────── */
interface ResultPanelProps {
  label: string;
  modelName: string;
  result: ModelResult;
  accentColor: "blue" | "violet";
  isWinner: boolean;
  onPickWinner: () => void;
  onCopy: () => void;
  copied: boolean;
}

function ResultPanel({
  label, modelName, result, accentColor, isWinner, onPickWinner, onCopy, copied,
}: ResultPanelProps) {
  const color  = accentColor === "blue" ? "#60a5fa" : "#c084fc";
  const bgGlow = accentColor === "blue"
    ? "rgba(59,130,246,0.06)"
    : "rgba(139,92,246,0.06)";
  const borderColor = accentColor === "blue"
    ? (isWinner ? "rgba(59,130,246,0.4)" : "rgba(59,130,246,0.15)")
    : (isWinner ? "rgba(139,92,246,0.4)" : "rgba(139,92,246,0.15)");

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ border: `1px solid ${borderColor}`, background: bgGlow, transition: "border-color 0.2s" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color }}>
            {label}
          </span>
          <p className="text-white text-sm font-semibold leading-tight mt-0.5">{modelName}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy button */}
          {result.output && (
            <button
              onClick={onCopy}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
              title="Kopyala"
            >
              {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            </button>
          )}

          {/* Winner button */}
          <button
            onClick={onPickWinner}
            disabled={!!result.error}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
              ${isWinner
                ? "bg-green-500/20 border border-green-500/30 text-green-400"
                : "bg-white/[0.04] border border-white/[0.08] text-gray-500 hover:text-white hover:border-white/20"}`}
          >
            <CheckCircle2 size={11} />
            {isWinner ? "Kazanan" : "Seç"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {result.error ? (
          <div className="flex items-center gap-2 text-red-400 text-[12px]">
            <XCircle size={13} />
            Hata: {result.error}
          </div>
        ) : result.output ? (
          <pre
            className="text-[11px] leading-relaxed text-gray-300 overflow-auto whitespace-pre-wrap"
            style={{ maxHeight: "500px", fontFamily: "monospace" }}
          >
            {result.output}
          </pre>
        ) : (
          <p className="text-gray-600 text-[12px]">Çıktı yok.</p>
        )}
      </div>

      {/* Footer: char count */}
      {result.output && !result.error && (
        <div className="px-4 py-2 border-t text-[10px] text-gray-600 flex items-center justify-between"
             style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          <span>{result.output.length.toLocaleString("tr-TR")} karakter</span>
          <span>{result.output.split("\n").length} satır</span>
        </div>
      )}
    </div>
  );
}
