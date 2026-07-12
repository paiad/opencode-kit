import { escapeHtml, safeUrl } from "./markdown.js";

const MAX_RESOURCES = 16;
const MAX_DEPTH = 5;
const URL_KEYS = ["url", "href", "link"];

type Resource = {
  url: string;
  imageUrl: string;
  label: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUrl(value: unknown): string {
  return safeUrl(typeof value === "string" ? value.trim() : "");
}

function isImageUrl(value: string): boolean {
  return /^data:image\//i.test(value) || /\.(?:avif|gif|heic|jpeg|jpg|png|svg|webp)(?:[?#].*)?$/i.test(value);
}

function labelForUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname).split("/").filter(Boolean).pop();
    return path || parsed.hostname.replace(/^www\./i, "") || "Resource";
  } catch {
    return "Resource";
  }
}

function addResource(resources: Resource[], seen: Set<string>, url: string): void {
  if (!url || seen.has(url) || resources.length >= MAX_RESOURCES) return;
  seen.add(url);
  resources.push({
    url,
    imageUrl: isImageUrl(url) ? url : "",
    label: labelForUrl(url),
  });
}

function collectResources(value: unknown, resources: Resource[], seen: Set<string>, visited: Set<object>, depth: number): void {
  if (resources.length >= MAX_RESOURCES || depth > MAX_DEPTH || value == null) return;
  if (typeof value === "string") {
    const markdown = /\[[^\]]{1,180}\]\((https?:\/\/[^\s)]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = markdown.exec(value)) && resources.length < MAX_RESOURCES) addResource(resources, seen, normalizeUrl(match[1]));
    const bare = /https?:\/\/[^\s<>"')\]]+/gi;
    while ((match = bare.exec(value)) && resources.length < MAX_RESOURCES) addResource(resources, seen, normalizeUrl(match[0]));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectResources(item, resources, seen, visited, depth + 1);
    return;
  }
  if (!isObject(value) || visited.has(value)) return;
  visited.add(value);

  for (const key of URL_KEYS) addResource(resources, seen, normalizeUrl(value[key]));
  for (const [key, child] of Object.entries(value)) {
    if (URL_KEYS.includes(key)) continue;
    if (isObject(child) || Array.isArray(child)) collectResources(child, resources, seen, visited, depth + 1);
  }
}

export function extractResources(value: unknown): Resource[] {
  const resources: Resource[] = [];
  collectResources(value, resources, new Set<string>(), new Set<object>(), 0);
  return resources;
}

export function renderResourcePreview(value: unknown, options: { imagesOnly?: boolean } = {}): string {
  const resources = extractResources(value).filter((resource) => !options.imagesOnly || resource.imageUrl);
  if (!resources.length) return "";
  return `<section class="rich-output resource-output generic-resource-output" aria-label="Detected resources">
    <div class="rich-head"><div><h2>Resources</h2><p>Links and media detected from message content</p></div><span>${resources.length} found</span></div>
    <div class="resource-grid">${resources.map((resource) => `<article class="resource-card">
      <div class="resource-thumb">${resource.imageUrl ? `<img src="${escapeHtml(resource.imageUrl)}" alt="${escapeHtml(resource.label)}" loading="lazy">` : `<div class="placeholder">LINK</div>`}</div>
      <div class="resource-body"><h3>${escapeHtml(resource.label)}</h3><p>${escapeHtml(resource.url)}</p><div class="action-strip"><a href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer">Open source</a></div></div>
    </article>`).join("")}</div>
  </section>`;
}
