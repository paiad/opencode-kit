import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { peekSnapshotPaths } from "./paths.js";
import { readCapturedSystemPrompt } from "./system-prompt-store.js";

export type PeekSnapshot = {
  capturedAt: string;
  sessionID: string;
  messageID?: string;
  directory: string;
  messages: unknown[];
  systemPrompt: string[];
  warnings?: string[];
};

function latestMessageID(messages: unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || typeof message !== "object") continue;
    const info = (message as { info?: unknown }).info;
    if (!info || typeof info !== "object") continue;
    const id = (info as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return undefined;
}

export async function preparePeekSnapshot(input: {
  workspaceRoot: string;
  sessionID: string;
  messages: unknown[];
  messageID?: string;
  now?: Date;
}): Promise<{ snapshot: PeekSnapshot; snapshotPath: string; latestSnapshotPath: string }> {
  const captured = await readCapturedSystemPrompt({
    workspaceRoot: input.workspaceRoot,
    sessionID: input.sessionID,
  });
  const messageID = input.messageID?.trim() || latestMessageID(input.messages);
  const warnings = captured?.systemPrompt.length ? [] : ["system-prompt-missing"];
  const snapshot: PeekSnapshot = {
    capturedAt: (input.now ?? new Date()).toISOString(),
    sessionID: input.sessionID,
    ...(messageID ? { messageID } : {}),
    ...(captured?.model !== undefined ? { model: captured.model } : {}),
    directory: input.workspaceRoot,
    messages: input.messages,
    systemPrompt: captured?.systemPrompt ?? [],
    ...(warnings.length ? { warnings } : {}),
  };
  const paths = peekSnapshotPaths(input.workspaceRoot, input.sessionID, messageID);
  const text = `${JSON.stringify(snapshot, null, 2)}\n`;

  await mkdir(dirname(paths.snapshotPath), { recursive: true });
  await writeFile(paths.snapshotPath, text, "utf8");
  await writeFile(paths.latestSnapshotPath, text, "utf8");

  return { snapshot, snapshotPath: paths.snapshotPath, latestSnapshotPath: paths.latestSnapshotPath };
}
