# 证据索引与研究边界

核对日期：2026-10-17。固定版本来自 [SOURCES.json](../SOURCES.json)。本地链接便于阅读，固定提交链接用于之后复核。

本轮以官方材料初查和少量源码入口为主。README 证明项目如何描述自身；内部执行细节还需要沿真实调用链继续核对。本文没有运行跨项目评测。

## P01 Pi 的默认取向

材料支持：项目自述为可扩展的极简运行系统；计划模式、子 Agent 等做法可由扩展补充。本文没有据此推断它无法实现这些能力，也没有推断性能高低。

- [Pi coding-agent README](../pi/packages/coding-agent/README.md) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/README.md)

## P02 Pi 的会话与压缩

材料支持：运行系统组织模型、工具、上下文和会话；活动分支提供历史，压缩以摘要替代后续请求中的部分历史，原始条目仍保留；Skill 完整说明按需加载。未实测压缩后的信息保留率。

- [运行过程](../pi/packages/coding-agent/docs/how-pi-works.md) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/docs/how-pi-works.md)
- [会话与上下文](../pi/packages/coding-agent/docs/sessions.md) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/docs/sessions.md)
- [压缩机制](../pi/packages/coding-agent/docs/compaction.md) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/docs/compaction.md)

## P03 Pi 的工具扩展

材料支持：扩展可以注册工具与 MCP 服务端，现有文档也描述 MCP 连接机制。不能把较早版本“没有内置 MCP”的说法移用到这份快照。本文不宣称已覆盖所有工具暴露模式。

- [扩展](../pi/packages/coding-agent/docs/extensions.md) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/docs/extensions.md)
- [MCP](../pi/packages/coding-agent/docs/mcp.md) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/docs/mcp.md)

## L01 LangGraph 的执行状态

材料支持：项目关注长期、有状态的执行；检查点表示执行状态，Store 提供跨线程与会话的长期存储接口。本文没有声称检查点能自动撤销外部副作用。

- [项目说明](../langgraph/README.md) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/README.md)
- [检查点定义](../langgraph/libs/checkpoint/langgraph/checkpoint/base/__init__.py) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/checkpoint/base/__init__.py)
- [长期存储定义](../langgraph/libs/checkpoint/langgraph/store/base/__init__.py) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/store/base/__init__.py)

## L02 LangChain 生态层次

材料支持：Deep Agents 文档明确描述 LangGraph、LangChain agent 构建机制与 Deep Agents 的层次，并列出文件系统、子 Agent、上下文管理、记忆、Skills 与 MCP 工具等机制。默认项、可选后端与应用配置仍需进一步逐项核对。

- [Deep Agents 说明与 FAQ](../deepagents/libs/deepagents/README.md) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/README.md)
- [LangChain 项目说明](../langchain/README.md) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/README.md)

## M01 OpenClaw 的文件记忆

材料支持：工作区 Markdown 持久信息，USER.md、MEMORY.md 与日记记录的职责，启动加载、检索与预算处理。本文没有将存储格式等同于记忆效果。

- [记忆设计](../openclaw/docs/concepts/memory.md) · [固定提交](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/docs/concepts/memory.md)

## M02 Hermes 的记忆与历史

材料支持：有界记忆、会话开始时的冻结快照、通过工具写入和历史搜索，以及项目描述的技能积累方向。没有把自我改进的宣传用语当作模型权重更新或成功率提升的实验证明。

- [记忆机制](../hermes-agent/website/docs/user-guide/features/memory.md) · [固定提交](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/website/docs/user-guide/features/memory.md)
- [项目说明](../hermes-agent/README.md) · [固定提交](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/README.md)

## T01 smolagents 的代码行动

材料支持：CodeAgent 用代码表达动作，并讨论受约束的执行环境。本文只比较动作表达方式，没有将其等同于编程任务，也没有据此宣称普遍更快。

- [项目说明](../smolagents/README.md) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/README.md)

## C01 Codex 的工具执行边界

材料支持：工具运行支撑中存在审批与沙箱相关机制，执行策略另有实现。本文只核对局部入口，不声称所有策略组合或所有平台均已验证。

- [审批与沙箱的共享支撑](../codex/codex-rs/core/src/tools/sandboxing.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/sandboxing.rs)
- [执行策略](../codex/codex-rs/core/src/exec_policy.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/exec_policy.rs)
- [仓库中的文档入口](../codex/docs/sandbox.md) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/docs/sandbox.md)

## S01 CrewAI 的协作与流程

材料支持：项目材料区分 Crews 与 Flows。本文用其提出角色协作与流程控制的比较问题，没有运行或测量多 Agent 的收益。

- [项目说明](../crewai/README.md) · [固定提交](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/README.md)

## S02 OpenAI Agents SDK 的协作概念

材料支持：项目材料同时列出 agents-as-tools 与 handoffs，以及会话、追踪与人工介入等概念。本文没有枚举或评测其全部运行入口。

- [项目说明](../openai-agents-python/README.md) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/README.md)

## X01 材料迁移与实际范围

材料支持：Letta 当前主分支说明实际开发代码位于 letta-ai/letta-code，旧 V1 服务端位于 archive 分支。本轮下载的 letta/ 不能直接当作完整当前记忆实现来分析；新的实现仓库尚未收录。

- [Letta 入口说明](../letta/README.md) · [固定提交](https://github.com/letta-ai/letta/blob/5bcdd177d70fa2b31a754cfcd801e77b2e1ab16a/README.md)

## X02 OpenHands 的当前仓库定位

材料支持：当前 README 将本仓库介绍为 Agent Canvas，可运行多种 Agent 后端。本书将其作为开发任务执行与管理材料，不把界面仓库直接等同于所有后端的执行内核。

- [OpenHands 入口说明](../openhands/README.md) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/README.md)

## 在线一手资料

以下网页于 2026-10-17 查询。网页可能更新；工具规范链接明确指向 2025-11-25 版本，只用于解释本书涉及的工具路径，不宣称这是所有版本的完整接口。

- [ReAct 原始论文](https://arxiv.org/abs/2210.03629)：推理与行动交替组织的研究来源。
- [MCP 架构](https://modelcontextprotocol.io/docs/learn/architecture)：宿主、客户端与服务端的关系。
- [MCP 工具规范（2025-11-25）](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)：工具发现、调用与输入结果结构。
- [LangGraph 持久化](https://docs.langchain.com/oss/python/langgraph/persistence)：检查点与执行恢复的官方说明。
- [LangChain 记忆概述](https://docs.langchain.com/oss/python/concepts/memory)：短期与长期信息的官方概念说明。
- [OpenAI 官方安全文档](https://learn.chatgpt.com/docs/security)：原 Codex security 链接重定向到的当前页面；本文的具体实现论断仍以 C01 固定源码为准。

## 下一轮研究应当产生什么

逐项目追踪一次模型请求到工具结果返回的过程，确认默认值、可选配置与扩展边界；随后按第十一章运行包含故障注入的实验。新结论应记录版本、配置和轨迹，并修改对应主题章节。

[返回全书目录](../book/README.md)
