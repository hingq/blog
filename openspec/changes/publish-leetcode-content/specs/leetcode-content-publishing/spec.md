## ADDED Requirements

### Requirement: 发布生成的 LeetCode 内容
LeetCode 每日任务 SHALL 在成功写入 LeetCode MDX 文章后，通过可用的内容发布脚本发布生成的博客内容。

#### Scenario: 生成文章后发布
- **WHEN** LeetCode 每日任务把博客文章写入 `data/blog`
- **THEN** 任务执行内容发布脚本
- **THEN** 发布脚本输出在 LeetCode 任务日志中可见

#### Scenario: 开发环境使用源码发布脚本
- **WHEN** LeetCode 每日任务在源码项目中运行
- **THEN** 任务执行项目根目录下的 `scripts/publish-content.mjs`
- **THEN** 发布脚本从项目根目录读取博客内容

#### Scenario: 生产环境使用打包发布脚本
- **WHEN** LeetCode 每日任务从 `tasks/dist` 生产包运行
- **THEN** 任务执行 `tasks/dist/scripts/publish-content.mjs`
- **THEN** 发布脚本仍从任务项目根目录读取博客内容

#### Scenario: 写入文章前拉取或渲染失败
- **WHEN** LeetCode 每日任务在写入博客文章前失败
- **THEN** 任务 MUST NOT 执行 `./scripts/publish-content.mjs`

### Requirement: 发布脚本随生产包打包
任务构建流程 SHALL 把内容发布脚本及其本地脚本依赖包含在生产任务包中。

#### Scenario: 构建生产任务包
- **WHEN** 执行任务构建命令
- **THEN** `tasks/dist/scripts/publish-content.mjs` 存在
- **THEN** `tasks/dist/scripts/blog-utils.mjs` 存在

#### Scenario: 打包发布脚本解析内容根目录
- **WHEN** `tasks/dist/scripts/publish-content.mjs` 在生产环境运行
- **THEN** 发布流程从任务项目根目录解析 `data/blog`
- **THEN** 发布流程从任务项目根目录解析 `data/siteMetadata.js`

### Requirement: 环境变量文件路径可配置
LeetCode 每日任务 SHALL 支持通过 `config.json` 的任务环境配置指定环境变量文件路径，并在未配置时使用默认环境变量文件路径。

#### Scenario: 从 config.json 指定环境变量文件路径
- **WHEN** `config.json` 的 LeetCode job 环境配置包含环境变量文件路径
- **THEN** LeetCode 每日任务按该路径加载环境变量
- **THEN** 内容发布进程继承这些环境变量

#### Scenario: 未指定环境变量文件路径
- **WHEN** `config.json` 的 LeetCode job 环境配置未包含环境变量文件路径
- **THEN** LeetCode 每日任务加载项目根目录 `.env`
- **THEN** 内容发布进程继承默认 `.env` 中的环境变量

### Requirement: 可关闭发布
LeetCode 每日任务 SHALL 支持通过任务环境配置关闭内容发布。

#### Scenario: 发布被关闭
- **WHEN** 任务环境通过配置开关关闭发布
- **THEN** 任务跳过 `./scripts/publish-content.mjs`
- **THEN** 任务日志说明内容发布已跳过

### Requirement: 发布失败导致任务失败
LeetCode 每日任务 SHALL 将内容发布失败视为任务失败。

#### Scenario: 发布脚本异常退出
- **WHEN** 内容发布脚本以非零状态退出或无法启动
- **THEN** LeetCode 每日任务以失败状态退出
- **THEN** 失败信息明确指出失败步骤是内容发布

#### Scenario: 发布成功
- **WHEN** 内容发布脚本成功退出
- **THEN** LeetCode 每日任务继续执行剩余配置步骤
