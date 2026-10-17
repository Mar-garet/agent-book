# Agent Book：你真的懂 Agent 吗？

让一个模型调用工具很容易。让一个系统知道该做什么、依据什么行动、何时停下，以及失败后如何继续，是另一组问题。

这本书从零开始，沿着这些问题走向 Agent 的设计深处。我们用不同开源项目的选择来检验理解：同一个困难，为什么有人选择极简循环，有人选择状态图，有人把经验写进文件，有人把协作组织成多个 Agent？

**思想是主线，项目是案例，源码是证据。**

[![Agent Book 阅读界面：纸白排版、章节目录与封面插图](docs/assets/reader-desktop.webp)](website/README.md)

[打开阅读界面](website/README.md) · [从开篇开始阅读](book/00-do-you-really-understand-agents.md) · [全书目录](book/README.md) · [开源项目地图](book/10-project-comparisons.md) · [32 个源码仓库](docs/source-catalog.md)

阅读界面提供全文搜索、章节导航、项目筛选、深浅主题和字号调节。正文仍在本仓库的 Markdown 中维护。启动方式与界面预览见 [阅读界面说明](website/README.md)。

## 读完后应当能够回答

- 模型、Agent、工具和运行系统分别负责什么？
- 工具调用、MCP、Skills 和多 Agent 为什么经常被混为一谈？
- 上下文、检查点、长期记忆、检索和学习分别改变了什么？
- 为什么计划会失效，自动重试会放大错误，更多 Agent 也可能更差？
- 如何公平比较 Pi、Codex、LangChain、LangGraph、Deep Agents 等不同层次的项目？
- 怎样为一个真实任务设计能验证、能恢复、能明确停下的系统？

## 这份书稿的状态

当前有 17 篇正文：从概念、原理和横向比较，走到工具调度、上下文装配、恢复副作用、记忆更新与 MCP 宿主差异。第二轮补充了 5 份固定源码研究记录，并实际运行了 LangGraph 中断与恢复的 4 个受控场景。

可以从 [为什么恢复后会再做一遍](book/14-resume-and-side-effects.md) 看一个具体问题如何贯穿框架与业务设计；也可以直接检查 [实验与原始结果](experiments/README.md)。32 个仓库已经下载，不代表已经逐一完成源码分析或运行评测。

书中明确区分“材料支持的事实”“作者的设计推断”和“实验观察”。当前实验检验局部执行机制，尚未测量跨项目任务成功率、性能或成本。阅读路径和证据覆盖范围见 [全书目录](book/README.md)、[源码研究](references/studies/README.md) 与 [证据索引](references/evidence.md)。

## 源码怎样与书稿一起保存

本仓库管理书稿、研究记录和上游版本索引。根目录的 32 个开源项目作为 Git 子模块登记，主仓库记录它们的来源与固定提交，不复制它们的完整历史。

已经在本机下载的源码可以直接阅读。以后克隆本书时，可按需要下载案例：

```bash
git clone https://github.com/Mar-garet/agent_book.git
cd agent_book
git submodule update --init --depth 1 pi langchain langgraph codex
```

需要全部案例时运行 `git submodule update --init --recursive --depth 1`。各项目的快照与许可证入口见 [源码目录](docs/source-catalog.md)，精确提交见 [SOURCES.json](SOURCES.json)。

书稿写作方法见 [写作与研究约定](docs/editorial-guide.md)。
