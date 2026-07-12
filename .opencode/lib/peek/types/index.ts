export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = { [key: string]: JsonValue | undefined }

export type PeekRecord = Record<string, unknown>

export type PeekMessageInfo = {
  id?: string
  role?: string
  time?: unknown
  path?: {
    root?: string
    cwd?: string
  }
}

export type PeekPartState = {
  status?: string
  input?: PeekRecord
  output?: unknown
}

export type PeekMessagePart = {
  type?: string
  text?: string
  tool?: string
  mime?: string
  mediaType?: string
  url?: string
  filename?: string
  state?: PeekPartState
}

export type PeekMessage = {
  info?: PeekMessageInfo
  parts?: PeekMessagePart[]
}

export type PeekSnapshot = {
  capturedAt?: string
  sessionID?: string
  messageID?: string
  model?: unknown
  directory?: string
  systemPrompt?: string[]
  path?: {
    root?: string
    cwd?: string
  }
  messages?: PeekMessage[]
}

export type PeekRenderOptions = {
  messageSelection?: {
    mode?: string
    turnCount?: number
  }
}

export type PeekMarker = {
  id: string
  label: string
}

