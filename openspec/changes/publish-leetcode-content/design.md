## Context

LeetCode 每日任务当前会拉取每日题目和题解，把数据缓存到 `data/leetcode-daily`，再把 MDX 文章渲染到 `data/blog`，最后按配置发送邮件。远端博客内容发布已经由 `scripts/publish-content.mjs` 负责：它会编译本地文章、上传变更后的文章 JSON、更新博客索引和搜索索引，并维护 MinIO manifest。

新行为只需要串联这两条已有流程。LeetCode 任务不应复制发布脚本里的内容编译、哈希、manifest 或 S3 上传逻辑。

生产环境运行的是 `tasks/dist` 发布包。当前 `tasks/build.mjs` 只打包 worker 和 tasks，不会带上 `scripts/publish-content.mjs` 或 `scripts/blog-utils.mjs`；同时 `blog-utils.mjs` 当前按脚本文件位置推导项目根目录，直接复制到 `tasks/dist/scripts` 后会错误解析到 `tasks/dist/data/blog`。因此生产包需要包含发布脚本，并让发布脚本按任务项目根目录读取内容。

## Goals / Non-Goals

**Goals:**

- 在生成的 LeetCode 文章写入 `data/blog` 后立即发布。
- 开发环境从项目根目录调用 `./scripts/publish-content.mjs`，生产环境从 `tasks/dist/scripts/publish-content.mjs` 调用打包后的发布脚本。
- 打包后的发布脚本仍按任务项目根目录读取 `data/blog`、`data/siteMetadata.js` 和 `.env`，不按 `tasks/dist/scripts` 推导内容根目录。
- 允许通过 `config.json` 的 job `env` 指定环境变量文件路径；未指定时默认使用项目根目录 `.env`。
- 支持测试和本地运行时通过配置跳过发布。
- 发布失败时让 LeetCode 任务失败，使调度器和日志能明确反映每日内容流程未完整完成。

**Non-Goals:**

- 替换 `scripts/publish-content.mjs` 或改变 MinIO 发布格式。
- 改变 LeetCode 题目、题解的拉取或缓存方式。
- 改变邮件通知语义；本次只保持内容生成后的既有通知流程。

## Decisions

1. 以子进程调用现有发布脚本，运行时选择可用脚本路径。

   `tasks/leetcode-daily` 增加一个小的发布 helper。开发环境优先执行项目根目录下的 `scripts/publish-content.mjs`；生产打包环境优先执行 `tasks/dist/scripts/publish-content.mjs`。无论脚本来自哪个位置，子进程 `cwd` 都设置为检测到的任务项目根目录，输出继承或转发到任务日志。这能保持任务与现有 `publish:content` 脚本一致，也避免直接 import 一个当前会在顶层 catch 中调用 `process.exit(1)` 的可执行脚本。

   考虑过的替代方案：把 `publish-content.mjs` 抽成可 import 的模块后直接调用。长期看这更干净，但会扩大变更范围，触碰当前需求不必修改的脚本结构和测试。

2. 通过环境变量让发布可关闭。

   使用类似 `PUBLISH_CONTENT=false` 或 `PUBLISH_CONTENT=0` 的环境变量跳过发布。默认行为应为发布，因为需求是 LeetCode 内容拉取生成后需要上传。测试可默认关闭发布，除非测试目标就是发布 helper。

   考虑过的替代方案：把发布做成 opt-in。这对本地运行干扰更小，但需要确保所有运行时配置都正确开启，否则无法满足调度流程预期。

3. 构建生产包时复制发布脚本和本地依赖。

   `tasks/build.mjs` 需要把 `scripts/publish-content.mjs` 和它的本地依赖 `scripts/blog-utils.mjs` 复制到 `tasks/dist/scripts/`。由于发布脚本依赖包仍来自项目依赖，生产部署需要保留对应 `node_modules`/包管理安装结果；本变更不引入独立二进制打包。

   考虑过的替代方案：用 esbuild 把发布脚本 bundle 成一个 CJS 文件。该脚本和 `blog-utils.mjs` 依赖 MDX/rehype/remark/Next env 等 ESM 包和动态资源，直接 bundle 风险更高；复制 ESM 脚本更贴近当前 `node ./scripts/publish-content.mjs` 的运行方式。

4. 发布脚本按项目根目录读取内容。

   `scripts/blog-utils.mjs` 应支持从环境变量读取项目根目录，例如优先使用 `CONTENT_PROJECT_ROOT`，再回退到 `TASKS_PROJECT_ROOT`，最后才按脚本位置推导。LeetCode 发布 helper 在启动发布子进程时应传入该项目根目录，确保打包后的 `tasks/dist/scripts/blog-utils.mjs` 仍读取真实的 `data/blog` 和 `data/siteMetadata.js`。

   考虑过的替代方案：在生产包中复制 `data/`。这会把运行时生成内容和静态任务包混在一起，并且无法自然覆盖任务写入的项目根目录 `data/blog`。

5. 环境变量文件路径由任务环境配置传入。

   LeetCode 任务启动后先读取一个约定环境变量，例如 `LEETCODE_DAILY_ENV_PATH`。该变量可以配置在 `tasks/worker/config.json` 的 `jobs[].env` 中。若该变量存在，任务按项目根目录解析相对路径，并加载该文件；若不存在，则保持当前默认行为，加载项目根目录 `.env`。发布子进程继承已加载的 `process.env`，因此 `publish-content.mjs` 可以继续使用现有 `requiredEnv()` 校验和 MinIO 上传逻辑。

   考虑过的替代方案：给 worker config schema 新增 `envFile` 字段。这个字段更显式，但需要改 worker 类型、校验、文档和配置重写逻辑；当前 job `env` 已能表达该路径，改动范围更小。

6. 在邮件通知前发布。

   发布应在 MDX 文件写入后立即执行。邮件仍保持可选，并继续沿用当前“邮件失败不导致任务失败”的行为。发布失败不同，因为没有远端内容上传时，本次需求对应的工作流并未完成。

   考虑过的替代方案：邮件后发布。这可能在文章尚未远端可用前就发送成功通知。

## Risks / Trade-offs

- 发布脚本依赖 MinIO 环境变量 -> 如果发布开启但配置的 env 文件路径错误或缺少凭据，任务会失败。缓解方式：文档说明 env 文件路径未配置时默认读取 `.env`、本地/测试可使用 `PUBLISH_CONTENT=false`，并把现有发布脚本的校验错误保留在任务日志中。
- 生产包内发布脚本找错内容根目录 -> 会发布不到刚生成的文章。缓解方式：发布子进程显式传入项目根目录，`blog-utils.mjs` 优先使用该根目录解析 `data/blog`。
- 子进程调用会增加进程开销 -> 这是每日调度任务，且发布脚本本身已有网络 I/O，该开销可接受。
- 本地 MDX 写入后发布可能失败 -> 调度器会看到失败运行，但重跑任务可以复用缓存并发布已生成文章。

## Migration Plan

1. 更新 dotenv 加载逻辑，支持从 job `env` 指定环境变量文件路径，未配置时继续使用项目根目录 `.env`。
2. 更新 `tasks/build.mjs`，把发布脚本及本地依赖复制到 `tasks/dist/scripts/`。
3. 更新发布脚本的内容根目录解析，支持由任务传入项目根目录。
4. 添加发布 helper，并在 `runLeetcodeDaily()` 的 `writeBlogPost()` 之后调用。
5. 为 env 路径解析、生产包脚本路径选择、打包文件存在性、跳过发布、发布成功和发布失败处理添加聚焦测试。
6. 更新任务文档，说明默认发布行为、生产包内发布脚本、env 文件路径配置、`publish-content.mjs` 所需 MinIO 环境变量，以及跳过发布的开关。
7. 通过 `yarn tasks:build` 重建任务 bundle 后部署。
