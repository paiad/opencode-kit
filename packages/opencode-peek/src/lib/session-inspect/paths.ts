import { join } from "node:path";

function safeSegment(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? "").trim();
  const safe = normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || fallback;
}

export function peekCacheRoot(workspaceRoot: string): string {
  return join(workspaceRoot, ".workspace", "cache", "peek");
}

export function sessionInspectCacheRoot(workspaceRoot: string): string {
  return join(workspaceRoot, ".workspace", "cache", "session-inspect");
}

export function systemPromptCachePath(workspaceRoot: string, sessionID: string | undefined): string {
  return join(sessionInspectCacheRoot(workspaceRoot), "system-prompts", `${safeSegment(sessionID, "session")}.json`);
}

export function sessionInspectArtifactPaths(workspaceRoot: string, sessionID: string | undefined) {
  const root = sessionInspectCacheRoot(workspaceRoot);
  const sessionRoot = join(root, "sessions", safeSegment(sessionID, "session"));
  return {
    analysisPath: join(sessionRoot, "analysis.json"),
    reportPath: join(sessionRoot, "report.md"),
    latestAnalysisPath: join(root, "latest.json"),
    latestReportPath: join(root, "latest.md"),
  };
}

export function peekSnapshotPaths(workspaceRoot: string, sessionID: string | undefined, messageID: string | undefined) {
  const session = safeSegment(sessionID, "session");
  const message = safeSegment(messageID, "message");
  const root = peekCacheRoot(workspaceRoot);
  const latestHtmlPath = join(root, "latest.html");
  return {
    snapshotPath: join(root, "snapshots", session, `${message}.json`),
    latestSnapshotPath: join(root, "latest.json"),
    outputPath: latestHtmlPath,
    latestHtmlPath,
  };
}
