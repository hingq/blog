## 1. 发布 Helper

- [x] 1.1 更新 LeetCode 每日任务的 dotenv 加载逻辑，支持从 `config.json` 的 job `env` 读取环境变量文件路径，未配置时默认加载项目根目录 `.env`。
- [x] 1.2 添加 LeetCode 每日发布 helper，开发环境执行项目根目录 `scripts/publish-content.mjs`，生产包环境执行 `tasks/dist/scripts/publish-content.mjs`。
- [x] 1.3 确保发布 helper 以任务项目根目录作为 `cwd`，并向发布子进程传入/继承已加载的环境变量。
- [x] 1.4 添加环境变量开关解析，默认启用发布，并在配置为关闭时跳过发布。
- [x] 1.5 确保发布开始、跳过、成功和失败信息都会写入任务日志。

## 2. 生产包构建

- [x] 2.1 更新 `tasks/build.mjs`，构建时复制 `scripts/publish-content.mjs` 到 `tasks/dist/scripts/publish-content.mjs`。
- [x] 2.2 更新 `tasks/build.mjs`，构建时复制 `scripts/blog-utils.mjs` 到 `tasks/dist/scripts/blog-utils.mjs`。
- [x] 2.3 更新发布脚本/`blog-utils.mjs` 的项目根目录解析，支持生产包脚本从任务项目根目录读取 `data/blog` 和 `data/siteMetadata.js`。

## 3. 任务集成

- [x] 3.1 在 `writeBlogPost()` 成功后、可选邮件通知前调用发布 helper。
- [x] 3.2 确保发布失败会让 `runLeetcodeDaily()` reject，并产出明确指向内容发布的错误信息。
- [x] 3.3 确保文章生成前的失败不会调用发布脚本。

## 4. Tests

- [x] 4.1 为环境变量文件路径解析添加单元测试，覆盖 config 指定路径和默认 `.env` 路径。
- [x] 4.2 为发布开关解析和跳过发布行为添加单元测试。
- [x] 4.3 添加测试覆盖：开发环境发布时会以项目根目录作为 `cwd` 调用源码 `scripts/publish-content.mjs`。
- [x] 4.4 添加测试覆盖：生产包发布时会调用 `tasks/dist/scripts/publish-content.mjs`，并仍以项目根目录作为内容根目录。
- [x] 4.5 添加构建测试或断言，确认 `yarn tasks:build` 后 `tasks/dist/scripts/publish-content.mjs` 和 `tasks/dist/scripts/blog-utils.mjs` 存在。
- [x] 4.6 添加测试覆盖：发布脚本失败时，LeetCode 每日任务或 helper 会以清晰错误失败。
- [x] 4.7 运行 `yarn test:tasks` 并修复回归。

## 5. 文档

- [x] 5.1 更新 `tasks/README.md`，说明 LeetCode 文章生成后会自动发布。
- [x] 5.2 记录生产包会包含 `tasks/dist/scripts/publish-content.mjs` 及其本地依赖，生产运行不依赖源码目录 `scripts/`。
- [x] 5.3 记录如何在 `config.json` 的 job `env` 中配置环境变量文件路径，以及未配置时的默认 `.env` 行为。
- [x] 5.4 记录发布关闭开关，以及 `scripts/publish-content.mjs` 所需的 MinIO 环境变量。
