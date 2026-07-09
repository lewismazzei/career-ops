import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scythe",
  description: "Private remote paid-work acquisition dashboard.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0f1412",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistMono.variable}>
      <body>{children}</body>
    </html>
  );
}
