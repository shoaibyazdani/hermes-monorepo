/**
 * Command parsing: turn a raw command string into a target and a message.
 *
 * Deliberately pure and input-agnostic. It receives a string and the agent
 * roster; it knows nothing about microphones, SpeechRecognition, React or the
 * conversation store. Typed input and (later) a voice transcript go through
 * exactly the same function, so routing behaviour cannot drift between them.
 *
 * Agent names come from the roster passed in — never hardcoded here — so
 * registering an agent is enough to make it addressable.
 */

export interface ParsableAgent {
  id: string;
  name: string;
}

export interface ParsedCommand {
  /** Resolved agent id, or null when no agent was named. */
  targetAgentId: string | null;
  /** The command with any address prefix removed. */
  message: string;
  /** True when the input named an agent (whether or not it resolved). */
  hadExplicitTarget: boolean;
  /** True when an address was attempted but matched no agent. */
  unresolvedMention: string | null;
}

/** Strip punctuation and case so "Apex," "@apex" and "APEX" all compare equal. */
function normalize(token: string): string {
  return token.replace(/^@+/, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

/**
 * Find the agent addressed at the start of a command.
 *
 * Only the leading token is considered an address. This matters: "check what
 * apex is doing" is a question *about* Apex sent to the current target, not a
 * command *to* Apex. Requiring the address up front keeps that distinction,
 * and matches how people actually speak ("Apex, do X").
 *
 * A bare `@mention` is honoured anywhere in the string, since the `@` is an
 * unambiguous addressing marker rather than a natural-language accident.
 */
export function parseCommand(
  input: string,
  agents: ParsableAgent[],
): ParsedCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      targetAgentId: null,
      message: "",
      hadExplicitTarget: false,
      unresolvedMention: null,
    };
  }

  const resolve = (token: string) => {
    const needle = normalize(token);
    if (!needle) return undefined;
    return (
      agents.find((a) => normalize(a.name) === needle || a.id.toLowerCase() === needle) ??
      // Prefix match so "@ap" still reaches APEX, matching the existing
      // mention-autocomplete behaviour operators are used to.
      agents.find(
        (a) =>
          normalize(a.name).startsWith(needle) ||
          a.id.toLowerCase().startsWith(needle),
      )
    );
  };

  /* 1. Explicit @mention anywhere in the input. */
  const at = trimmed.match(/@([\p{L}\p{N}_-]+)/u);
  if (at) {
    const found = resolve(at[1]);
    const message = trimmed.replace(at[0], "").replace(/\s+/g, " ").trim();
    return {
      targetAgentId: found?.id ?? null,
      message: stripLeadingPunctuation(message),
      hadExplicitTarget: true,
      unresolvedMention: found ? null : at[1],
    };
  }

  /* 2. Leading name address: "Apex, check the tests" / "Apex check the tests". */
  const lead = trimmed.match(/^([\p{L}\p{N}_-]+)\s*[,:—-]?\s+([\s\S]+)$/u);
  if (lead) {
    const found = resolve(lead[1]);
    if (found) {
      return {
        targetAgentId: found.id,
        message: stripLeadingPunctuation(lead[2]),
        hadExplicitTarget: true,
        unresolvedMention: null,
      };
    }
  }

  /* 3. The whole input is just an agent name — address it with no message. */
  const whole = resolve(trimmed);
  if (whole && normalize(trimmed) === normalize(whole.name)) {
    return {
      targetAgentId: whole.id,
      message: "",
      hadExplicitTarget: true,
      unresolvedMention: null,
    };
  }

  /* 4. No address: the caller decides where this goes. */
  return {
    targetAgentId: null,
    message: trimmed,
    hadExplicitTarget: false,
    unresolvedMention: null,
  };
}

function stripLeadingPunctuation(text: string): string {
  return text.replace(/^[\s,:;—-]+/, "").trim();
}
