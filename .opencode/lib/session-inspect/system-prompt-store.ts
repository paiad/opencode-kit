import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { systemPromptCachePath } from "./paths.js"

export type CapturedSystemPrompt = {
  capturedAt: string
  sessionID: string
  model?: unknown
  systemPrompt: string[]
}

function normalizeSystemPrompt(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []

  for (const item of value) {
    if (typeof item !== "string") continue
    const trimmed = item.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

export async function writeCapturedSystemPrompt(input: {
  workspaceRoot: string
  sessionID?: string
  model?: unknown
  systemPrompt?: unknown
}): Promise<CapturedSystemPrompt | undefined> {
  const sessionID = input.sessionID?.trim()
  const systemPrompt = normalizeSystemPrompt(input.systemPrompt)
  if (!sessionID || !systemPrompt.length) return undefined

  const payload: CapturedSystemPrompt = {
    capturedAt: new Date().toISOString(),
    sessionID,
    model: input.model,
    systemPrompt,
  }
  const text = `${JSON.stringify(payload, null, 2)}\n`
  const path = systemPromptCachePath(input.workspaceRoot, sessionID)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, text, "utf8")

  return payload
}

export async function readCapturedSystemPrompt(input: {
  workspaceRoot: string
  sessionID?: string
}): Promise<CapturedSystemPrompt | undefined> {
  const sessionID = input.sessionID?.trim()
  if (!sessionID) return undefined
  const candidates = [systemPromptCachePath(input.workspaceRoot, sessionID)]

  for (const path of candidates) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as CapturedSystemPrompt
      const systemPrompt = normalizeSystemPrompt(parsed.systemPrompt)
      if (!systemPrompt.length) continue
      return {
        ...parsed,
        systemPrompt,
      }
    } catch {
      continue
    }
  }

  return undefined
}
