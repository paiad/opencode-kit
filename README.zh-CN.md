# opencode-kit

<p align="center">
  <img src="./assets/opencode-kit-logo.png" width="180" alt="opencode-kit logo">
</p>

<p align="center">
  面向 <a href="https://opencode.ai">OpenCode</a> 的可复用插件与扩展集合。
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/opencode-peek?style=flat-square&color=111111&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/node-%3E%3D22-111111?style=flat-square" alt="Node.js >=22">
  <img src="https://img.shields.io/badge/OpenCode-%3E%3D1.17.14-111111?style=flat-square" alt="OpenCode >=1.17.14">
  <img src="https://img.shields.io/badge/license-MIT-111111?style=flat-square" alt="MIT license">
</p>

English documentation: [README.md](./README.md)

`opencode-kit` 是一个面向 OpenCode 的 monorepo，提供用于会话检查、 transcript 渲染和 Agent 工作流扩展的可复用插件。

## 插件

| 插件 | 说明 | 安装 |
| --- | --- | --- |
| [`opencode-peek`](./packages/opencode-peek) | 将当前 OpenCode 会话渲染为可读的 HTML transcript，并提供 token 使用量和模型头像。 | `npm install opencode-peek` |

## Peek

`opencode-peek` 会将当前 OpenCode 会话转换为可读、可交互的 HTML transcript。

<p align="center">
  <img src="./packages/opencode-peek/assets/peek-session-overview.png" alt="opencode-peek 会话概览" width="860">
</p>

## 安装

从 npm 安装插件：

```bash
npm install opencode-peek
```

要求：Node.js `>=22`，OpenCode `>=1.17.14`。

在 OpenCode 配置的 plugin 列表中加入插件，不要覆盖已有插件：

```json
{
  "plugin": ["opencode-peek"]
}
```

将包内的 command 模板复制到当前项目：

```text
packages/opencode-peek/commands/peek.md
→ .opencode/commands/peek.md
```

修改配置后重启 OpenCode。

### 推荐：让 Agent 自动配置

将下面的指令发送给 OpenCode Agent：

```text
请使用 npm 安装 opencode-peek。
保留现有 OpenCode 配置，并将 opencode-peek 加入 plugin 列表。
将包内的 commands/peek.md 复制到 .opencode/commands/peek.md。
验证配置可解析，并告诉我重启 OpenCode。
```

## 使用

在 OpenCode 中执行：

```text
/peek
```

该命令会：

1. 检查当前会话；
2. 生成 session report；
3. 渲染 HTML transcript；
4. 将最新结果写入 `.workspace/cache/peek/latest.html`。

执行成功后，命令只返回生成 HTML 文件的绝对路径。

## 功能

- 双栏会话 transcript 布局；
- Token 使用量和成本详情；
- 按模型注入头像；
- 根据工具名称 hash 为自定义工具分配稳定颜色；
- OpenCode 内置工具使用中性色；
- 支持可配置的消息摘要截断；
- session inspect 与 HTML 渲染分离；
- 可扩展的视觉主题；
- 生成透明背景的 HTML 页面。

## 生成文件

生成文件存储在 `.workspace/cache/` 下：

```text
.workspace/cache/
├── peek/
│   └── latest.html
└── session-inspect/
    ├── latest.json
    └── latest.md
```

这些文件属于本地生成产物，不应提交到 Git。

`session_inspect` 负责准备结构化 session 数据，`peek` 负责将这些数据渲染为 HTML。

## 仓库结构

```text
opencode-kit/
├── assets/                         # 根 README 资源
├── packages/
│   └── opencode-peek/
│       ├── assets/                 # npm 包文档图片
│       ├── commands/               # OpenCode command 模板
│       ├── dist/                   # 发布构建产物
│       └── README.md               # 插件文档
├── package.json                    # 根 workspace 配置
└── README.md                       # 英文文档
```

根目录 `assets/` 只服务于仓库 README。插件专属文档资源放在 package 内，并在需要时随 npm tarball 一起发布。

## 开发

仓库使用 npm workspaces。每个 package 都可以独立构建和发布。

```bash
npm install
npm run build
npm test
npm run pack:peek -- --dry-run
```

`npm run pack:peek -- --dry-run` 可以在发布前检查 `opencode-peek` npm 包实际包含的文件。

## 新增插件

1. 在 `packages/` 下创建目录；
2. 将 package 加入 workspace 配置；
3. 提供 package README 和测试；
4. 将 package 专属资源放在 package 内；
5. 发布前验证 npm tarball。

## 文档

- [`opencode-peek` 插件文档](./packages/opencode-peek/README.zh-CN.md)
- [`opencode-peek` command 模板](./packages/opencode-peek/commands/peek.md)

## 许可证

MIT，详见 [`LICENSE`](./packages/opencode-peek/LICENSE)。
