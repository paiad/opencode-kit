export const BUILTIN_TOOL_NAMES = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "applypatch",
  "grep",
  "glob",
  "lsp",
  "skill",
  "todowrite",
  "webfetch",
  "websearch",
  "question",
]);

export const DOPAMINE_COLOR_COUNT = 8;

export type ToolColor = {
  className: string;
  isBuiltin: boolean;
};

const BUILTIN_TOOL_COLOR: ToolColor = {
  className: "tool-color-neutral",
  isBuiltin: true,
};

/**
 * Produces one stable identifier for equivalent OpenCode tool-name spellings.
 */
export function canonicalToolName(toolName: unknown): string {
  return String(toolName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * FNV-1a is deliberately small, deterministic, and runtime-independent.
 */
export function toolNameHash(toolName: unknown): number {
  let hash = 0x811c9dc5;
  for (const character of canonicalToolName(toolName)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function colorForTool(toolName: unknown): ToolColor {
  const canonicalName = canonicalToolName(toolName);
  if (!canonicalName || BUILTIN_TOOL_NAMES.has(canonicalName)) {
    return BUILTIN_TOOL_COLOR;
  }

  return {
    className: `tool-color-${toolNameHash(canonicalName) % DOPAMINE_COLOR_COUNT}`,
    isBuiltin: false,
  };
}
