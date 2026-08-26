import type { Metadata, Viewport } from "next";
import { Rajdhani, JetBrains_Mono } from "next/font/google";
import { VoiceProvider } from "@/components/voice/VoiceProvider";
import { ConversationProvider } from "@/components/chat/ConversationProvider";
import { OperationsProvider } from "@/components/operations/OperationsProvider";
import { AppShell } from "@/components/shell/AppShell";
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
  title: {
    default: "HERMES · Command Network",
    template: "%s · HERMES",
  },
  description: "Hermes — AI agent command center.",
};

export const viewport: Viewport = {
  themeColor: "#050810",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${rajdhani.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* VoiceProvider wraps the shell so the persistent command bar and
            every route share one voice channel and one agent roster.
            ConversationProvider sits inside it so every route — Command
            Center, agent workspaces, Chats — reads one conversation store,
            and OperationsProvider likewise owns missions, tasks, events and
            attention for every operational screen. */}
        <VoiceProvider>
          <ConversationProvider>
            <OperationsProvider>
              <AppShell>{children}</AppShell>
            </OperationsProvider>
          </ConversationProvider>
        </VoiceProvider>
      </body>
    </html>
  );
}
