import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OriginOS Dock",
};

export default function DockLayout({ children }: { children: React.ReactNode }) {
  return children;
}
