# opencode-peek

`opencode-peek` generates an HTML transcript for the current OpenCode session, including a token usage report, deterministic colors for custom tools, local model avatars, and an extensible theme foundation.

The initial release ships with one built-in theme; future themes can be added without changing the session-inspection pipeline.

## Gallery

<div align="center">
  <img src="./assets/peek-session-overview.png" alt="opencode-peek session transcript overview" width="700" />
  <p><em>Session transcript with token sidebar — "pixel" theme</em></p>
</div>

<div align="center">
  <img src="./assets/peek-token-report-dialog.png" alt="opencode-peek token report dialog" width="700" />
  <p><em>Detailed token usage report in modal dialog</em></p>
</div>

中文安装与 Agent 自动配置说明：[README.zh-CN.md](./README.zh-CN.md)

The package also includes the standard command template at `commands/peek.md`. Copy it to `.opencode/commands/peek.md` after installation, or configure the equivalent command in `opencode.json`.

## Recommended: Let your Agent install and configure it

Send this instruction to your OpenCode Agent:

```text
Please install and configure the opencode-peek npm plugin: preserve the existing OpenCode configuration, add opencode-peek to the plugin list, write the package's commands/peek.md to the current project's .opencode/commands/peek.md, validate the configuration, and tell me to restart OpenCode.
```

The Agent will install the npm package, preserve existing settings, configure the command, validate the result, and prompt you to restart OpenCode.

## Install

Add the plugin to your OpenCode configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-peek"]
}
```

OpenCode installs npm plugins automatically at startup. Restart OpenCode after adding the plugin.

## Add the `/peek` command

OpenCode plugins can register tools, but slash commands are configured by the user. Add this to `opencode.json`:

```json
{
  "command": {
    "peek": {
      "description": "Generate an HTML view of the current OpenCode session",
      "template": "Generate a `peek` HTML transcript for the current session. First call `session_inspect` to generate a fresh snapshot and token report. Then call `peek`. Do not pass `firstNTurns` unless the user explicitly requests the first N turns only. If either tool fails, briefly state the reason and stop. On success, reply only with the absolute `htmlPath` returned by `peek`."
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
