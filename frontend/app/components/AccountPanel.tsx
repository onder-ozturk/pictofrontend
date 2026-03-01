"use client";

/**
 * Sprint 4 — s4-f3
 * Hesap Paneli:
 *   - Kredi bakiyesi (API'den)
 *   - Son 20 işlem geçmişi
 *   - Model başına harcama özeti
 *   - Çıkış butonu
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X, Coins, LogOut, RefreshCw, TrendingDown, TrendingUp,
  Clock, User, Loader2, AlertCircle,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const AUTH_TOKEN_KEY  = "ptf_token";
export const AUTH_EMAIL_KEY  = "ptf_email";
export const AUTH_USERID_KEY = "ptf_user_id";

interface LedgerEntry {
  id: number;
  delta: number;
  model: string;
  endpoint: string;
  note: string;
  created_at: string;
}

interface AccountData {
  email: string;
  balance: number;
  created_at: string;
}

interface Props {
  onClose: () => void;
  token: string;
  email: string;
}

export default function AccountPanel({ onClose, token, email }: Props) {
  const router = useRouter();
  const [account, setAccount]     = useState<AccountData | null>(null);
  const [ledger, setLedger]       = useState<LedgerEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [topupLoading, setTopupLoading] = useState(false);

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, histRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auth/me`,           { headers: authHeaders }),
        fetch(`${BACKEND_URL}/api/credits/history`,   { headers: authHeaders }),
      ]);
      if (!meRes.ok || !histRes.ok) throw new Error("Veriler yüklenemedi.");
      const me   = await meRes.json();
      const hist = await histRes.json();
      setAccount({ email: me.email, balance: me.balance, created_at: me.created_at });
      setLedger(hist.transactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata oluştu.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTopup = async (amount: number) => {
    setTopupLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/credits/topup`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(amount),
      });
      if (!res.ok) throw new Error("Yükleme başarısız.");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hata.");
    } finally {
      setTopupLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EMAIL_KEY);
    localStorage.removeItem(AUTH_USERID_KEY);
    onClose();
    router.push("/auth");
  };

  // Spending by model
  const modelSpend = ledger
    .filter((e) => e.delta < 0 && e.model)
    .reduce<Record<string, number>>((acc, e) => {
      acc[e.model] = (acc[e.model] ?? 0) + Math.abs(e.delta);
      return acc;
    }, {});

  const topModels = Object.entries(modelSpend)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[360px] bg-[#0f0f0f] border-l border-white/[0.08] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center">
              <User size={14} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{email}</p>
              <p className="text-gray-600 text-[11px]">Hesabım</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors"
              title="Yenile"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 h-40">
              <Loader2 size={20} className="text-blue-400 animate-spin" />
              <p className="text-gray-500 text-sm">Yükleniyor…</p>
            </div>
          )}

          {error && (
            <div className="m-5 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && account && (
            <>
              {/* Balance card */}
              <div className="m-5 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                <p className="text-amber-400/70 text-[11px] font-semibold uppercase tracking-wide mb-1">
                  Kredi Bakiyesi
                </p>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-amber-400 leading-none">
                    {account.balance}
                  </span>
                  <span className="text-amber-500/60 text-sm pb-0.5">kredi</span>
                </div>
                <div className="flex gap-2 mt-4">
                  {[50, 100, 200].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleTopup(amt)}
                      disabled={topupLoading}
                      className="flex-1 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20
                        text-amber-400 text-[11px] font-semibold transition-colors disabled:opacity-50"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model spending */}
              {topModels.length > 0 && (
                <div className="px-5 mb-5">
                  <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-3">
                    Model Başına Harcama
                  </p>
                  <div className="flex flex-col gap-2">
                    {topModels.map(([model, spent]) => (
                      <div key={model} className="flex items-center gap-2">
                        <span className="text-gray-400 text-[12px] flex-1 truncate">{model}</span>
                        <div className="flex items-center gap-1">
                          <Coins size={10} className="text-amber-500" />
                          <span className="text-amber-400 text-[12px] font-semibold">{spent}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction history */}
              <div className="px-5 pb-5">
                <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-3">
                  Son İşlemler
                </p>
                {ledger.length === 0 ? (
                  <p className="text-gray-600 text-[12px] text-center py-6">
                    Henüz işlem yok.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {ledger.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]"
                      >
                        <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0
                          ${entry.delta < 0
                            ? "bg-red-500/10 border border-red-500/20"
                            : "bg-green-500/10 border border-green-500/20"}`}
                        >
                          {entry.delta < 0
                            ? <TrendingDown size={10} className="text-red-400" />
                            : <TrendingUp size={10} className="text-green-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-gray-300 leading-tight truncate">
                            {entry.model || entry.note || entry.endpoint || "İşlem"}
                          </p>
                          <p className="text-[10px] text-gray-600 flex items-center gap-1 mt-0.5">
                            <Clock size={8} />
                            {formatDate(entry.created_at)}
                          </p>
                        </div>
                        <span className={`text-[13px] font-bold shrink-0
                          ${entry.delta < 0 ? "text-red-400" : "text-green-400"}`}>
                          {entry.delta > 0 ? "+" : ""}{entry.delta}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/[0.06] px-5 py-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
              text-[13px] text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10
              border border-red-500/15 hover:border-red-500/30 transition-all"
          >
            <LogOut size={14} /> Çıkış Yap
          </button>
        </div>
      </div>
    </>
  );
}
