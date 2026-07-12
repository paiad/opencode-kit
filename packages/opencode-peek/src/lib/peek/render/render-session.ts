#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { colorForTool } from "../config/tool-colors.js";
import { peekSnapshotPaths } from "../../session-inspect/paths.js";
import { escapeHtml, renderMarkdown, safeUrl } from "./markdown.js";
import { renderResourcePreview } from "./rich-content.js";
import { loadTokenUsage, renderTokenPanel } from "./token-panel.js";
import type { PeekRenderOptions } from "../types/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const compiledStylesheetPath = resolve(scriptDir, "..", "styles", "pixel.css");
const sourceStylesheetPaths = [
  resolve(scriptDir, "..", "..", "..", "..", "src", "lib", "peek", "styles", "pixel.css"),
  resolve(scriptDir, "..", "..", "..", "..", "..", "src", "lib", "peek", "styles", "pixel.css"),
];
const stylesheetPath = [compiledStylesheetPath, ...sourceStylesheetPaths].find(existsSync) || sourceStylesheetPaths[0];

const compiledAvatarDir = resolve(scriptDir, "..", "avatar");
const sourceAvatarDirs = [
  resolve(scriptDir, "..", "..", "..", "..", "src", "lib", "peek", "avatar"),
  resolve(scriptDir, "..", "..", "..", "..", "..", "src", "lib", "peek", "avatar"),
];
const AVATAR_DIR = [compiledAvatarDir, ...sourceAvatarDirs].find(existsSync) || sourceAvatarDirs[0];

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

function renderToolOutput(output: unknown, preferredFormat: unknown, existingPreview?: string): string {
  const preview = existingPreview ?? renderResourcePreview(output, typeof output === "string" ? { imagesOnly: true } : undefined);
  if (typeof output === "string" && preferredFormat === "markdown") return `${preview}${renderMarkdown(output)}`;
  if (typeof output === "string") return `${preview}<pre class="plain-tool-output"><code>${escapeHtml(output)}</code></pre>`;
  return `${preview}${jsonDetails("Raw output", output ?? null)}`;
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
  const resourcePreview = renderResourcePreview(output, typeof output === "string" ? { imagesOnly: true } : undefined);
  return `<details class="part tool-part ${color.className}"${resourcePreview ? " open" : ""}>
    <summary><span class="tool-title"><span>${escapeHtml(toolName)}</span>${skillName ? `<span class="tool-skill-name">(${escapeHtml(skillName)})</span>` : ""}${outputType ? `<span class="tool-type">${escapeHtml(outputType)}</span>` : ""}</span>${typeof state.status === "string" ? `<span class="badge">${escapeHtml(state.status)}</span>` : ""}</summary>
    <div class="tool-body"><div class="tool-caption">${escapeHtml(normalized.skill || toolName)} output</div>${renderToolOutput(output, input.format, resourcePreview)}</div>
  </details>`;
}

function mimeOfFilePart(part: Record<string, unknown>): string {
  return typeof part.mime === "string" ? part.mime : typeof part.mediaType === "string" ? part.mediaType : "";
}

function renderFilePart(part: Record<string, unknown>): string {
  const mime = mimeOfFilePart(part);
  const filename = typeof part.filename === "string" && part.filename.trim() ? part.filename.trim() : "File attachment";
  const url = typeof part.url === "string" ? part.url : "";
  const imageAttachment = /^image\//.test(mime) || /\.(avif|gif|heic|jpeg|jpg|png|svg|webp)$/i.test(filename);
  const imageUrl = imageAttachment && (/^data:image\//.test(url) || /^blob:/.test(url) || Boolean(safeUrl(url))) ? url : "";
  const openUrl = safeUrl(url);
  const icon = fileIcon(mime, filename);
  const fileJsonLabel = `File JSON (${displayMime(mime) || icon.label})`;
  return `<div class="part file-part"><div class="file-card">
    ${imageUrl ? `<button class="file-preview-trigger" type="button" data-preview-src="${escapeHtml(imageUrl)}" data-preview-alt="${escapeHtml(filename)}"><span class="file-preview-frame"><img class="file-preview-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(filename)}" loading="lazy"></span></button>` : `<div class="file-glyph" aria-label="${escapeHtml(icon.label)} attachment">${icon.svg}</div>`}
    <div class="file-meta"><strong>${escapeHtml(filename)}</strong>${mime ? `<span>${escapeHtml(mime)}</span>` : ""}${openUrl ? `<a href="${escapeHtml(openUrl)}" target="_blank" rel="noreferrer">Open file</a>` : ""}</div>
  </div>${jsonDetails(fileJsonLabel, part)}</div>`;
}

function displayMime(mime: string): string {
  const aliases: Record<string, string> = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/xlsx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "application/pptx",
    "application/msword": "application/doc",
    "application/vnd.ms-excel": "application/xls",
    "application/vnd.ms-powerpoint": "application/ppt",
  };
  return aliases[mime.toLowerCase()] || mime;
}

function fileIcon(mime: string, filename: string): { label: string; svg: string } {
  const normalized = `${mime} ${filename}`.toLowerCase();
  if (normalized.includes("pdf")) return { label: "PDF", svg: fileIconSvg("PDF", "#e65757") };
  if (normalized.includes("word") || /\.(doc|docx)$/i.test(filename)) return { label: "DOCX", svg: fileIconSvg("DOCX", "#3978d4") };
  if (normalized.includes("sheet") || /\.(xls|xlsx|csv)$/i.test(filename)) return { label: "XLS", svg: fileIconSvg("XLS", "#3d9a68") };
  if (normalized.includes("presentation") || /\.(ppt|pptx)$/i.test(filename)) return { label: "PPT", svg: fileIconSvg("PPT", "#df8b3b") };
  if (normalized.includes("text") || /\.(txt|md)$/i.test(filename)) return { label: "TXT", svg: fileIconSvg("TXT", "#7770c5") };
  return { label: "FILE", svg: fileIconSvg("FILE", "#77736a") };
}

function fileIconSvg(label: string, accent: string): string {
  return `<svg class="file-icon-svg" viewBox="0 0 64 76" role="img" aria-label="${escapeHtml(label)} file">
    <path class="file-icon-paper" d="M9 2h31l15 15v57H9z" fill="#fffdf7" stroke="#17140f" stroke-width="3"/>
    <path d="M40 2v16h15" fill="#ede7d8" stroke="#17140f" stroke-width="3" stroke-linejoin="round"/>
    <path d="M17 29h30M17 35h22" stroke="#c8bda8" stroke-width="3" stroke-linecap="square"/>
    <rect x="14" y="45" width="36" height="17" rx="2" fill="${accent}" stroke="#17140f" stroke-width="3"/>
    <text x="32" y="57" text-anchor="middle" fill="#fffdf7" font-family="ui-monospace,monospace" font-size="9" font-weight="900">${escapeHtml(label)}</text>
  </svg>`;
}

function renderPart(rawPart: unknown): string {
  const part = isObject(rawPart) ? rawPart : {};
  const type = typeof part.type === "string" ? part.type : "unknown";
  if (type === "text") return `<div class="text-part">${renderMarkdown(part.text)}${renderResourcePreview(part.text, { imagesOnly: true })}</div>`;
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
  return `(() => { const copy = async text => { if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text); const area = document.createElement('textarea'); area.value = text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }; document.querySelectorAll('.json-copy').forEach(button => button.addEventListener('click', async () => { const text = button.parentElement?.querySelector('code')?.textContent || ''; if (!text) return; await copy(text); button.classList.add('is-copied'); button.textContent = 'Copied'; setTimeout(() => { button.classList.remove('is-copied'); button.textContent = 'Copy JSON'; }, 1200); })); document.querySelectorAll('[data-target]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))); const dialog = document.querySelector('.image-lightbox'); const image = document.querySelector('.image-lightbox-image'); document.querySelectorAll('.file-preview-trigger').forEach(button => button.addEventListener('click', () => { image.src = button.dataset.previewSrc; image.alt = button.dataset.previewAlt || ''; dialog.showModal(); })); document.querySelector('.image-lightbox-close')?.addEventListener('click', () => dialog.close()); })();`;
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
    console.error("Usage: node packages/opencode-peek/dist/lib/peek/render/render-session.js <snapshot-json> [output-html] [--first-n-turns N]");
    process.exit(2);
  }
  console.log(await runRenderSession(parsed.inputPath, parsed.outputPath, parsed.options));
}
