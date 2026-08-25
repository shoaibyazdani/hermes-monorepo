import type { Metadata } from "next";
import { Rajdhani, JetBrains_Mono } from "next/font/google";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { ScanLine } from "@/components/hud/ScanLine";
import "./globals.css";

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hud",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JARVIS — Phase 2A on Next.js",
  description: "Hermes UI rebuild on Next.js 14 + Tailwind + shadcn",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${jetbrains.variable}`}>
      <body>
        <ScanLine />
        <VoiceProvider>{children}</VoiceProvider>
      </body>
    </html>
  );
}
