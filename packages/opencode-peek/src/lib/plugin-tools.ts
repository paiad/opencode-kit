import { tool } from "@opencode-ai/plugin";
import { pathToFileURL } from "node:url";
import { defaultLatestHtmlPath, defaultSnapshotPath, renderPeekHtml } from "./peek/index.js";
import { preparePeekSnapshot } from "./session-inspect/snapshot.js";
import { writeTokenUsageArtifacts } from "./session-inspect/token-report.js";

type SessionInspectContext = {
  directory: string;
  sessionID?: string;
  messageID?: string;
  messages?: unknown[];
};

export const sessionInspectTool = tool({
  description: "Generate the current session token report and peek snapshot artifacts.",
  args: {},
  async execute(_args, rawContext) {
    const context = rawContext as SessionInspectContext;
    const sessionID = context.sessionID?.trim();
    if (!sessionID) {
      return JSON.stringify({ ok: false, error: { code: "session-id-missing", message: "OpenCode session ID is required." } }, null, 2);
    }
    if (!Array.isArray(context.messages)) {
      return JSON.stringify({ ok: false, sessionID, error: { code: "session-messages-missing", message: "OpenCode did not provide session messages." } }, null, 2);
    }
    try {
      const prepared = await preparePeekSnapshot({
        workspaceRoot: context.directory,
        sessionID,
        messageID: context.messageID,
        messages: context.messages,
      });
      const artifacts = await writeTokenUsageArtifacts({
        workspaceRoot: context.directory,
        sessionID,
        messages: context.messages,
      });
      return JSON.stringify({
        ok: true,
        sessionID,
        snapshotPath: prepared.snapshotPath,
        latestSnapshotPath: prepared.latestSnapshotPath,
        jsonPath: artifacts.jsonPath,
        markdownPath: artifacts.markdownPath,
      }, null, 2);
    } catch (error) {
      return JSON.stringify({ ok: false, sessionID, error: { code: "session-inspect-failed", message: error instanceof Error ? error.message : String(error) } }, null, 2);
    }
  },
});

export const peekTool = tool({
  description: "Render the current session as an HTML transcript.",
  args: {
    firstNTurns: tool.schema.number().optional().describe("Optional number of user turns to render from the start of the session."),
  },
  async execute(args: { firstNTurns?: number }, context) {
    const workspaceRoot = context.directory;
    const snapshotPath = defaultSnapshotPath(workspaceRoot);
    try {
      const htmlPath = await renderPeekHtml({ workspaceRoot, firstNTurns: args.firstNTurns });
      const htmlUrl = pathToFileURL(htmlPath).href;
      return JSON.stringify({
        ok: true,
        snapshotPath,
        htmlPath,
        htmlUrl,
        markdownLink: `[🍟 打开 Peek 报告](${htmlUrl})`,
        latestHtmlPath: defaultLatestHtmlPath(workspaceRoot),
      }, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ ok: false, snapshotPath, error: { code: message.includes("Peek snapshot not found:") ? "snapshot-missing" : "peek-render-failed", message } }, null, 2);
    }
  },
});
