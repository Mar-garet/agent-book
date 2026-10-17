# Agent Book：你真的懂 Agent 吗？

让一个模型调用工具很容易。让一个系统知道该做什么、依据什么行动、何时停下，以及失败后如何继续，是另一组问题。

这本书从零开始，沿着这些问题走向 Agent 的设计深处。我们用不同开源项目的选择来检验理解：同一个困难，为什么有人选择极简循环，有人选择状态图，有人把经验写进文件，有人把协作组织成多个 Agent？

**思想是主线，项目是案例，源码是证据。**

[从开篇开始阅读](book/00-do-you-really-understand-agents.md) · [全书目录](book/README.md) · [开源项目地图](book/10-project-comparisons.md) · [32 个源码仓库](docs/source-catalog.md)

## 读完后应当能够回答

- 模型、Agent、工具和运行系统分别负责什么？
- 工具调用、MCP、Skills 和多 Agent 为什么经常被混为一谈？
- 上下文、检查点、长期记忆、检索和学习分别改变了什么？
- 为什么计划会失效，自动重试会放大错误，更多 Agent 也可能更差？
- 如何公平比较 Pi、Codex、LangChain、LangGraph、Deep Agents 等不同层次的项目？
- 怎样为一个真实任务设计能验证、能恢复、能明确停下的系统？

## 这份书稿的状态

当前是第一轮概念书稿，包含开篇、原理章节、横向比较和可执行的研究练习。所有章节均有正文；项目级结论限定在已经核对的材料范围内。32 个仓库已经下载，不代表已经逐一完成源码分析或运行评测。

书中明确区分“材料支持的事实”“作者的设计推断”和“尚待实验验证的假设”。比较不提供未经测试的性能排名。阅读路径和本轮证据覆盖范围见 [全书目录](book/README.md) 与 [证据索引](references/evidence.md)。

## 源码怎样与书稿一起保存

本仓库管理书稿、研究记录和上游版本索引。根目录的 32 个开源项目作为 Git 子模块登记，主仓库记录它们的来源与固定提交，不复制它们的完整历史。

已经在本机下载的源码可以直接阅读。以后克隆本书时，可按需要下载案例：

```bash
git clone <本书仓库地址>
cd <本书目录>
git submodule update --init --depth 1 pi langchain langgraph codex
```

需要全部案例时运行 `git submodule update --init --recursive --depth 1`。各项目的快照与许可证入口见 [源码目录](docs/source-catalog.md)，精确提交见 [SOURCES.json](SOURCES.json)。

书稿写作方法见 [写作与研究约定](docs/editorial-guide.md)。
