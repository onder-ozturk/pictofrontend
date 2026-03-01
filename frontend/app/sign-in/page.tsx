"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const AUTH_TOKEN_KEY = "ptf_token";
const AUTH_EMAIL_KEY = "ptf_email";
const AUTH_USERID_KEY = "ptf_user_id";

export default function SignInPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(AUTH_TOKEN_KEY)) {
      router.replace("/app");
    }
  }, [router]);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setStep("password");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) { setError("Email and password are required."); return; }

    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.detail ?? "Sign in failed.");

      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      localStorage.setItem(AUTH_EMAIL_KEY, data.email);
      localStorage.setItem(AUTH_USERID_KEY, data.user_id);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Server error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#e8e9ea]">
      <div className="relative w-full max-w-[400px]">
        {/* Secured by clerk badge */}
        <div className="absolute top-[52px] -left-[28px] w-[30px] py-4 bg-[#0a0a0a] rounded-l-[10px] flex flex-col items-center justify-center pointer-events-none z-0">
          <div
            className="flex items-center gap-1.5 text-white whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            <span className="text-[11px] text-[#A1A1AA] tracking-wide">Secured by</span>
            <span className="font-bold text-[13px] flex items-center gap-1 tracking-tight">
              <svg width="12" height="12" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M65.5 30A29.5 29.5 0 1 0 65.5 89V67.5A15.5 15.5 0 1 1 65.5 44V30Z" fill="white" />
                <circle cx="80" cy="59.5" r="13.5" fill="white" />
              </svg>
              clerk
            </span>
          </div>
        </div>

        {/* Main Card */}
        <div className="relative z-10 bg-white rounded-[1.25rem] shadow-sm sm:px-10 px-8 py-10 border border-[#e5e7eb]">
          <h1 className="text-[20px] font-semibold text-[#111827] mb-1">Sign in</h1>
          <p className="text-[14px] text-[#6b7280] mb-8">
            to continue to Screenshot to Code
          </p>

          {step === "email" ? (
            <>
              {/* Social Buttons */}
              <div className="flex flex-col gap-3 mb-8">
                <button
                  type="button"
                  onClick={() => window.location.href = `${BACKEND_URL}/api/auth/github/login`}
                  className="w-full flex items-center justify-center gap-3 px-4 py-[10px] rounded-[6px] border border-gray-200 bg-white hover:bg-gray-50 text-[14px] font-medium text-[#111827] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Continue with GitHub
                </button>
                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 px-4 py-[10px] rounded-[6px] border border-gray-200 bg-white hover:bg-gray-50 text-[14px] font-medium text-[#111827] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 h-px bg-[#e5e7eb]" />
                <span className="text-[13px] text-[#6b7280]">or</span>
                <div className="flex-1 h-px bg-[#e5e7eb]" />
              </div>

              <form onSubmit={handleContinue}>
                <label className="block text-[13px] text-[#111827] mb-2 font-medium">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  className="w-full rounded-[6px] border border-[#d1d5db] px-3.5 py-[9px] text-[14px] text-gray-900 focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-shadow bg-white mb-6"
                />

                {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

                <button
                  type="submit"
                  className="w-full py-[10px] rounded-[6px] font-bold text-[13px] tracking-[0.02em] text-white transition-all bg-[#0A0A0A] hover:bg-[#1f1f1f]"
                >
                  CONTINUE
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handleLogin}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[13px] text-[#111827] font-medium">
                  Password
                </label>
                <button type="button" onClick={() => setStep("email")} className="text-[13px] text-[#6b7280] hover:text-[#111827]">
                  ← Back
                </button>
              </div>
              <div className="relative mb-6">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  className="w-full rounded-[8px] border border-gray-300 px-3.5 py-2.5 pr-10 text-[14px] text-gray-900 focus:outline-none focus:ring-[3px] focus:ring-gray-100 focus:border-gray-400 transition-shadow shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {error && <p className="text-[13px] text-red-600 mb-4">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-[8px] font-semibold text-[13px] tracking-wide text-white transition-all bg-[#0A0A0A] hover:bg-[#1f1f1f] disabled:opacity-60"
              >
                {loading ? "SIGNING IN..." : "SIGN IN"}
              </button>
            </form>
          )}

          <div className="mt-8 text-[14px] text-gray-500">
            No account?{" "}
            <Link href="/sign-up" className="text-[#111827] hover:underline">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

