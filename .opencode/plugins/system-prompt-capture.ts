import type { Plugin } from "@opencode-ai/plugin";
import { writeCapturedSystemPrompt } from "../lib/session-inspect/system-prompt-store.js";

export const SystemPromptCapturePlugin: Plugin = async ({ directory }) => {
  return {
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
  };
};

export const server = SystemPromptCapturePlugin;
