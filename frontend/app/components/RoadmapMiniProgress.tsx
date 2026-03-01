"use client";

import { useEffect, useState } from "react";
import {
  ROADMAP_METRICS_KEY,
  ROADMAP_STORAGE_KEY,
  ROADMAP_UPDATE_AT_KEY,
  ROADMAP_UPDATE_COUNT_KEY,
  getRoadmapProgress,
} from "../lib/roadmapProgress";

type Props = {
  compact?: boolean;
  className?: string;
};

function formatTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RoadmapMiniProgress({ compact = false, className = "" }: Props) {
  const [progress, setProgress] = useState(() => getRoadmapProgress());

  useEffect(() => {
    const refresh = () => {
      setProgress(getRoadmapProgress());
    };

    const onStorage = (event: StorageEvent) => {
      const key = event.key;
      if (
        key === ROADMAP_STORAGE_KEY ||
        key === ROADMAP_UPDATE_COUNT_KEY ||
        key === ROADMAP_UPDATE_AT_KEY ||
        key === ROADMAP_METRICS_KEY
      ) {
        refresh();
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 2000);
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const widthStyle = { width: `${progress.completionPct}%` };
  const remainingMessage =
    progress.completionPct >= 100
      ? "100% tamamlandı"
      : `${progress.remainingTasks} görev kaldı`;
  const statusClasses =
    progress.completionPct >= 100
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/5"
      : "text-blue-300 border-blue-500/25 bg-blue-500/5";

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${statusClasses} ${className}`}
      style={{ minWidth: compact ? 210 : 240 }}
    >
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-white/75">Roadmap İlerleme</span>
        <span className="font-mono text-white/90">{progress.completionPct}%</span>
      </div>

      <div className="mt-1.5 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full bg-current transition-all duration-300" style={widthStyle} />
      </div>

      <div className="mt-1.5 text-[11px] text-white/60 flex items-center justify-between gap-2">
        <span>
          {progress.completedTasks}/{progress.taskCount} görev · {progress.updateCount} güncelleme
        </span>
        <span>{remainingMessage}</span>
      </div>
      {!compact && (
        <div className="mt-1 text-[10px] text-white/45">
          Son güncelleme: {formatTime(progress.lastUpdateAt || progress.metricsUpdatedAt)}
        </div>
      )}
    </div>
  );
}
