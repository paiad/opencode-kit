import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sessionInspectArtifactPaths } from "./paths.js";

type RecordValue = Record<string, unknown>;

export type SessionTokenCall = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cost?: number;
};

export type SessionTokenAnalysis = {
  sessionID: string;
  generatedAt: string;
  apiCalls: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  sessionTotalTokens: number;
  mostRecent: SessionTokenCall;
  cost?: number;
  tools: { tool: string; calls: number; tokens: number }[];
};

function objectOf(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function tokensFrom(value: unknown): SessionTokenCall {
  const tokens = objectOf(value);
  const cache = objectOf(tokens.cache);
  return {
    inputTokens: numberOf(tokens.input),
    outputTokens: numberOf(tokens.output),
    reasoningTokens: numberOf(tokens.reasoning),
    cacheReadTokens: numberOf(cache.read),
  };
}

function hasUsage(call: SessionTokenCall): boolean {
  return call.inputTokens + call.outputTokens + call.reasoningTokens + call.cacheReadTokens > 0;
}

function textEstimate(value: unknown): number {
  return value == null ? 0 : Math.max(0, Math.ceil(String(value).trim().length / 4));
}

function collectCalls(messages: unknown[]): SessionTokenCall[] {
  const calls: SessionTokenCall[] = [];
  for (const message of messages) {
    const record = objectOf(message);
    const info = objectOf(record.info);
    if (String(info.role ?? record.role ?? "") !== "assistant") continue;
    const parts = Array.isArray(record.parts) ? record.parts.map(objectOf) : [];
    const stepCalls = parts.filter((part) => part.type === "step-finish");
    if (stepCalls.length) {
      for (const step of stepCalls) {
        const call = tokensFrom(step.tokens);
        const cost = numberOf(step.cost);
        if (hasUsage(call) || cost > 0) calls.push({ ...call, ...(cost > 0 ? { cost } : {}) });
      }
      continue;
    }
    const call = tokensFrom(info.tokens ?? record.tokens);
    const cost = numberOf(info.cost ?? record.cost);
    if (hasUsage(call) || cost > 0) calls.push({ ...call, ...(cost > 0 ? { cost } : {}) });
  }
  return calls;
}

export async function writeTokenUsageArtifacts(input: {
  workspaceRoot: string;
  sessionID: string;
  messages: unknown[];
  generatedAt?: string;
}): Promise<{ analysis: SessionTokenAnalysis; jsonPath: string; markdownPath: string; latestJsonPath: string; latestMarkdownPath: string }> {
  const calls = collectCalls(input.messages);
  const tools = new Map<string, { tool: string; calls: number; tokens: number }>();
  for (const message of input.messages) {
    const parts = Array.isArray(objectOf(message).parts) ? objectOf(message).parts as unknown[] : [];
    for (const rawPart of parts) {
      const part = objectOf(rawPart);
      if (part.type !== "tool") continue;
      const tool = typeof part.tool === "string" && part.tool.trim() ? part.tool.trim() : "tool";
      const item = tools.get(tool) ?? { tool, calls: 0, tokens: 0 };
      item.calls += 1;
      item.tokens += textEstimate(objectOf(part.state).output);
      tools.set(tool, item);
    }
  }

  const total = (key: keyof SessionTokenCall) => calls.reduce((sum, call) => sum + numberOf(call[key]), 0);
  const totalCost = Number(calls.reduce((sum, call) => sum + numberOf(call.cost), 0).toFixed(6));
  const mostRecent = calls.at(-1) ?? { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0 };
  const analysis: SessionTokenAnalysis = {
    sessionID: input.sessionID,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    apiCalls: calls.length,
    inputTokens: total("inputTokens"),
    outputTokens: total("outputTokens"),
    reasoningTokens: total("reasoningTokens"),
    cacheReadTokens: total("cacheReadTokens"),
    sessionTotalTokens: total("inputTokens") + total("outputTokens") + total("reasoningTokens") + total("cacheReadTokens"),
    mostRecent,
    ...(totalCost > 0 ? { cost: totalCost } : {}),
    tools: [...tools.values()].sort((a, b) => b.tokens - a.tokens || b.calls - a.calls || a.tool.localeCompare(b.tool)),
  };
  const rows = analysis.tools.length
    ? analysis.tools.map((tool) => `| ${tool.tool.replace(/\|/g, "\\|")} | ${tool.tokens.toLocaleString("en-US")} | ${tool.calls} |`).join("\n")
    : "| (none) | 0 | 0 |";
  const markdown = `# Token Usage 会话报告\n\n| 指标 | 数值 |\n| --- | ---: |\n| API calls | ${analysis.apiCalls} |\n| Fresh input | ${analysis.inputTokens.toLocaleString("en-US")} |\n| Cache read | ${analysis.cacheReadTokens.toLocaleString("en-US")} |\n| Output | ${analysis.outputTokens.toLocaleString("en-US")} |\n| Reasoning | ${analysis.reasoningTokens.toLocaleString("en-US")} |\n| Session total | ${analysis.sessionTotalTokens.toLocaleString("en-US")} |\n| Reported cost | ${analysis.cost?.toFixed(6) ?? "n/a"} |\n\n## Top tools\n\n| Tool | Estimated tokens | Calls |\n| --- | ---: | ---: |\n${rows}\n\n> Cost is shown only when reported by OpenCode. Pricing is not inferred.\n`;
  const paths = sessionInspectArtifactPaths(input.workspaceRoot, input.sessionID);
  const json = `${JSON.stringify(analysis, null, 2)}\n`;
  await Promise.all([mkdir(dirname(paths.analysisPath), { recursive: true }), mkdir(dirname(paths.latestAnalysisPath), { recursive: true })]);
  await writeFile(paths.analysisPath, json, "utf8");
  await writeFile(paths.reportPath, markdown, "utf8");
  await writeFile(paths.latestAnalysisPath, json, "utf8");
  await writeFile(paths.latestReportPath, markdown, "utf8");
  return { analysis, jsonPath: paths.analysisPath, markdownPath: paths.reportPath, latestJsonPath: paths.latestAnalysisPath, latestMarkdownPath: paths.latestReportPath };
}
