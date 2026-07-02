---
title: 'Pi Agent：一个把"可扩展"做到极致的终端编码智能体'
date: '2026-07-02'
tags: ['Agent', 'CLI']
draft: false
summary: 'Pi 是一个极简的终端编码智能体（coding agent）。它内置的工具只有四个，却通过 Skills、Extensions、Prompt Templates、Themes 和 Pi Packages 把扩展能力交还给用户。本文梳理它的整体架构、核心包与设计哲学。'
---

# Pi Agent：把"可扩展"做到极致的终端编码智能体

[Pi](https://pi.dev) 是 [earendil-works](https://github.com/earendil-works) 出品的一个开源终端编码智能体（terminal coding harness）。它的核心思路可以用一句话概括：

> 适配你的工作流，而不是让你适配它——而且不需要 fork 或修改 Pi 的内核。

Pi 内置的工具只有 `read`、`write`、`edit`、`bash` 四个，却通过 **Skills / Extensions / Prompt Templates / Themes / Pi Packages** 五个扩展机制，让你能把它塑造成任何你想要的形态：可以是一个 Claude Code 的替代品、一个带权限门禁的沙箱 agent，甚至能在等待模型响应时跑一局 Doom。

## 整体架构：四个分层包

Pi 是一个 monorepo，按依赖方向从下到上分为四个包，每一层都可以独立使用：

| 包                  | npm 名                            | 职责                                                                        |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| **pi-ai**           | `@earendil-works/pi-ai`           | 统一的多 Provider LLM API，自动鉴权、流式、token/成本追踪、跨 provider 切换 |
| **pi-tui**          | `@earendil-works/pi-tui`          | 极简终端 UI 框架，差分渲染 + 同步输出，无闪烁                               |
| **pi-agent-core**   | `@earendil-works/pi-agent-core`   | 有状态 Agent 运行时：工具调用 + 状态管理 + 事件流                           |
| **pi-coding-agent** | `@earendil-works/pi-coding-agent` | 面向用户的交互式编码 CLI，集成上述三层                                      |

依赖链清晰：`coding-agent → agent-core → ai`，`tui` 作为表现层被 `coding-agent` 使用。也就是说，如果你只想在自己的应用里嵌入一个能调工具的 agent，直接用 `pi-agent-core` + `pi-ai` 就够了，完全不用碰 CLI 和 TUI。

## pi-ai：统一的多 Provider LLM API

这是整个项目的地基。它的目标是：**用一套接口对接所有主流大模型供应商**，并且只收录支持 tool calling（function calling）的模型——因为这是 agent 工作流的前提。

支持的供应商覆盖极广，包括：

- **订阅类（OAuth 登录）**：Anthropic Claude Pro/Max、OpenAI ChatGPT Plus/Pro（Codex）、GitHub Copilot
- **API Key 类**：Anthropic、OpenAI、Azure OpenAI、DeepSeek、Google Gemini、Google Vertex、Amazon Bedrock、Mistral、Groq、Cerebras、xAI、OpenRouter、NVIDIA NIM、Cloudflare、Vercel AI Gateway、Hugging Face、Fireworks、Together AI、Kimi、MiniMax、小米 MiMo、ZAI、OpenCode 系列等

它解决的几个痛点：

1. **自动鉴权解析**：从 credential store、环境变量、OAuth token 里按优先级自动找到可用凭证。
2. **统一的工具调用与流式**：不同 provider 的 function calling 协议差异被抹平，部分 JSON 流式也做了统一处理。
3. **Thinking / Reasoning 统一接口**：把各家的推理输出抽象成一致的 `stream` / `complete` 接口。
4. **Token 与成本追踪**：内置成本计算，session 结束时能直接看到花了多少钱。
5. **跨 Provider 切换（hand-off）**：session 中途可以换模型，上下文做序列化迁移。
6. **自定义 Provider**：如果供应商走的是 OpenAI / Anthropic / Google 兼容协议，直接在 `models.json` 里加；完全自定义的 API 或 OAuth 则通过 `createProvider()` 实现。

## pi-tui：无闪烁的终端 UI 框架

一个独立的终端 UI 库，亮点是**差分渲染（differential rendering）**和**同步输出（CSI 2026）**，做到刷新时不闪烁。它提供组件化 API（Text、Input、Editor、Markdown、SelectList、Image、Box 等），支持：

- Bracketed paste mode（正确处理大段粘贴）
- 主题接口
- Kitty / iTerm2 图形协议的**内联图片渲染**
- 文件路径与 slash 命令的自动补全

这也解释了为什么 Pi 的交互界面体验能做得相当丝滑——它从渲染层就是自己掌控的。

## pi-agent-core：Agent 运行时

这是连接 LLM 和工具的中间层。核心概念是 **`AgentMessage`** ——一种比原生 LLM 消息更灵活的类型：

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
                   (可选)                              (必需)
```

- **`transformContext`**：裁剪旧消息、注入外部上下文（窗口管理）
- **`convertToLlm`**：过滤掉 UI 专用的消息，把自定义类型转成 LLM 能理解的标准 `user` / `assistant` / `toolResult`

通过 declaration merging，应用层可以注入自定义消息类型（比如一条"用户点击了某个按钮"的事件），它在 UI 里可见，但在送给 LLM 前被自动过滤或转换。

Agent 以**事件流（event stream）**形式向外广播：文本 delta、工具调用、工具结果、thinking 等。你 `subscribe` 这些事件就能搭出任意响应式界面。典型用法只要十几行：

```typescript
import { Agent } from '@earendil-works/pi-agent-core'
import { getModel } from '@earendil-works/pi-ai'

const agent = new Agent({
  initialState: {
    systemPrompt: 'You are a helpful assistant.',
    model: getModel('anthropic', 'claude-sonnet-4-20250514'),
  },
})

agent.subscribe((event) => {
  if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
    process.stdout.write(event.assistantMessageEvent.delta)
  }
})

await agent.prompt('Hello!')
```

其内部的核心是一个由 LLM 生成与工具执行驱动的异步状态机（`runLoop`），每轮大致经历：准备上下文（合并 steering 消息、`transformContext` 截断/摘要、`convertToLlm` 转格式）→ 流式生成（`streamSimple`）→ 解析 toolCall → 执行工具（`beforeToolCall` 钩子 → 参数校验 → `tool.execute` → `afterToolCall` 钩子 → 回填 `ToolResultMessage`）→ 轮次评估（`prepareNextTurn` / `shouldStopAfterTurn`）。

## pi-coding-agent：面向用户的 CLI

这是普通用户真正接触到的产品，即 `pi` 命令本身。它有四种运行模式：

- **Interactive**：终端交互（默认）
- **Print / JSON**：一次性输出，适合脚本
- **RPC**：通过 stdin/stdout 的 JSONL 协议与外部进程集成（非 Node.js 环境友好）
- **SDK**：作为库嵌入到自己的应用里

### 交互界面

从上到下依次是：启动头（提示已加载的 AGENTS.md、prompt 模板、skills、extensions）→ 消息区（你的输入、助手回复、工具调用与结果、扩展 UI）→ 编辑器（边框颜色表示 thinking level）→ 页脚（工作目录、session 名、token / 缓存用量、成本、上下文占用、当前模型）。

编辑器支持 `@` 模糊引用文件、Tab 路径补全、`Ctrl+V` 粘贴图片、`!command` 直接跑 bash 并把输出喂给模型。还有一套贴心的**消息队列**：

- `Enter` 排入一条 **steering** 消息（当前轮工具执行完后立刻送入，用于纠偏）
- `Alt+Enter` 排入一条 **follow-up** 消息（agent 全部做完后才送入）

### Session 与分支

Pi 的 session 支持**分支（branching）**和**压缩（compaction）**：

- `/tree` 可以跳到 session 中任意一点继续，相当于 git 的 checkout
- `/fork`、`/clone` 从历史消息分叉出新 session
- `/compact` 手动压缩上下文，长对话不会撑爆窗口

### 丰富的 slash 命令

`/login`、`/model`、`/scoped-models`、`/settings`、`/resume`、`/export`、`/import`、`/share`（上传成 GitHub gist）等一应俱全。`Ctrl+L` 切模型、`Ctrl+P` 在 scoped 模型间循环、`Shift+Tab` 切 thinking level、`Escape` 两次打开 `/tree`。

## 五大扩展机制

这是 Pi 最有特色的部分。它把"别的工具内置的功能"统统做成可选扩展，保持内核极简。

### 1. Prompt Templates（提示词模板）

Markdown 文件，`/name` 展开，支持 `{{变量}}`。放在 `~/.pi/agent/prompts/` 或 `.pi/prompts/`。

### 2. Skills（技能）

遵循 [Agent Skills 标准](https://agentskills.io) 的按需能力包，本质是带 `## Steps` 的 Markdown，通过 `/skill:name` 调用或让 agent 自动加载。搜索路径覆盖 `~/.pi/agent/skills/`、`~/.agents/skills/`，以及从 cwd 向上的 `.pi/skills/`、`.agents/skills/`。

### 3. Extensions（扩展）

这是最强力的机制——TypeScript 模块，可以**重新定义 Pi 的一切**：

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: 'deploy' /* ... */ })
  pi.registerCommand('stats', {
    /* ... */
  })
  pi.on('tool_call', async (event, ctx) => {
    /* ... */
  })
}
```

官方列出的可能性包括：自定义/替换内置工具、子 agent 与 plan mode、自定义压缩与摘要、权限门禁与路径保护、自定义编辑器和 UI 组件、状态栏、Git 自动提交、SSH 与沙箱执行、**MCP server 集成**、让 Pi 长得像 Claude Code……甚至"等待时跑 Doom"。

### 4. Themes（主题）

内置 `dark` / `light`，主题文件**热重载**——改完立刻生效。

### 5. Pi Packages（包分发）

把 extensions / skills / prompts / themes 打包，通过 **npm 或 git** 分发：

```bash
pi install npm:@foo/pi-tools
pi install git:github.com/user/repo@v1
pi update --all # 更新 pi 和所有包
pi config       # 启用/禁用包内资源
```

只需在 `package.json` 里加一个 `pi` 字段声明资源目录，或让 Pi 按约定目录自动发现。

> ⚠️ **安全提醒**：Pi packages 拥有完整系统权限（extensions 执行任意代码，skills 可指示模型执行任意操作）。安装第三方包前务必 review 源码。

## 设计哲学：为什么"不内置"

Pi 的哲学很鲜明——它**故意不内置**很多常见功能，理由是把选择权留给你：

- **没有 MCP**：鼓励用"带 README 的 CLI 工具"（见 Skills），或自己写扩展加 MCP。
- **没有子 agent**：可以用 tmux 起多个 pi 实例，或用扩展/第三方包实现。
- **没有权限弹窗**：在容器里跑，或用扩展自定义确认流程。
- **没有 plan mode**：把计划写进文件，或用扩展实现。
- **没有内置 TODO**：作者认为它会让模型困惑，建议用 `TODO.md`。
- **没有后台 bash**：用 tmux，获得完整可观测性。

这个"内核极简 + 扩展万能"的取舍，让 Pi 既不会因为功能臃肿而难以维护，也不会因为某个功能"官方不支持"而卡住用户——任何缺失都能自己补上。

## 权限与容器化

Pi 本身**不带权限系统**，默认以启动它的用户/进程权限运行。如果需要更强隔离，官方文档给了三种容器化方案：

1. **Gondolin 扩展**：pi 和鉴权留在宿主机，把内置工具和 `!` 命令路由进本地 Linux micro-VM。
2. **Plain Docker**：整个 pi 进程跑在容器里，简单隔离。
3. **OpenShell**：跑在策略控制的沙箱里。

## 供应链安全

作为一个会执行代码的 agent，Pi 对供应链相当谨慎：

- 直接外部依赖**精确锁版本**，内部 workspace 包用范围版本
- `.npmrc` 设 `save-exact=true` 和 `min-release-age=2`，避免当天发布的依赖
- `package-lock.json` 是依赖唯一真相源，pre-commit 阻止误提交 lockfile（除非设 `PI_ALLOW_LOCKFILE_CHANGE=1`）
- 发布的 CLI 含 `npm-shrinkwrap.json`，钉死传递依赖
- 发布前用 `npm run release:local` 在仓库外做隔离的 npm / Bun 安装冒烟测试
- CI 用 `npm ci --ignore-scripts`，定时跑 `npm audit` 和签名校验
- shrinkwrap 生成有显式 allowlist，新的生命周期脚本依赖会直接 fail check 直到人工 review

## 开发与上手

```bash
npm install --ignore-scripts # 安装依赖（不跑 lifecycle 脚本）
npm run build                # 构建所有包
npm run check                # lint + format + 类型检查
./test.sh                    # 跑测试（无 API key 时跳过依赖 LLM 的用例）
./pi-test.sh                 # 从源码直接跑 pi
```

要求 Node `>= 22.19.0`。想快速体验：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

或用订阅：`pi` 启动后 `/login` 选 provider 即可。

## 小结

Pi 的价值不在于它内置了多少功能，而在于它**把扩展点设计得足够干净**，让你既不用 fork 内核、也不用对抗它的假设，就能把它改造成符合自己工作流的 agent。如果你正在做以下事情，值得一看 Pi：

- 想要一个可控、可审计、可定制的终端编码 agent
- 想在自己的产品里嵌入 agent 能力（用 `pi-agent-core` + `pi-ai`）
- 对"agent 应该内置哪些功能"有自己的看法，想亲自实现

相关链接：

- 官网与文档：https://pi.dev
- GitHub：https://github.com/earendil-works/pi-coding-agent
- 设计理念博文：https://mariozechner.at/posts/2025-11-30-pi-coding-agent/
- RFC：https://rfc.earendil.com/keyword/pi/
