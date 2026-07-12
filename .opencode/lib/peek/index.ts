import { existsSync } from "node:fs"
import { join } from "node:path"
import { runRenderSession } from "./render/render-session.js"

export type PeekRenderOptions = {
  messageSelection?: {
    mode: "first-n-turns"
    turnCount: number
  }
}

export type RenderPeekHtmlInput = {
  workspaceRoot: string
  firstNTurns?: number
}

export function defaultSnapshotPath(workspaceRoot: string): string {
  return join(workspaceRoot, ".workspace", "cache", "peek", "latest.json")
}

export function defaultLatestHtmlPath(workspaceRoot: string): string {
  return join(workspaceRoot, ".workspace", "cache", "peek", "latest.html")
}

export async function renderPeekHtml(input: RenderPeekHtmlInput): Promise<string> {
  const workspaceRoot = String(input.workspaceRoot || "").trim()
  const snapshotPath = defaultSnapshotPath(workspaceRoot)

  if (!existsSync(snapshotPath)) {
    throw new Error(`Peek snapshot not found: ${snapshotPath}`)
  }

  return runRenderSession(snapshotPath, undefined, {
    ...(Number.isInteger(input.firstNTurns) && Number(input.firstNTurns) > 0
      ? {
          messageSelection: {
            mode: "first-n-turns" as const,
            turnCount: Number(input.firstNTurns),
          },
        }
      : {}),
  })
}
