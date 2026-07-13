# opencode-peek

`opencode-peek` generates an HTML transcript for the current OpenCode session, including a token usage report, deterministic colors for custom tools, local model avatars, and an extensible theme foundation.

The initial release ships with one built-in theme; future themes can be added without changing the session-inspection pipeline.

## Gallery

<div align="center">
  <img src="https://img.paiad.top/img/peek-session-overview.png" alt="opencode-peek session transcript overview" width="700" />
  <p><em>Session transcript with token sidebar — "pixel" theme</em></p>
</div>

<div align="center">
  <img src="https://img.paiad.top/img/peek-token-report-dialog.png" alt="opencode-peek token report dialog" width="700" />
  <p><em>Detailed token usage report in modal dialog</em></p>
</div>

中文安装与 Agent 自动配置说明：[README.zh-CN.md](./README.zh-CN.md)

The plugin and slash command are configured together in `opencode.jsonc`.

## Install

### 🤖 Recommended: let your Agent configure it

Send this instruction to your OpenCode Agent:

````text
Install and configure opencode-peek for the current OpenCode project.

1. Run `opencode plugin opencode-peek` from the current project directory.
2. Read `opencode.jsonc` and preserve all existing settings, plugins, and commands.
3. Add or update `command.peek` with exactly this value:

```json
{
  "description": "Generate an HTML view of the current OpenCode session",
  "template": "Generate a `peek` HTML transcript for the current session. First call `session_inspect` to generate a fresh snapshot and token report. Then call `peek`. Do not pass `firstNTurns` unless the user explicitly requests the first N turns only. If `session_inspect` fails, briefly state the reason and stop. If `peek` fails, briefly state the reason and stop. On success, reply only with the absolute `htmlPath` returned by `peek`. Do not add explanations or perform other actions."
}
```

4. Validate `opencode.jsonc`.
5. Tell me to restart OpenCode after setup.

Do not install the package with npm directly, create a duplicate local plugin, or modify unrelated files.
````

The Agent will install the plugin for the current project, preserve existing settings, configure the command, validate the result, and prompt you to restart OpenCode.

### 🛠️ Manual configuration

Install the plugin for the current project:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-peek"]
}
```

Use `opencode plugin opencode-peek` to install the plugin and update the current project's configuration. To install it globally instead, use `opencode plugin -g opencode-peek`.

Restart OpenCode after installation.

To update an already installed plugin and replace the OpenCode cache, run:

```bash
opencode plugin opencode-peek --force
```

Restart OpenCode and run `/peek` again to regenerate the latest HTML output.

## Add the `/peek` command

OpenCode plugins can register tools, while slash commands are configured in `opencode.jsonc`:

```json
{
  "command": {
    "peek": {
      "description": "Generate an HTML view of the current OpenCode session",
      "template": "Generate a `peek` HTML transcript for the current session. First call `session_inspect` to generate a fresh snapshot and token report. Then call `peek`. Do not pass `firstNTurns` unless the user explicitly requests the first N turns only. If `session_inspect` fails, briefly state the reason and stop. If `peek` fails, briefly state the reason and stop. On success, reply only with the absolute `htmlPath` returned by `peek`. Do not add explanations or perform other actions."
    }
  }
}
```

Then run:

```text
/peek
```

The generated page is always written to:

```text
.workspace/cache/peek/latest.html
```

## Data and privacy

The plugin writes local artifacts under `.workspace/cache/`:

- session token reports;
- session snapshots and generated HTML;
- captured system prompts and model metadata.

These artifacts can contain conversation and tool-output data. Add the following to your project `.gitignore`:

```gitignore
.workspace/cache/
```

## Tools

- `session_inspect` generates the current session's report and snapshot.
- `peek` renders the generated snapshot to `latest.html`.

`session_inspect` data is session-isolated under `.workspace/cache/session-inspect/sessions/<session-id>/`; `latest.json` and `latest.md` are convenience copies of the most recently generated session.

## Development

Run these commands from the `opencode-kit` repository root:

```bash
npm install
npm run build
npm test
npm run pack:peek -- --dry-run
```

Before publishing, inspect the resulting tarball with `npm pack` and install that tarball in a clean OpenCode configuration.

## License

MIT
