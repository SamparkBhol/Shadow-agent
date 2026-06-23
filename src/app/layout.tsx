import type { Metadata, Viewport } from "next";
import { display, mono, sans } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shadow Agent",
  description:
    "A terminal that learns how you work and predicts your next command — entirely on your device. Nothing leaves your machine.",
  applicationName: "Shadow Agent",
  openGraph: {
    title: "Shadow Agent",
    description: "It learns your hands. Nothing leaves your machine.",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0A0B0D",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${sans.variable}`}>
      <body className="min-h-dvh bg-void font-sans text-bone antialiased">{children}</body>
    </html>
  );
}
