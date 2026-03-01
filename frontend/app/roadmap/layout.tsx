import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Roadmap | PicToFrontend",
  description: "PicToFrontend ürün yol haritası: 3 sprintteki geliştirme planı, görev kontrolü ve ilerleme takibi.",
};

export default function RoadmapLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
