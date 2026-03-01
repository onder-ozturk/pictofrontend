"use client";

import { useState } from "react";
import AuthModal from "./AuthModal";

export default function SignInButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm landing-text-muted hover-line hidden sm:block"
      >
        Sign in
      </button>

      {open && (
        <AuthModal
          onClose={() => setOpen(false)}
          onSuccess={() => setOpen(false)}
        />
      )}
    </>
  );
}
