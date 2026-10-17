# 源码研究：一条设计判断从哪里来

正文解释问题，研究记录保留调用过程、配置条件和引用来源。项目研究采用 [SOURCES.json](../../SOURCES.json) 固定的本地快照，核对日期为 2026-10-17；评测研究另外引用原始论文与历史实现，没有把后来榜单当作原始论文的结论。

阅读实现和上游测试，可以确认程序写下的约定；实际运行能观察特定环境中的行为。每份记录分别说明采用了哪种方法，以及仍需验证的范围。

## 动作、状态与工具

- [Pi 与 Deep Agents 的执行过程](pi-deepagents-execution.md)：一批工具怎样准备、执行和反馈，默认能力怎样装配，子任务继承哪些状态。对应 [可靠执行系统](../../book/12-action-boundaries.md) 与 [上下文系统](../../book/13-context-and-defaults.md)。
- [Codex 的工具执行](codex-tool-execution.md)：命令与 MCP 两类路径上的策略、审批、隔离、重试与结果。对应 [可靠执行系统](../../book/12-action-boundaries.md)。
- [LangGraph 的中断与恢复](langgraph-interrupt-resume.md)：节点重入、检查点和外部动作为什么可能不同步。对应 [执行恢复专题](../../book/14-resume-and-side-effects.md)，附四个实际运行场景。
- [工具结果、异常与批次重试](tool-results-and-retries.md)：谁把异常改成消息，谁重试整个节点，已经成功的动作为什么也会重做。对应 [工具结果与重试](../../book/17-tool-results-and-retries.md)。

## 上下文、记忆与信任

- [上下文系统补充](context-system-design.md)：Deep Agents 结果外置的写入条件、失败回退与 Codex 模型输出表示，支持上下文系统主章的设计比较。

- [Hermes 与 OpenClaw 的记忆更新](openclaw-hermes-memory.md)：持久文件、运行缓存、索引与实际请求怎样衔接。对应 [记忆系统](../../book/15-memory-update-boundaries.md)。
- [Goose 与 Cline SDK 的 MCP 宿主](goose-cline-mcp.md)：工具发现、身份、目录更新、审批与输出处理。对应 [工具与 MCP 系统](../../book/16-mcp-host-differences.md)。
- [Pi 与 Hermes 的上下文压缩](context-compaction.md)：切点、摘要输入、原始记录与刷新边界，附 Pi 真实序列化函数的本地观察。对应 [上下文压缩](../../book/18-context-compaction.md)。
- [工具内容与信任边界](trust-and-tool-content.md)：MCP 注解、Codex 目录快照和 Cline 临时结果缓存各自保证什么。对应 [信任边界](../../book/20-trust-boundaries.md)。

## 分工、预算与验收

- [委派与交接](delegation-and-handoffs.md)：OpenAI Agents SDK 与 Deep Agents 怎样转移控制、传递输入并返回结果。对应 [协作系统](../../book/19-delegation-and-handoffs.md)。
- [执行预算](execution-budgets.md)：SDK 轮数、子运行、提供方重试、图步数与并发上限分别在哪里计数。对应 [执行预算](../../book/21-execution-budgets.md)。
- [任务验收与评测](evaluation-and-evidence.md)：原始 SWE-bench 与 τ-bench 怎样判断完成，结果检查与过程要求为什么需要分别考虑。对应 [评测系统](../../book/22-evaluation-and-completion.md)。

## 哪些已经运行

[实验目录](../../experiments/README.md) 收录五组、共 31 个确定性场景：LangGraph 中断恢复 4 个、工具错误与图步数 9 个、SDK 委派预算 5 个、Pi 摘要前裁剪 4 个，以及应用离线验收 9 个。

这些场景没有调用外网模型或真实业务服务。SDK 使用预编排模型响应，离线验收使用人工构造的样例；后者检查本书的应用规则，不是任何框架的默认能力。源码笔记中保留的补充实验方案与已运行脚本分别标明。

上游测试没有在本轮执行。本书也没有运行 SWE-bench、τ-bench 或跨项目任务评测，因此这些记录不提供模型成功率、性能或整体安全性排名。

## 维护记录

先限定入口、配置和任务，再沿调用过程找实际输入、动作、状态交付与错误。遇到概括与实现不符时，修改对应章节并说明准确条件。

维护者可运行 [书稿校验脚本](../../scripts/check_book.py)，检查链接、引用行号、固定版本与实验脚本摘要。脚本检查资料之间的一致性，论断仍需对照原文判断。

[返回参考资料](../evidence.md) · [返回全书目录](../../book/README.md)
