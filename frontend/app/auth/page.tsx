"use client";

/**
 * Sprint 4 — s4-f2
 * Kullanıcı kayıt / giriş sayfası:
 *   - Email + şifre formu
 *   - Login ↔ Register toggle
 *   - JWT token'ı localStorage'da saklar (ptf_token, ptf_email)
 *   - Başarılı girişte /app'e yönlendirir
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle2, Loader2,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const AUTH_TOKEN_KEY  = "ptf_token";
export const AUTH_EMAIL_KEY  = "ptf_email";
export const AUTH_USERID_KEY = "ptf_user_id";

type Mode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode]           = useState<Mode>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  // Already logged in → redirect
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(AUTH_TOKEN_KEY)) {
      router.replace("/app");
    }
  }, [router]);

  const reset = () => { setError(null); setSuccess(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    if (!email.trim() || !password.trim()) {
      setError("E-posta ve şifre gereklidir.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "register"
        ? `${BACKEND_URL}/api/auth/register`
        : `${BACKEND_URL}/api/auth/login`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.message ?? data?.detail ?? "İşlem başarısız.";
        throw new Error(msg);
      }

      // Persist token + email
      localStorage.setItem(AUTH_TOKEN_KEY,  data.access_token);
      localStorage.setItem(AUTH_EMAIL_KEY,  data.email);
      localStorage.setItem(AUTH_USERID_KEY, data.user_id);

      setSuccess(mode === "register"
        ? "Hesap oluşturuldu! Yönlendiriliyor…"
        : "Giriş yapıldı! Yönlendiriliyor…");

      setTimeout(() => router.push("/app"), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sunucu hatası.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => { setMode(m); reset(); };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      {/* Logo */}
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2.5 mb-10 justify-center select-none">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-black font-black text-lg leading-none">/</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Pic<span className="text-blue-400">ToFrontend</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-8 shadow-2xl">
          {/* Mode toggle */}
          <div className="flex bg-[#161616] border border-white/[0.06] rounded-xl p-1 mb-7">
            <button
              onClick={() => switchMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${mode === "login" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
                ${mode === "register" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Kayıt Ol
            </button>
          </div>

          <h1 className="text-white text-xl font-semibold mb-1">
            {mode === "login" ? "Tekrar hoş geldiniz" : "Hesap oluşturun"}
          </h1>
          <p className="text-gray-500 text-sm mb-7">
            {mode === "login"
              ? "Devam etmek için giriş yapın."
              : "100 ücretsiz krediyle başlayın."}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                E-posta
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="siz@ornek.com"
                  autoComplete="email"
                  className="w-full bg-[#161616] border border-white/[0.08] focus:border-blue-500/50 rounded-lg
                    pl-9 pr-3 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                Şifre {mode === "register" && <span className="text-gray-600 normal-case">(en az 8 karakter)</span>}
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-[#161616] border border-white/[0.08] focus:border-blue-500/50 rounded-lg
                    pl-9 pr-10 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-[12px]">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-[14px]
                bg-blue-600 hover:bg-blue-500 text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed
                shadow-lg shadow-blue-500/20 mt-1"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> İşleniyor…</>
              ) : mode === "login" ? (
                "Giriş Yap"
              ) : (
                "Hesap Oluştur"
              )}
            </button>
          </form>

          <p className="text-center text-gray-600 text-[12px] mt-6">
            {mode === "login" ? "Hesabınız yok mu? " : "Zaten hesabınız var mı? "}
            <button
              onClick={() => switchMode(mode === "login" ? "register" : "login")}
              className="text-blue-400 hover:underline"
            >
              {mode === "login" ? "Kayıt Ol" : "Giriş Yap"}
            </button>
          </p>
        </div>

        <p className="text-center text-gray-700 text-[11px] mt-6">
          Devam ederek{" "}
          <Link href="/" className="hover:text-gray-500 transition-colors">Kullanım Koşullarını</Link>
          {" "}kabul etmiş olursunuz.
        </p>
      </div>
    </div>
  );
}
