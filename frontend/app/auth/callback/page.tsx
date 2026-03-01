"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AUTH_TOKEN_KEY, AUTH_EMAIL_KEY } from "../../components/AuthModal";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const email = params.get("email");
    const error = params.get("error");

    if (error) {
      router.replace(`/sign-in?error=${encodeURIComponent(error)}`);
      return;
    }

    if (token && email) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_EMAIL_KEY, email);
      router.replace("/app");
    } else {
      router.replace("/sign-in");
    }
  }, [params, router]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f3ee" }}>
      <p style={{ color: "#666", fontSize: 14 }}>Signing you in…</p>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f5f3ee" }}>
        <p style={{ color: "#666", fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
