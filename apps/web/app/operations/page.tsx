import type { Metadata } from "next";
import OperationsClient from "./OperationsClient";

export const metadata: Metadata = {
  title: "Operations",
  description:
    "Hermes live operations — active missions, agent collaboration and the event stream.",
};

export default function OperationsPage() {
  return <OperationsClient />;
}
