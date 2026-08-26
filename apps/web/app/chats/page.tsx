import type { Metadata } from "next";
import ChatsClient from "./ChatsClient";

export const metadata: Metadata = {
  title: "Chats",
  description: "Hermes agent conversations — one channel per agent.",
};

export default function ChatsPage() {
  return <ChatsClient />;
}
