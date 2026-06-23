import { Space_Grotesk, JetBrains_Mono, Inter } from "next/font/google";

// Self-hosted at build time by next/font — no runtime request to Google,
// which keeps the app self-contained and avoids cross-origin font fetches.
export const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
