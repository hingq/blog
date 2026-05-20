## Why

当前 LeetCode 每日任务会把生成的文章写入 `data/blog`，但远端博客索引和文章 JSON 只有在单独执行 `./scripts/publish-content.mjs` 后才会更新。每日任务需要在拉取并生成 LeetCode 文章后自动走现有发布流程，避免手动补跑上传步骤。

## What Changes

- 在 LeetCode 每日任务成功写入本地 MDX 文章后，执行 `./scripts/publish-content.mjs`。
- 复用现有发布脚本和 `publish:content` 行为，不新增第二套上传实现。
- 生产构建需要把发布脚本及其本地脚本依赖打包到 `tasks/dist`，使生产任务包不依赖源码目录下的 `scripts/`。
- 在 LeetCode 任务日志中输出发布进度和失败信息。
- 支持通过 `config.json` 的任务环境配置指定环境变量文件路径；未配置时默认读取项目根目录 `.env`。
- 支持通过配置关闭内容发布，便于本地和测试运行。
- 保持邮件通知逻辑独立，除非后续明确要求调整。

## Capabilities

### New Capabilities
- `leetcode-content-publishing`: 定义生成的 LeetCode 每日内容如何通过现有内容发布脚本上传。

### Modified Capabilities

## Impact

- 影响代码：`tasks/build.mjs`、`scripts/publish-content.mjs`、`scripts/blog-utils.mjs`、`tasks/leetcode-daily/src/index.ts`、`tasks/leetcode-daily/src/config.ts`、任务配置/env 处理、`tests/leetcode-daily-*.test.cjs` 下的测试，以及任务文档。
- 影响系统：本地 `data/blog` 生成流程，以及 `scripts/publish-content.mjs` 调用的现有 MinIO 内容发布流程。
- 预计不新增外部上传 API 或依赖。
