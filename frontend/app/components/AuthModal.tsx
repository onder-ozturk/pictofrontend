"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const AUTH_TOKEN_KEY  = "ptf_token";
export const AUTH_EMAIL_KEY  = "ptf_email";
export const AUTH_USERID_KEY = "ptf_user_id";

type Mode = "login" | "register";

interface Props {
  onClose: () => void;
  onSuccess: (token: string, email: string) => void;
  initialMode?: Mode;
}

export default function AuthModal({ onClose, onSuccess, initialMode = "register" }: Props) {
  const mode = initialMode;
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [mounted, setMounted]   = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const reset = () => setError(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    reset();
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }
    if (mode === "register" && password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const res = await fetch(
        mode === "register"
          ? `${BACKEND_URL}/api/auth/register`
          : `${BACKEND_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.detail ?? "Something went wrong.");

      localStorage.setItem(AUTH_TOKEN_KEY,  data.access_token);
      localStorage.setItem(AUTH_EMAIL_KEY,  data.email);
      localStorage.setItem(AUTH_USERID_KEY, data.user_id);

      onSuccess(data.access_token, data.email);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server error.");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200]"
        style={{ background: "rgba(255,255,255,0.55)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      />

      {/* Modal card — tam ortada */}
      <div
        className="fixed z-[201] w-full max-w-[400px] max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#f9f6f0",
          color: "#111",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-black/10 transition-colors z-10"
        >
          <X size={15} />
        </button>

        <div className="px-8 pt-10 pb-8">
          {/* Header */}
          <div className="text-center mb-7">
            <h2 className="text-[17px] font-semibold text-gray-900 mb-1">
              {mode === "register" ? "Create your account" : "Sign in to your account"}
            </h2>
            <p className="text-[13px] text-gray-500">
              {mode === "register"
                ? "Welcome! Please fill in the details to get started."
                : "Welcome back! Please enter your details."}
            </p>
          </div>

          {/* Social buttons */}
          <div className="flex gap-3 mb-5">
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-[13px] font-medium text-gray-700 transition-colors shadow-sm"
            >
              {/* GitHub icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </button>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-[13px] font-medium text-gray-700 transition-colors shadow-sm"
            >
              {/* Google icon */}
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-[12px] text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                autoComplete="email"
                autoFocus
                className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50 focus:border-gray-400 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 pr-10 text-[13px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/50 focus:border-gray-400 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-[14px] text-white transition-all disabled:opacity-60"
              style={{ background: "#1a1a1a" }}
            >
              {loading ? "Processing…" : (
                <>Continue <span className="text-gray-400">▶</span></>
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="mt-5 pt-5 border-t border-gray-200 text-center">
            <p className="text-[13px] text-gray-500">
              {mode === "register" ? "Already have an account? " : "Don't have an account? "}
              <Link
                href={mode === "register" ? "/sign-in" : "/sign-up"}
                className="text-gray-900 font-semibold hover:underline"
              >
                {mode === "register" ? "Sign in" : "Sign up"}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 border-t border-gray-200 bg-gray-50/80 flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-gray-400">Secured by</span>
            <span className="text-[11px] font-semibold text-gray-600">PicToFrontend</span>
          </div>
          <p className="text-[10px] text-gray-400 leading-tight">
            By signing up, you accept our terms of service and consent to receiving occasional product updates via email.
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}
