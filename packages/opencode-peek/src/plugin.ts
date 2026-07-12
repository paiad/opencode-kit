import type { Plugin } from "@opencode-ai/plugin";
import { sessionInspectTool, peekTool } from "./lib/plugin-tools.js";
import { writeCapturedSystemPrompt } from "./lib/session-inspect/system-prompt-store.js";

/**
 * npm entry point for OpenCode. It owns the two custom tools and captures
 * system prompt/model data that OpenCode does not expose in tool context.
 */
export const OpenCodePeekPlugin: Plugin = async ({ directory }) => ({
  tool: {
    session_inspect: sessionInspectTool,
    peek: peekTool,
  },
  "experimental.chat.system.transform": async (input, output) => {
    const sessionID = input.sessionID?.trim();
    if (!sessionID) return;
    await writeCapturedSystemPrompt({
      workspaceRoot: directory,
      sessionID,
      model: input.model,
      systemPrompt: output.system,
    });
  },
});

export default OpenCodePeekPlugin;
