import {
  Activity,
  BotMessageSquare,
  BrainCircuit,
  ClipboardCheck,
  Gauge,
  LayoutGrid,
  MessagesSquare,
  Radar,
  Target,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * Navigation architecture.
 *
 * The full destination list is declared here so later phases only have to add
 * a route — the shell, the mobile bar and the command palette all read from
 * this one array. Destinations without a page yet carry `available: false`,
 * which renders them visibly disabled rather than hiding them; the operator
 * can see what the system will grow into.
 */
export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** False for sections whose route lands in a later phase. */
  available: boolean;
  /** Short description surfaced as a tooltip / aria-description. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: "command",
    label: "Command",
    href: "/",
    icon: LayoutGrid,
    available: true,
    description: "System overview, agents, operations and health",
  },
  {
    key: "agents",
    label: "Agents",
    href: "/agents",
    icon: BotMessageSquare,
    available: true,
    description: "Agent network, roster and workspaces",
  },
  {
    key: "operations",
    label: "Operations",
    href: "/operations",
    icon: Radar,
    available: true,
    description: "Live operations, missions and agent collaboration",
  },
  {
    key: "missions",
    label: "Missions",
    href: "/missions",
    icon: Target,
    available: true,
    description: "Mission board, tasks and assignment",
  },
  {
    key: "chats",
    label: "Chats",
    href: "/chats",
    icon: MessagesSquare,
    available: true,
    description: "Agent conversations, one channel per agent",
  },
  {
    key: "memory",
    label: "Memory",
    href: "/memory",
    icon: BrainCircuit,
    available: false,
    description: "Shared and per-agent memory stores",
  },
  {
    key: "tools",
    label: "Tools",
    href: "/tools",
    icon: Wrench,
    available: false,
    description: "Registered tools and integrations",
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/approvals",
    icon: ClipboardCheck,
    available: false,
    description: "Actions awaiting operator sign-off",
  },
  {
    key: "usage",
    label: "Usage",
    href: "/usage",
    icon: Gauge,
    available: true,
    description: "Call volume, tokens and skill activity",
  },
];

/** Destinations surfaced in the mobile bottom bar (space for five). */
export const MOBILE_NAV_KEYS = ["command", "agents", "operations", "usage"];

export const ACTIVITY_ICON = Activity;

/**
 * Resolve the active nav key for a pathname.
 *
 * Longest-prefix wins so `/command-center` never matches the `/` entry.
 */
export function activeNavKey(pathname: string): string | undefined {
  // `/apex` predates `/agents/[agentId]` and is preserved as an alias for the
  // Apex workspace, so it must light up the Agents entry rather than nothing.
  if (pathname === "/apex") return "agents";
  // `/command-center` predates `/operations` and remains the radar/markets
  // view; it belongs under Operations in the navigation.
  if (pathname === "/command-center") return "operations";

  const exact = NAV_ITEMS.find((i) => i.href === pathname);
  if (exact) return exact.key;

  const prefixed = NAV_ITEMS.filter(
    (i) => i.href !== "/" && pathname.startsWith(`${i.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];

  return prefixed?.key;
}

/**
 * Canonical workspace URL for an agent.
 *
 * One helper so every entry point — command centre cards, core orbit, network
 * nodes, activity rows, roster — links the same way and a future route change
 * is a single edit.
 */
export function agentHref(agentId: string): string {
  return `/agents/${agentId}`;
}

/** Canonical detail URL for a mission. One helper, one place to change it. */
export function missionHref(missionId: string): string {
  return `/missions/${missionId}`;
}
