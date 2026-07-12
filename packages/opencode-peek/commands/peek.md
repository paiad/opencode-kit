---
description: Generate an HTML view of the current OpenCode session
---

Generate a `peek` HTML transcript for the current session.

First call `session_inspect` to generate a fresh snapshot and token report. Then call `peek`. Do not pass `firstNTurns` unless the user explicitly requests the first N turns only.

Rules:

- If rendering fails, briefly state the reason.
- If `session_inspect` fails, briefly state the reason and stop.
- On success, reply only with the absolute `htmlPath` returned by `peek`. Do not add explanations or perform other actions.
