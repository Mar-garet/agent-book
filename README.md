<p align="center">
  <img src="docs/assets/agent-book-logo.png" alt="Agent Book Logo" width="160">
</p>

<h1 align="center">Agent Book</h1>

<p align="center"><strong>从开源实现理解 AI Agent 的工作方式与设计取舍</strong></p>

<p align="center">
  <a href="https://mar-garet.github.io/agent_book/?read=book%2F00-do-you-really-understand-agents">开始阅读 →</a> ·
  <a href="book/README.md">全书目录</a> ·
  <a href="references/studies/README.md">源码研究</a>
</p>

## 这本书在讲什么

一个 Agent 收到任务之后，怎样决定下一步、调用工具、根据结果继续行动，直到完成工作？任务中途失败、上下文装不下、需要其他 Agent 接手时，系统又该怎么办？

**Agent Book 是一本从零到深入理解 AI Agent 的开源中文书**。它从这些具体问题出发，解释模型、工具和运行系统如何配合，以及不同设计在能力、成本与可靠性之间的取舍。

贯穿全书的是四个问题：**谁决定下一步，谁执行行动，谁保存状态，谁检查结果？**

## 适合谁读

- **刚接触 Agent 的读者**：建立模型、工具、上下文和记忆之间的关系，理解 Agent 为什么能持续行动。
- **正在使用 Agent 的开发者**：理解工具失败、摘要丢失信息、恢复后重复执行等现象，判断能力和限制来自哪里。
- **准备构建 Agent 系统的工程师**：思考如何安排规划与协作、控制权限和预算，以及怎样验收任务结果。

## 你会读到什么

### 从一次回答，到一个行动循环

先分清模型与运行系统的职责，再追踪一次完整的“观察 → 决定 → 行动 → 反馈”。理解是谁让任务继续，又是谁让它停下来。

### 从调用工具，到组织知识与分工

工具调用与 MCP 解决系统怎样接触外部世界；上下文与记忆决定模型此刻能看见什么；规划、Skills 和多 Agent 协作则决定经验与分工怎样进入执行过程。

### 从演示成功，到长期可靠地工作

沿取消与审批、错误与重试、中断与恢复、摘要与交接等问题深入，理解副作用、信任边界和资源预算，最后回到任务验收与评测：怎样证明 Agent 真的完成了工作？

## 这本书怎样展开

书中用一个逐渐复杂的任务情境串起概念，再以 Pi、Codex、LangGraph、Deep Agents、Hermes、OpenClaw 等开源项目的具体实现解释机制。案例围绕问题组织，源码用于核对论断，实验用于观察执行行为。

**源码事实、设计推断和实验结果分别说明**。每项项目研究保留固定版本与来源，便于读者继续追查。

## 从哪里开始

第一次接触 Agent，建议从[开篇：你真的懂 Agent 吗？](book/00-do-you-really-understand-agents.md)顺序阅读。已有使用经验，可以通过[全书目录](book/README.md)选择关心的问题，或先读[项目比较](book/10-project-comparisons.md)，再回到具体机制。

想继续核对实现和实验，可以查看[源码研究记录](references/studies/README.md)、[机制实验与复现](experiments/README.md)和[上游项目及版本](docs/source-catalog.md)。
