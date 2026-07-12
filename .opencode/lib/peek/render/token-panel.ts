import { existsSync, readFileSync } from "node:fs";
import { escapeHtml, renderMarkdown } from "./markdown.js";
import { sessionInspectArtifactPaths } from "../../session-inspect/paths.js";
import type { SessionTokenAnalysis } from "../../session-inspect/token-report.js";

type PeekTokenUsage = {
  analysis?: SessionTokenAnalysis
  markdown: string
  jsonPath: string
  markdownPath: string
};

type TokenToolUsage = {
  tool?: string
  tokens?: number
  calls?: number
}

export function loadTokenUsage(workspaceRoot: string, sessionID: string): PeekTokenUsage {
  const paths = sessionInspectArtifactPaths(workspaceRoot, sessionID);
  const jsonPath = paths.analysisPath;
  const markdownPath = paths.reportPath;
  const analysis = existsSync(jsonPath) ? readJson(jsonPath) : undefined;
  const markdown = existsSync(markdownPath) ? readFileSync(markdownPath, "utf8") : "";
  return { analysis, markdown, jsonPath, markdownPath };
}

export function renderTokenPanel(tokenUsage: PeekTokenUsage): string {
  const analysis = tokenUsage.analysis;
  if (!analysis) {
    return `<aside class="token-panel token-panel-empty" aria-label="Token usage">
      <div class="panel-title">Token Usage</div>
      <p>No token report yet.</p>
    </aside>`;
  }

  const mostRecent = analysis.mostRecent || {};
  const contextEstimate = numberValue(mostRecent.inputTokens) + numberValue(mostRecent.cacheReadTokens);
  const outputTotal = numberValue(analysis.outputTokens) + numberValue(analysis.reasoningTokens);
  const cost = numberValue(analysis.cost) > 0 ? formatNumber(analysis.cost) : "n/a";
  const tools: TokenToolUsage[] = Array.isArray(analysis.tools) ? analysis.tools.slice(0, 5) : [];
  const generatedAt = formatShanghaiTime(analysis.generatedAt);

  return `<aside class="token-panel" aria-label="Token usage">
    <button class="panel-title panel-title-button" type="button" aria-haspopup="dialog" onclick="document.getElementById('token-report-dialog')?.showModal()">
      <span class="panel-title-text">Token Usage</span>${generatedAt ? `<span class="panel-title-time">${escapeHtml(generatedAt)}</span>` : ""}
    </button>
    <div class="token-hero">
      <span>Context</span>
      <strong>${formatNumber(contextEstimate)} <em>tokens</em></strong>
    </div>
    <div class="token-metrics">
      ${metric("API calls", analysis.apiCalls)}
      ${metric("Fresh", mostRecent.inputTokens)}
      ${metric("Cache", mostRecent.cacheReadTokens)}
      ${metric("Output", outputTotal)}
      ${metric("Session", analysis.sessionTotalTokens)}
      ${metric("Cost", cost || "n/a")}
    </div>
    ${tools.length ? `<div class="token-tools">
      <h2>Top tools</h2>
      ${tools.map((tool, index) => renderTool(tool, index)).join("")}
    </div>` : ""}
    ${renderTokenReportDialog(tokenUsage)}
  </aside>`;
}

function renderTokenReportDialog(tokenUsage: PeekTokenUsage): string {
  if (!tokenUsage.markdown) return "";

  return `<dialog class="token-report-dialog" id="token-report-dialog" aria-label="Token Usage 会话报告">
    <div class="token-report-dialog-head">
      <h2>Token Usage 会话报告</h2>
      <div class="dialog-actions">
        <button class="dialog-copy" type="button" aria-label="Copy token usage report" onclick="copyTokenReportMarkdown(this)">Copy</button>
        <form method="dialog">
          <button class="dialog-close" type="submit" aria-label="Close token usage report">Close</button>
        </form>
      </div>
    </div>
    <div class="token-report-dialog-body">
      ${renderMarkdown(tokenUsage.markdown)}
    </div>
    <textarea class="token-report-copy-source" id="token-report-copy-source" readonly>${escapeHtml(tokenUsage.markdown)}</textarea>
    <script>
      async function copyTokenReportMarkdown(button) {
        const source = document.getElementById("token-report-copy-source");
        if (!source) return;
        const text = source.value;
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            source.hidden = false;
            source.select();
            document.execCommand("copy");
            source.hidden = true;
          }
          const previous = button.textContent;
          button.classList.add("is-copied");
          button.textContent = "Copied";
          window.setTimeout(() => { button.classList.remove("is-copied"); button.textContent = previous || "Copy"; }, 1200);
        } catch {
          button.textContent = "Failed";
          window.setTimeout(() => { button.textContent = "Copy"; }, 1200);
        }
      }
    </script>
  </dialog>`;
}

function readJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: unknown): string | number {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US") : escapeHtml(value);
}

function metric(label: string, value: unknown): string {
  const className = label === "Cost" ? "token-metric token-metric-cost" : "token-metric";
  return `<div class="${className}">
    <span>${escapeHtml(label)}</span>
    <strong>${formatNumber(value)}</strong>
  </div>`;
}

function renderTool(tool: TokenToolUsage, index: number): string {
  const rank = index + 1;
  const podium = podiumForRank(rank);
  return `<div class="token-tool ${podium ? `token-tool-podium rank-${rank}` : ""}">
    <span class="tool-rank" aria-label="Rank ${rank}">${podium || rank}</span>
    <span class="tool-name">${escapeHtml(tool.tool || "tool")}</span>
    <strong>${formatNumber(tool.tokens)} tokens</strong>
    <em>${formatNumber(tool.calls)} calls</em>
  </div>`;
}

function podiumForRank(rank: number): string {
  if (rank === 1) return "🏆";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function formatShanghaiTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}:${pick("second")}`;
}
