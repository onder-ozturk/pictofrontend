"use client";

import dynamic from "next/dynamic";

// ssr: false yalnızca Client Component içinde kullanılabilir.
// Browser extension'lar SSR HTML'ine class ekleyerek hydration mismatch yaratır;
// client-only render bunu önler.
const Tweet = dynamic(
  () => import("react-tweet").then((mod) => ({ default: mod.Tweet })),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-2xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
    ),
  }
);

export default function TweetEmbed({ id }: { id: string }) {
  return <Tweet id={id} />;
}
