# opencode-peek

`opencode-peek` 是一个可扩展主题的 OpenCode 会话 transcript 插件，提供：

- 当前会话 HTML transcript；
- Token Usage 报告；
- 自定义工具的稳定颜色分配；
- 根据模型识别的本地头像；
- 可扩展的主题渲染基础。

## 效果预览

<div align="center">
  <img src="https://img.paiad.top/img/peek-session-overview.png" alt="opencode-peek 会话 transcript 概览" width="700" />
  <p><em>会话 transcript 与 Token 侧边栏 —— "pixel" 主题</em></p>
</div>

<div align="center">
  <img src="https://img.paiad.top/img/peek-token-report-dialog.png" alt="opencode-peek Token 报告弹窗" width="700" />
  <p><em>Token 用量详细报告弹窗</em></p>
</div>

## 安装

### 🤖 推荐：让 Agent 自动配置

把下面这段话直接发给你的 OpenCode Agent：

````text
请为当前 OpenCode 项目安装并配置 opencode-peek。

1. 在当前项目目录执行 `opencode plugin opencode-peek`。
2. 读取 `opencode.jsonc`，保留所有已有的配置、plugin 和 command。
3. 使用下面的内容新增或更新 `command.peek`：

```json
{
  "description": "Generate an HTML view of the current OpenCode session",
  "template": "Generate a `peek` HTML transcript for the current session. First call `session_inspect` to generate a fresh snapshot and token report. Then call `peek`. Do not pass `firstNTurns` unless the user explicitly requests the first N turns only. If `session_inspect` fails, briefly state the reason and stop. If `peek` fails, briefly state the reason and stop. On success, reply only with the absolute `htmlPath` returned by `peek`. Do not add explanations or perform other actions."
}
```
4. 验证 `opencode.jsonc`。
5. 配置完成后告诉我重启 OpenCode。

不要直接使用 npm 安装，不要创建重复的本地 plugin，不要修改无关文件。
````

Agent 会按当前项目范围安装插件、配置 command，并提示重启 OpenCode。

### 🛠️ 手动配置

插件和 command 都配置在当前项目的 `opencode.jsonc` 中：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-peek"],
  "command": {
    "peek": {
      "description": "Generate an HTML view of the current OpenCode session",
      "template": "Generate a peek HTML transcript for the current session. First call session_inspect to generate a fresh snapshot and token report. Then call peek. Do not pass firstNTurns unless the user explicitly requests the first N turns only. If either tool fails, briefly state the reason and stop. On success, reply only with the absolute htmlPath returned by peek."
    }
  }
}
```

如果要安装到全局配置，可使用：

```bash
opencode plugin -g opencode-peek
```

完成后重启 OpenCode，再使用：

```text
/peek
```

如果已经安装过旧版本，需要强制刷新 OpenCode 的插件缓存：

```bash
opencode plugin opencode-peek --force
```

然后重启 OpenCode，并重新执行 `/peek` 生成最新 HTML。

## 产物和隐私

结果写入：

```text
.workspace/cache/peek/latest.html
```

同时会保存 session report、snapshot、system prompt 和工具输出。这些内容可能包含敏感信息，请将以下目录加入项目 `.gitignore`：

```gitignore
.workspace/cache/
```

## 开发

在 `opencode-kit` 仓库根目录执行：

```bash
npm install
npm test
npm run build
npm run pack:peek -- --dry-run
```

当前版本是 `0.1.0`。首个内置主题只是默认主题，后续可以添加其他主题而不改变 session inspect 数据链路。
