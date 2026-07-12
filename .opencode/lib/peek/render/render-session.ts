#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { colorForTool } from "../config/tool-colors.js";
import { peekSnapshotPaths } from "../../session-inspect/paths.js";
import { escapeHtml, renderMarkdown, safeUrl } from "./markdown.js";
import { loadTokenUsage, renderTokenPanel } from "./token-panel.js";
import type { PeekRenderOptions } from "../types/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const compiledStylesheetPath = resolve(scriptDir, "..", "styles", "pixel.css");
const sourceStylesheetPath = resolve(scriptDir, "..", "..", "..", "..", "lib", "peek", "styles", "pixel.css");
const stylesheetPath = existsSync(compiledStylesheetPath) ? compiledStylesheetPath : sourceStylesheetPath;

const compiledAvatarDir = resolve(scriptDir, "..", "avatar");
const sourceAvatarDir = resolve(scriptDir, "..", "..", "..", "..", "lib", "peek", "avatar");
const AVATAR_DIR = existsSync(compiledAvatarDir) ? compiledAvatarDir : sourceAvatarDir;

const MODEL_PREFIXES: [string, string][] = [
  ["anthropic", "claude"],
  ["deepseek", "deepseek"],
  ["claude", "claude"],
  ["openai", "chatgpt"],
  ["gpt", "chatgpt"],
  ["o1", "chatgpt"],
  ["o3", "chatgpt"],
  ["gemini", "gemini"],
  ["grok", "grok"],
  ["moonshot", "kimi"],
  ["qwen", "qwen"],
  ["alibaba", "qwen"],
  ["doubao", "doubao"],
  ["kimi", "kimi"],
  ["minimax", "minimax"],
  ["zhipu", "zhipu"],
  ["glm", "zhipu"],
  ["longcat", "longcat"],
  ["mimo", "mimo"],
];

const AVATAR_KEYS = new Set(MODEL_PREFIXES.map(([, key]) => key));

function modelIdentity(model: unknown): string {
  if (typeof model === "string") return model.toLowerCase().trim();
  if (!isObject(model)) return "";
  const provider = typeof model.providerID === "string" ? model.providerID : typeof model.provider === "string" ? model.provider : "";
  const modelID = typeof model.modelID === "string" ? model.modelID : typeof model.id === "string" ? model.id : "";
  return `${provider}/${modelID}`.toLowerCase().trim();
}

function modelToAvatarKey(model: unknown): string | undefined {
  const normalized = modelIdentity(model);
  if (!normalized) return undefined;
  for (const [prefix, avatarKey] of MODEL_PREFIXES) {
    if (normalized.startsWith(prefix)) return avatarKey;
  }
  for (const [key, avatarKey] of MODEL_PREFIXES) {
    if (normalized.includes(key)) return avatarKey;
  }
  return undefined;
}

function loadAvatarSvgs(): Record<string, string> {
  const map: Record<string, string> = {};
  try {
    for (const key of AVATAR_KEYS) {
      const file = `${key}.svg`;
      const svg = readFileSync(resolve(AVATAR_DIR, file), "utf8");
      if (/<svg\b/i.test(svg)) map[key] = svg;
    }
  } catch {
    // Avatar directory not available
  }
  return map;
}

type RenderContext = {
  snapshotPath: string;
  workspaceRoot: string;
  options: PeekRenderOptions;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function jsonBlock(value: unknown): string {
  return `<pre class="json-block"><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></pre>`;
}

function jsonDetails(summary: string, value: unknown, className = ""): string {
  const classes = ["json-shell", className].filter(Boolean).join(" ");
  return `<div class="${escapeHtml(classes)}"><details class="json-details"><summary>${escapeHtml(summary)}</summary>${jsonBlock(value)}</details><button class="json-copy" type="button">Copy JSON</button></div>`;
}

function faviconDataUri(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="48" text-anchor="middle" font-size="46" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">🍟</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function detectWorkspaceRoot(snapshot: unknown, inputPath: string): string {
  const value = isObject(snapshot) ? snapshot.directory : undefined;
  return typeof value === "string" && value.trim() ? resolve(value) : resolve(dirname(inputPath), "..", "..", "..");
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.replace(/\u001b\[[0-9;]*m/g, "").trim();
  if (!/^[{[]/.test(text)) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function unwrapEnvelope(value: unknown): { skill: string; data: unknown } {
  if (isObject(value) && value.ok === true && isObject(value.data)) {
    return { skill: typeof value.skill === "string" ? value.skill : "", data: value.data };
  }
  return { skill: "", data: value };
}

function roleOf(message: unknown): string {
  const info = isObject(message) && isObject(message.info) ? message.info : {};
  return typeof info.role === "string" && info.role ? info.role : "unknown";
}

function messageIdOf(message: unknown): string {
  const info = isObject(message) && isObject(message.info) ? message.info : {};
  return typeof info.id === "string" ? info.id : "";
}

function formatTime(value: unknown): string {
  const raw = isObject(value) ? value.created ?? value.start ?? value.end : value;
  if (!raw) return "";
  const date = typeof raw === "number" || /^\d+$/.test(String(raw)) ? new Date(Number(raw)) : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return String(raw);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function timeOf(message: unknown): string {
  const info = isObject(message) && isObject(message.info) ? message.info : {};
  return formatTime(info.time);
}

function turnId(message: unknown, index: number): string {
  const id = messageIdOf(message);
  return id ? `turn-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}` : `turn-${index + 1}`;
}

function selectMessages(snapshot: unknown, options: PeekRenderOptions): unknown[] {
  const messages = isObject(snapshot) && Array.isArray(snapshot.messages) ? snapshot.messages : [];
  const selection = options.messageSelection;
  const turnCount = selection?.turnCount;
  if (selection?.mode !== "first-n-turns" || !Number.isInteger(turnCount) || !turnCount || turnCount <= 0) {
    return messages;
  }

  const firstUserIndex = messages.findIndex((message) => roleOf(message) === "user");
  if (firstUserIndex < 0) return messages;
  let turns = 0;
  const selected: unknown[] = [];
  for (let index = firstUserIndex; index < messages.length; index += 1) {
    const message = messages[index];
    if (roleOf(message) === "user") {
      if (turns >= turnCount) break;
      turns += 1;
    }
    selected.push(message);
  }
  return selected;
}

function renderToolOutput(output: unknown, preferredFormat: unknown): string {
  if (typeof output === "string" && preferredFormat === "markdown") return renderMarkdown(output);
  if (typeof output === "string") return `<pre class="plain-tool-output"><code>${escapeHtml(output)}</code></pre>`;
  return jsonBlock(output ?? null);
}

function renderToolPart(part: Record<string, unknown>): string {
  const toolName = typeof part.tool === "string" && part.tool.trim() ? part.tool.trim() : "tool";
  const state = isObject(part.state) ? part.state : {};
  const output = parseJsonMaybe(state.output);
  const normalized = unwrapEnvelope(output);
  const outputType = isObject(normalized.data) && typeof normalized.data.type === "string" ? normalized.data.type : "";
  const color = colorForTool(toolName);
  const input = isObject(state.input) ? state.input : {};
  const skillName = toolName === "skill" && typeof input.name === "string" ? input.name.trim() : "";
  return `<details class="part tool-part ${color.className}">
    <summary><span class="tool-title"><span>${escapeHtml(toolName)}</span>${skillName ? `<span class="tool-skill-name">(${escapeHtml(skillName)})</span>` : ""}${outputType ? `<span class="tool-type">${escapeHtml(outputType)}</span>` : ""}</span>${typeof state.status === "string" ? `<span class="badge">${escapeHtml(state.status)}</span>` : ""}</summary>
    <div class="tool-body"><div class="tool-caption">${escapeHtml(normalized.skill || toolName)} output</div>${renderToolOutput(output, input.format)}</div>
  </details>`;
}

function mimeOfFilePart(part: Record<string, unknown>): string {
  return typeof part.mime === "string" ? part.mime : typeof part.mediaType === "string" ? part.mediaType : "";
}

function renderFilePart(part: Record<string, unknown>): string {
  const mime = mimeOfFilePart(part);
  const filename = typeof part.filename === "string" && part.filename.trim() ? part.filename.trim() : "File attachment";
  const url = typeof part.url === "string" ? part.url : "";
  const imageUrl = /^image\//.test(mime) && (/^data:image\//.test(url) || /^blob:/.test(url) || Boolean(safeUrl(url))) ? url : "";
  const openUrl = safeUrl(url);
  return `<div class="part file-part"><div class="file-card">
    ${imageUrl ? `<button class="file-preview-trigger" type="button" data-preview-src="${escapeHtml(imageUrl)}" data-preview-alt="${escapeHtml(filename)}"><img class="file-preview-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(filename)}" loading="lazy"></button>` : ""}
    <div class="file-meta"><strong>${escapeHtml(filename)}</strong>${mime ? `<span>${escapeHtml(mime)}</span>` : ""}${openUrl ? `<a href="${escapeHtml(openUrl)}" target="_blank" rel="noreferrer">Open file</a>` : ""}</div>
  </div>${jsonDetails("File JSON", part)}</div>`;
}

function renderPart(rawPart: unknown): string {
  const part = isObject(rawPart) ? rawPart : {};
  const type = typeof part.type === "string" ? part.type : "unknown";
  if (type === "text") return `<div class="text-part">${renderMarkdown(part.text)}</div>`;
  if (type === "tool") return renderToolPart(part);
  if (type === "file") return renderFilePart(part);
  if (type === "reasoning") return `<details class="part reasoning-part"><summary>reasoning</summary><div class="reasoning-body">${renderMarkdown(part.text)}</div></details>`;
  return `<details class="part step-part"><summary>${escapeHtml(type)}</summary>${jsonBlock(part)}</details>`;
}

function renderAvatar(role: string, model: unknown, avatarSvgMap?: Record<string, string>): string {
  if (role === "assistant" && avatarSvgMap) {
    const avatarKey = modelToAvatarKey(model);
    const svg = avatarKey ? avatarSvgMap[avatarKey] : undefined;
    if (svg) {
      return `<div class="avatar avatar-image-shell" aria-hidden="true">${svg}</div>`;
    }
  }
  const initials = role === "user" ? "U" : role === "assistant" ? "A" : "?";
  return `<div class="avatar" aria-hidden="true">${initials}</div>`;
}

function renderMessage(message: unknown, index: number, _modelIgnored?: unknown, avatarSvgMap?: Record<string, string>): string {
  const role = roleOf(message);
  const parts = isObject(message) && Array.isArray(message.parts) ? message.parts : [];
  const info = isObject(message) && isObject(message.info) ? message.info : {};
  const msgModel = info.model ?? (info as Record<string, unknown>).modelID ?? _modelIgnored;
  return `<article class="turn ${escapeHtml(role)}" id="${escapeHtml(turnId(message, index))}">${renderAvatar(role, msgModel, avatarSvgMap)}<div class="bubble">
    <header class="bubble-head"><div><span class="role">${escapeHtml(role)}</span><span class="index">#${index + 1}</span></div><div class="message-meta">${messageIdOf(message) ? `<span>${escapeHtml(messageIdOf(message))}</span>` : ""}${timeOf(message) ? `<span>${escapeHtml(timeOf(message))}</span>` : ""}</div></header>
    <div class="parts">${parts.map(renderPart).join("") || `<p class="muted">No parts.</p>`}</div>
  </div></article>`;
}

function renderSystemPrompt(snapshot: unknown): string {
  const prompts = isObject(snapshot) && Array.isArray(snapshot.systemPrompt) ? snapshot.systemPrompt.filter((item) => typeof item === "string" && item.trim()) : [];
  if (!prompts.length) return "";
  return `<section class="system-prompt-panel"><details><summary>System Prompt <span>${prompts.length} parts</span></summary><div class="system-prompt-body">${prompts.map((item) => `<pre><code>${escapeHtml(item)}</code></pre>`).join("")}</div></details></section>`;
}

function capturedAt(snapshot: unknown, inputPath: string): string {
  if (isObject(snapshot) && snapshot.capturedAt) return formatTime(snapshot.capturedAt);
  try { return formatTime(statSync(inputPath).mtime); } catch { return ""; }
}

function renderTurnMinimap(messages: unknown[]): string {
  const markers = messages.map((message, index) => ({ message, index })).filter(({ message }) => roleOf(message) === "user").map(({ message, index }) => ({ id: turnId(message, index), label: summarizeMessage(message) }));
  if (!markers.length) return "";
  return `<nav class="turn-minimap" aria-label="User message markers"><div class="turn-bars">${markers.map((marker) => `<button class="turn-marker" type="button" data-target="${escapeHtml(marker.id)}" aria-label="${escapeHtml(marker.label)}"></button>`).join("")}</div><div class="turn-toc-panel">${markers.map((marker) => `<button class="turn-toc-item" type="button" data-target="${escapeHtml(marker.id)}">${escapeHtml(marker.label)}</button>`).join("")}</div></nav>`;
}

function summarizeMessage(message: unknown): string {
  const parts = isObject(message) && Array.isArray(message.parts) ? message.parts : [];
  const text = parts.filter(isObject).filter((part) => part.type === "text" && typeof part.text === "string").map((part) => String(part.text))
    .join(" ").replace(/<skill>[\s\S]*?<\/skill>/gi, " ").replace(/```[\s\S]*?```/g, " ").replace(/[#*_>~\[\]()]/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "User message";
  return text.length > 30 ? `${text.slice(0, 30)}...` : text;
}

function renderDocument(snapshot: unknown, context: RenderContext, avatarSvgMap?: Record<string, string>): string {
  const messages = selectMessages(snapshot, context.options);
  const model = isObject(snapshot) ? snapshot.model : undefined;
  const sessionId = isObject(snapshot) && typeof snapshot.sessionID === "string" ? snapshot.sessionID : "OpenCode session";
  const tokenUsage = loadTokenUsage(context.workspaceRoot, sessionId);
  const totalParts = messages.reduce<number>((total, message) => total + (isObject(message) && Array.isArray(message.parts) ? message.parts.length : 0), 0);
  const css = readFileSync(stylesheetPath, "utf8");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="${faviconDataUri()}"><title>peek · ${escapeHtml(sessionId)}</title><style>${css}</style></head><body>
    <main class="shell"><div class="transcript-layout"><div class="token-sidebar"><header class="masthead"><div><p class="eyebrow">peek transcript</p><h1>${escapeHtml(sessionId)}</h1></div><dl class="meta"><div><dt>Messages</dt><dd>${messages.length}</dd></div><div><dt>Parts</dt><dd>${totalParts}</dd></div><div class="meta-captured"><dt>Captured</dt><dd>${escapeHtml(capturedAt(snapshot, context.snapshotPath))}</dd></div></dl></header>${renderTokenPanel(tokenUsage)}</div>
    <div class="transcript-main"><section class="conversation" aria-label="Conversation transcript">${renderSystemPrompt(snapshot)}${messages.map((message, index) => renderMessage(message, index, model, avatarSvgMap)).join("") || `<p class="empty">No messages captured.</p>`}${jsonDetails("Snapshot JSON", snapshot, "raw-shell")}</section>${renderTurnMinimap(messages)}</div></div></main>
    <dialog class="image-lightbox"><button class="image-lightbox-close" type="button">Close</button><img class="image-lightbox-image" alt=""></dialog><script>${clientScript()}</script></body></html>`;
}

function clientScript(): string {
  return `(() => { const copy = async text => { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text); const area = document.createElement('textarea'); area.value = text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }; document.querySelectorAll('.json-copy').forEach(button => button.addEventListener('click', async () => { const text = button.parentElement?.querySelector('code')?.textContent || ''; if (!text) return; await copy(text); button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy JSON'; }, 1200); })); document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))); const dialog = document.querySelector('.image-lightbox'); const image = document.querySelector('.image-lightbox-image'); document.querySelectorAll('.file-preview-trigger').forEach(button => button.addEventListener('click', () => { image.src = button.dataset.previewSrc; image.alt = button.dataset.previewAlt || ''; dialog.showModal(); })); document.querySelector('.image-lightbox-close')?.addEventListener('click', () => dialog.close()); })();`;
}

export async function runRenderSession(nextSnapshotPath: string, outputPathArg?: string, options: PeekRenderOptions = {}): Promise<string> {
  const snapshotPath = resolve(nextSnapshotPath);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const workspaceRoot = detectWorkspaceRoot(snapshot, snapshotPath);
  const sessionID = isObject(snapshot) && typeof snapshot.sessionID === "string" ? snapshot.sessionID : undefined;
  const messageID = isObject(snapshot) && typeof snapshot.messageID === "string" ? snapshot.messageID : undefined;
  const cachePaths = peekSnapshotPaths(workspaceRoot, sessionID, messageID);
  const outputPath = resolve(outputPathArg || cachePaths.outputPath);
  const latestOutputPath = cachePaths.latestHtmlPath;
  const avatarSvgMap = loadAvatarSvgs();
  const html = renderDocument(snapshot, { snapshotPath, workspaceRoot, options }, avatarSvgMap);
  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(latestOutputPath), { recursive: true });
  writeFileSync(outputPath, html, "utf8");
  writeFileSync(latestOutputPath, html, "utf8");
  return outputPath;
}

export const __peekTestRenderSession = runRenderSession;

function parseCliArguments(argv: string[]): { inputPath: string; outputPath?: string; options: PeekRenderOptions } {
  const positionals: string[] = [];
  let turnCount: number | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--first-n-turns") {
      const parsed = Number(argv[index + 1]);
      if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--first-n-turns requires a positive integer");
      turnCount = parsed;
      index += 1;
      continue;
    }
    if (value.startsWith("--")) throw new Error(`Unknown option: ${value}`);
    positionals.push(value);
  }
  if (!positionals[0]) throw new Error("A snapshot JSON path is required");
  return {
    inputPath: positionals[0],
    outputPath: positionals[1],
    options: turnCount ? { messageSelection: { mode: "first-n-turns", turnCount } } : {},
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let parsed: ReturnType<typeof parseCliArguments>;
  try {
    parsed = parseCliArguments(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Usage: node .opencode/lib/peek/render-session.js <snapshot-json> [output-html] [--first-n-turns N]");
    process.exit(2);
  }
  console.log(await runRenderSession(parsed.inputPath, parsed.outputPath, parsed.options));
}
