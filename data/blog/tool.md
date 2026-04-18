---
title: Claude Code 的 Agent 主循环：事件流、消息模型与工具执行机制
date: '2026-04-10'
tags: ['Agent', '架构学习']
draft: true
summary: 'Claude code 基本原理'
---

# 工具系统

## 工具定义协议

Claude Code 的每个工具都遵循一个统一的类型契约 -- `Tool<Input, Output, Progress>`。

这个协议的设计哲学可以用"接口即架构"来概括：通过定义严格的类型接口，工具系统的所有架构约束——权限检查、并发控制、进度报告、UI 渲染——都被编译器强制执行。

### 核心类型：Tool、Tools、ToolDef、buildTool

`Tool` 类型是一个泛型接口，接受三个类型参数：

- `Input extends AnyObject`：使用 Zod schema 定义的工具输入类型，确保每个工具的输入都是一个结构化对象。
- `Output`：工具的输出类型，自由定义。
- `P extends ToolProgressData`：工具的进度数据类型，用于流式反馈。

三个泛型参数的分离是一个深思熟虑的设计决策。如果将输入和输出类型合并为一个，工具的签名将变得更难阅读；如果省略进度类型，工具就无法在执行过程中提供实时反馈。三者分离使得每个关注点都有独立的类型空间，编译器可以分别检查。

工具必须实现的五要素如下
