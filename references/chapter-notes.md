# 章节参考资料

这里集中保留项目核查和延伸资料。正文中的机制与设计讨论可独立阅读。

## 00-do-you-really-understand-agents

开篇：你真的懂 Agent 吗？

- [项目资料](evidence.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 01-model-agent-and-harness

第一章：模型之外，谁让事情继续发生？

- [参考 L02](evidence.md#l02-langchain-生态层次)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 02-the-agent-loop

第二章：从一次回答，到一个行动循环

- [参考 L01](evidence.md#l01-langgraph-的执行状态)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 03-tool-calling

第三章：工具调用——一次请求，几层责任

- [参考 T01](evidence.md#t01-smolagents-的代码行动)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 04-mcp

第四章：MCP——把连接标准化之后，问题还剩什么？

- [MCP 官方架构](https://modelcontextprotocol.io/docs/learn/architecture)
- [工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- [参考 P03](evidence.md#p03-pi-的工具扩展)
- [参考 L02](evidence.md#l02-langchain-生态层次)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 05-context

第五章：上下文——Agent 此刻究竟看见了什么？

- [参考 P02](evidence.md#p02-pi-的会话与压缩)
- [参考 L02](evidence.md#l02-langchain-生态层次)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 06-memory

第六章：记忆——存下来之后，怎样影响下一次行动？

- [参考 M01](evidence.md#m01-openclaw-的文件记忆)
- [参考 M02](evidence.md#m02-hermes-的记忆与历史)
- [进一步研究](studies/openclaw-hermes-memory.md)
- [参考 L01](evidence.md#l01-langgraph-的执行状态)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 07-planning-and-methods

第七章：规划与方法——下一步由谁决定？

- [原始论文](https://arxiv.org/abs/2210.03629)
- [参考 L01](evidence.md#l01-langgraph-的执行状态)
- [参考 P01](evidence.md#p01-pi-的默认取向)
- [参考 L02](evidence.md#l02-langchain-生态层次)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 08-skills-and-multi-agent

第八章：Skills 与多 Agent——经验和分工怎样进入系统？

- [参考 P02](evidence.md#p02-pi-的会话与压缩)
- [参考 M02](evidence.md#m02-hermes-的记忆与历史)
- [参考 S02](evidence.md#s02-openai-agents-sdk-的协作概念)
- [参考 S01](evidence.md#s01-crewai-的协作与流程)
- [参考 L02](evidence.md#l02-langchain-生态层次)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 09-reliability

第九章：可靠性——什么时候可以相信它完成了？

- [参考 C01](evidence.md#c01-codex-的工具执行边界)
- [持久化说明](https://docs.langchain.com/oss/python/langgraph/persistence)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 10-project-comparisons

第十章：把项目放在同一张问题地图上

- [研究记录](studies/README.md)
- [实验目录](../experiments/README.md)
- [层次说明](evidence.md#l02-langchain-生态层次)
- [Pi 的项目说明与范围](evidence.md#p01-pi-的默认取向)
- [默认装配研究](studies/pi-deepagents-execution.md)
- [执行与文件修改研究](studies/pi-deepagents-execution.md)
- [执行状态与范围](evidence.md#l01-langgraph-的执行状态)
- [层次依据](evidence.md#l02-langchain-生态层次)
- [OpenClaw](evidence.md#m01-openclaw-的文件记忆)
- [Hermes](evidence.md#m02-hermes-的记忆与历史)
- [LangGraph](evidence.md#l01-langgraph-的执行状态)
- [项目材料](evidence.md#t01-smolagents-的代码行动)
- [Codex 执行研究](studies/codex-tool-execution.md)
- [Pi 执行研究](studies/pi-deepagents-execution.md)
- [宿主研究](studies/goose-cline-mcp.md)
- [32 个项目的研究地图](project-map.md)
- [源码目录](../docs/source-catalog.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 11-design-and-experiments

第十一章：从一个演示，到一个能长期工作的系统

- [实验目录](../experiments/README.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 12-action-boundaries

可靠执行系统：让动作可控、过程可恢复、结果可核查

- [本地执行研究](studies/pi-deepagents-execution.md)
- [固定核心源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts)
- [本地执行研究](studies/codex-tool-execution.md)
- [固定命令适配源码](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/unified_exec.rs)
- [本地恢复研究](studies/langgraph-interrupt-resume.md)
- [固定执行入口](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py)
- [Pi 执行研究](studies/pi-deepagents-execution.md)
- [文件修改机制比较](studies/pi-deepagents-execution.md)
- [Codex 执行研究](studies/codex-tool-execution.md)
- [运行记录与边界](../experiments/README.md#中断与恢复)
- [本地源码研究](studies/langgraph-interrupt-resume.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 13-context-and-defaults

上下文系统：让下一步判断拿到合适的依据

- pi：[本地执行边界研究：Pi 调用链与会话树](studies/pi-deepagents-execution.md) · [固定源码：核心请求准备](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L175-L242) · [固定源码：会话投影](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L468-L582)。
- projection：[本地投影与扩展研究](studies/pi-deepagents-execution.md) · [固定源码：扩展克隆](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/extensions/runner.ts#L1301-L1365)。
- assembly：[本地默认装配研究](studies/pi-deepagents-execution.md) · [固定源码：主栈装配](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L893-L975)。
- memory：[本地 memory 与 skills 研究](studies/pi-deepagents-execution.md) · [固定源码：memory 缓存](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/memory.py#L279-L383) · [固定源码：skills 固定加载](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/skills.py#L1260-L1280)。
- backend：[本地后端与保存范围研究](studies/pi-deepagents-execution.md) · [固定源码：默认后端](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L658) · [固定源码：检查点与 store 传递](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L995-L1007)。
- codex：[本地 Codex 工具执行研究](studies/codex-tool-execution.md) · [固定源码：MCP 结果预算转换](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/context.rs#L157-L213)。
- offload：[本地本章补充：大结果外置](studies/context-system-design.md) · [固定源码：条件与外置处理](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3500-L3569) · [固定源码：工具排除与返回路径](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3835-L3850)。
- repair：[本地协议修补研究](studies/pi-deepagents-execution.md) · [固定源码：修补未闭合调用](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/patch_tool_calls.py#L17-L52)。
- [执行边界研究](studies/pi-deepagents-execution.md)
- [本章源码补充](studies/context-system-design.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 14-resume-and-side-effects

从断点继续，为什么会再做一遍？

- [源码研究记录](studies/langgraph-interrupt-resume.md)
- [中断定义](studies/langgraph-interrupt-resume.md#节点会重新执行)
- [原始结果](../experiments/results/langgraph-interrupt-replay.json)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 15-memory-update-boundaries

记忆系统：从项目比较到写入、检索与更新

- [本地研究记录](studies/openclaw-hermes-memory.md)
- [Hermes e31c674](https://github.com/NousResearch/hermes-agent/tree/e31c674f7c523070f48f3baad0650c2fdd7ef6e5)
- [OpenClaw ec38f53](https://github.com/openclaw/openclaw/tree/ec38f535d3d5de9e087d834fe58e6190852fcb2a)
- [本地 Store 定义](../langgraph/libs/checkpoint/langgraph/store/base/__init__.py)
- [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/store/base/__init__.py)
- [本地检查点定义](../langgraph/libs/checkpoint/langgraph/checkpoint/base/__init__.py)
- [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/checkpoint/base/__init__.py)
- [本地方法定义](../langgraph/libs/checkpoint/langgraph/store/base/__init__.py#L756-L905)
- [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/store/base/__init__.py#L756-L905)
- [实现依据](studies/openclaw-hermes-memory.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 16-mcp-host-differences

工具与 MCP 系统：怎样让 Agent 可靠地接触外部世界？

- identity：[本地 Goose 目录映射](../goose/crates/goose/src/agents/extension_manager/lease.rs#L118-L166) · [固定源码](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/lease.rs#L118-L166)；[本地 Cline 转换](../cline/sdk/packages/core/src/extensions/mcp/tools.ts#L16-L48) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/tools.ts#L16-L48)。名称规范化定位见 [研究记录第 6 节](studies/goose-cline-mcp.md#6-cline-sdk-为每个服务工具建立一个独立模型入口)。
- discovery：[本地 Goose 工具准备](../goose/crates/goose/src/agents/reply_parts.rs#L184-L219) · [固定源码](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/reply_parts.rs#L184-L219)；[本地 Cline 模型请求](../cline/sdk/packages/agents/src/agent-runtime.ts#L1670-L1712) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L1670-L1712)。
- large：[本地 Goose 大结果处理](../goose/crates/goose/src/agents/large_response_handler.rs#L5-L76) · [固定源码](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/large_response_handler.rs#L5-L76)；[本地 Cline 结果缓存](../cline/sdk/packages/core/src/session/services/tool-result-cache.ts#L17-L83) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L17-L83)。预览与读取链见 [研究记录第 11 节](studies/goose-cline-mcp.md#11-cline-sdk-的过大结果处理使用会话缓存与缩小工具目录分开)。
- approval：[本地 Goose 审批](../goose/crates/goose/src/permission/permission_inspector.rs#L159-L194) · [固定源码](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/permission/permission_inspector.rs#L159-L194)；[本地 Cline 执行政策](../cline/sdk/packages/agents/src/agent-runtime.ts#L2436-L2540) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L2436-L2540)。注解字段边界见 [研究记录第 9 节](studies/goose-cline-mcp.md#9-cline-sdk-的这一转换链未把-mcp-注解带入工具对象)。
- refresh：[本地 Goose 缓存](../goose/crates/goose/src/agents/extension_manager/mod.rs#L269-L298) · [固定源码](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/mod.rs#L269-L298)；[本地 Cline 目录缓存](../cline/sdk/packages/core/src/extensions/mcp/manager.ts#L144-L165) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/manager.ts#L144-L165)。租约与 VSCode 旁证见 [研究记录第 2、12 节](studies/goose-cline-mcp.md)。
- result：[本地 Goose 结果整理](../goose/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L1071-L1105) · [固定源码](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L1071-L1105)；[本地 Cline 返回包装](../cline/sdk/packages/agents/src/agent-runtime.ts#L2554-L2595) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L2554-L2595)。服务业务错误传递的静态推导见 [研究记录第 10 节](studies/goose-cline-mcp.md#10-cline-sdk-区分抛出的调用错误与结果内容里的业务错误)。
- [比较范围与固定版本](studies/goose-cline-mcp.md)
- [本地研究](studies/goose-cline-mcp.md)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 17-tool-results-and-retries

工具返回了，任务为什么还没有完成？

- status：[本地默认状态与结果包装](../langchain/libs/core/langchain_core/tools/base.py#L1084-L1135) · [固定源码](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1084-L1135)；[有无调用编号的返回差异](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1390-L1426)。
- chain：[本地工具节点](../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py#L751-L928) · [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L751-L928)；入口与适配关系详见 [研究记录](studies/tool-results-and-retries.md#先数入口再解释谁调用谁)。
- errors：[本地默认处理器](../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py#L391-L399) · [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L391-L399)；[特殊错误与转换](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L949-L1029)；[未知工具名](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1302-L1313)。
- batch：[本地批次执行与合并](../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py#L827-L895) · [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L827-L895)。
- retry：[本地重试策略](../langgraph/libs/langgraph/langgraph/_internal/_retry.py) · [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/_internal/_retry.py#L1-L28)；节点重入与待交付状态清理见 [重试研究](studies/tool-results-and-retries.md)。
- identity：[本地工具消息定义](../langchain/libs/core/langchain_core/messages/tool.py#L26-L82) · [固定源码](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/messages/tool.py#L26-L82)；业务动作标识与恢复见 [执行恢复专题](../book/14-resume-and-side-effects.md)。
- [固定版本的宿主研究](studies/goose-cline-mcp.md)
- [实际脚本与记录](../experiments/README.md#工具错误批次重试与图步数)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 18-context-compaction

上下文压缩：信息怎样在交接处丢失

- entry：[本地主动入口](../pi/packages/coding-agent/src/core/agent-session.ts#L2779-L2810) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2779-L2810)；[扩展与提交顺序](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2807-L2880)。
- selection：[本地压缩准备](../pi/packages/coding-agent/src/core/compaction/compaction.ts) · [完整研究与切点分析](studies/context-compaction.md)；[默认预算与触发](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L120-L130)。
- truncate：[本地序列化器](../pi/packages/coding-agent/src/core/compaction/utils.ts#L93-L155) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/utils.ts#L93-L155)。
- summary：[本地历史与旧摘要选择](../pi/packages/coding-agent/src/core/compaction/compaction.ts#L867-L899) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L867-L899)；[摘要更新要求](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L540-L579)。
- archive：[本地会话文件路径](../pi/packages/coding-agent/src/core/session-manager.ts#L1156-L1158) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1156-L1158)；[当前分支导出](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-export.ts#L8-L44)；[读取工具自身的限制](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/read.ts#L86-L96)。
- hermes：[本地压缩入口](../hermes-agent/agent/conversation_compression.py#L4045-L4079) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4045-L4079)；[预算推导](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L2749-L2807)。
- refresh：[本地前缀刷新](../hermes-agent/agent/conversation_compression.py#L3081-L3125) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L3081-L3125)；[提交前调用](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4252-L4265)。
- commit：[本地追加与刷新](../pi/packages/coding-agent/src/core/agent-session.ts#L2845-L2880) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2845-L2880)；适用条件见 [压缩研究](studies/context-compaction.md)。
- [本地装配研究](studies/pi-deepagents-execution.md)
- [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/summarization.py#L265-L300)
- [Pi 摘要输入实验](../experiments/README.md#摘要模型读取前的裁剪)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 19-delegation-and-handoffs

协作系统：更多 Agent，怎样共同交付一份结果？

- entry：[本地 SDK 运行入口](../openai-agents-python/src/agents/run.py#L279-L324) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L279-L324)；同步与流式入口及统计范围见[研究记录](studies/delegation-and-handoffs.md#范围与实际入口)。[本地 task 构造](../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L898-L911) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L898-L911)。
- roles：[本地 Agent 工具包装](../openai-agents-python/src/agents/agent.py#L606-L667) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L606-L667)；[本地交接构造](../openai-agents-python/src/agents/handoffs/__init__.py#L267-L381) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/handoffs/__init__.py#L267-L381)。对象职责见[研究记录](studies/delegation-and-handoffs.md#先区分执行者输入与基础设施)。
- input：[本地子输入、上下文与轮数配置](../openai-agents-python/src/agents/agent.py#L721-L789) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L721-L789)；[本地子 Runner 调用](../openai-agents-python/src/agents/agent.py#L1043-L1059) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L1043-L1059)。
- output：[本地子结果提取](../openai-agents-python/src/agents/agent.py#L1062-L1115) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L1062-L1115)；[本地工具后续行为](../openai-agents-python/src/agents/agent.py#L396-L416) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L396-L416)。
- handoff：[本地交接历史处理](../openai-agents-python/src/agents/run_internal/turn_resolution.py#L652-L751) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L652-L751)；[本地切换当前 Agent](../openai-agents-python/src/agents/run.py#L2386-L2408) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L2386-L2408)。服务端历史配置的过滤限制见[研究记录](studies/delegation-and-handoffs.md#交接参数与交接历史是两条通道)。
- deep：[本地子代理模式](../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L84-L101) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L84-L101)；[本地排除规则](../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L404-L434) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L404-L434)；[本地输入与子图调用](../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L804-L911) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L804-L911)；[本地结果与状态更新](../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L747-L787) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L747-L787)。
- budget：[本地 SDK 新运行计数](../openai-agents-python/src/agents/run.py#L834-L848) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L834-L848)；子配置与 Deep Agents 配置传递见前述源码。不同计数器、共享额度的设计与取消覆盖限制见[预算研究](studies/execution-budgets.md)及[协作研究范围](studies/delegation-and-handoffs.md#当前研究能够说明什么)。
- experiment：[实验脚本](../experiments/agents_delegation_budgets.py)与[五场景记录](../experiments/results/agents-delegation-budgets.json)；[本地默认错误文本](../openai-agents-python/src/agents/tool.py#L1997-L2002) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/tool.py#L1997-L2002)。
- [研究记录](studies/delegation-and-handoffs.md)
- [实验目录](../experiments/README.md#委派交接与轮数边界)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 20-trust-boundaries

文档里的一句话，为什么变成了行动指令？

- mcp：[MCP 工具规范，2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool) · [该版架构中的宿主职责](https://modelcontextprotocol.io/specification/2025-11-25/architecture#host)。规范范围与源码观察见 [信任研究](studies/trust-and-tool-content.md)。
- prepare：[本地当前目录准备](../codex/codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs#L567-L610) · [固定源码](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs#L567-L610)；[准备绑定](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/binding.rs#L170-L241)。
- snapshot：[本地目录快照准入](../codex/codex-rs/codex-mcp/src/client_tool_catalog.rs#L234-L333) · [固定源码](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/client_tool_catalog.rs#L234-L333)。
- approval：[本地 MCP 审批](../codex/codex-rs/core/src/mcp_tool_call.rs#L1507-L1615) · [固定源码](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1507-L1615)；[注解判断](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L2535-L2565)；[批准复用键](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1804-L1824)。
- cache：[本地结果处理](../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1161-L1190) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1161-L1190)；[读取入口](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/tools/definitions.ts#L268-L355)。
- cache-read：[本地文本副本表示](../cline/sdk/packages/core/src/session/services/tool-result-cache.ts#L100-L164) · [固定源码](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L100-L164)；[按会话读取](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L59-L72)。
- cache-miss：[本地缓存实现](../cline/sdk/packages/core/src/session/services/tool-result-cache.ts) · [容量、过期与缺失提示的源码研究](studies/trust-and-tool-content.md)。
- [实验范围](../experiments/README.md#产物与过程的离线验收)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 21-execution-budgets

明明限制了步数，为什么还能花掉更多资源？

- sdk：[本地 Runner 入口](../openai-agents-python/src/agents/run.py#L279-L324) · [固定源码](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L279-L324)；[计数与超限检查](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L1597-L1622)。
- nested：[本地子运行上限](../openai-agents-python/src/agents/agent.py#L746-L773) · [固定源码](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L746-L773)；[同一 Runner 内交接](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L2386-L2408)。
- request-retry：[本地模型请求重试循环](../openai-agents-python/src/agents/run_internal/model_retry.py#L597-L681) · [固定源码](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/model_retry.py#L597-L681)。
- graph：[图调度、节点与入口的研究](studies/execution-budgets.md#范围与实际入口)；[本地图循环](../langgraph/libs/langgraph/langgraph/pregel/_loop.py#L1879-L1881) · [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L1879-L1881)。
- graph-exp：[实际工具与步数记录](../experiments/results/langgraph-tool-boundaries.json) · [可复现实验脚本](../experiments/langgraph_tool_boundaries.py)。
- concurrency：[本地同步与异步工具批次](../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py#L827-L868) · [固定源码](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L827-L868)；[同步执行器配置](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/runnables/config.py#L660-L675)。
- resume：[本地 SDK 恢复的上限](../openai-agents-python/src/agents/run.py#L678-L697) · [固定源码](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L678-L697)；[恢复的当前轮数](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L813-L833)；[图停止位置的计算](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L1879-L1881)。更完整条件见 [预算研究](studies/execution-budgets.md)。
- [五场景实验](../experiments/README.md#委派交接与轮数边界)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

## 22-evaluation-and-completion

评测系统：让任务完成成为可复核的结论

- bench：[SWE-bench 原始论文 v1](https://arxiv.org/abs/2310.06770v1) · [固定历史判定代码](https://github.com/SWE-bench/SWE-bench/blob/b8299951846f4b6ef23176f8c137cffda79bc747/metrics/metrics.py#L78-L95)；[τ-bench 原始论文 v1](https://arxiv.org/abs/2406.12045v1) · [固定历史状态与回复检查](https://github.com/sierra-research/tau-bench/blob/6f4b718037db619539b8b692060e6686f3f0dcc9/tau_bench/envs/base.py#L107-L149)。
- repeat：[τ-bench 原始论文 v1](https://arxiv.org/pdf/2406.12045v1#page=4)；定义与适用条件详见 [评测研究](studies/evaluation-and-evidence.md)。
- [Pi 输入实验](../experiments/README.md#摘要模型读取前的裁剪)
- [LangGraph 实验](../experiments/README.md#工具错误批次重试与图步数)
- [SDK 实验](../experiments/README.md#委派交接与轮数边界)
- [本地验收脚本](../experiments/task_acceptance.py)
- [上下文研究](studies/context-compaction.md)
- [工具研究](studies/tool-results-and-retries.md)
- [协作研究](studies/delegation-and-handoffs.md)
- [离线验收记录](../experiments/results/task-acceptance.json)
- [原始论文与历史实现](studies/evaluation-and-evidence.md#二swe-bench补丁能应用还必须真的修复并保持原有行为)
- [原始论文与奖励边界](studies/evaluation-and-evidence.md#三τ-bench对话可以不同最后改变了什么仍应可检查)

跨仓机制与范围：

- [编程类九仓调查](studies/system-survey-coding.md)
- [框架十二仓调查](studies/system-survey-frameworks.md)
- [系统与应用框架十一仓调查](studies/system-survey-systems.md)
- [九主题设计分歧与 32 × 9 覆盖索引](system-design-map.md)

