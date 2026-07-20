import type { Metadata } from "next";
import "@/styles/globals.css";
import "@xyflow/react/dist/style.css";
import GlobalSpotlight from "@/components/os/GlobalSpotlight";

export const metadata: Metadata = {
  title: "OriginOS",
  description: "AI native operating system",
};

interface RootLayoutProps {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        {children}
        <GlobalSpotlight />
      </body>
    </html>
  );
}
