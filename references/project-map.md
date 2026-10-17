# 开源项目研究地图

这份地图记录本书的取样范围与待研究问题，供核对案例覆盖程度使用。章节中的比较沿问题展开；这里单独保留研究进度与固定源码的导航。收录源码不表示已经完成项目分析，局部机制的观察也不代表整套产品的任务表现。

## 32 个项目的后续取样地图

以下问题用于安排研究。“初查”表示核对过本章采用的部分材料，不表示已经完成该项目的全部分析。完整版本与本地位置见 [源码目录](../docs/source-catalog.md)。

| 项目 | 本轮状态 | 下一步的研究问题 |
| --- | --- | --- |
| [Codex CLI](../codex/) | 工具执行链已静态核对 | 继续实测不同拒绝阶段与审批范围 |
| [Gemini CLI](../gemini-cli/) | 素材就绪，待主题分析 | 上下文组装、工具调度和会话恢复分别由谁组织？ |
| [OpenCode](../opencode/) | 素材就绪，待主题分析 | 不同工具与权限配置怎样进入同一会话执行链？ |
| [Cline](../cline/) | SDK 的 MCP 局部路径已静态核对 | 实测目录重建和错误包装，并另查 VSCode 宿主 |
| [Aider](../aider/) | 素材就绪，待主题分析 | 代码修改、版本记录与验证反馈怎样形成循环？ |
| [Qwen Code](../qwen-code/) | 素材就绪，待主题分析 | 终端任务中的工具反馈和长会话如何组织？ |
| [Pi](../pi/) | 执行与投影已核对，摘要输入裁剪已实测 | 继续观察真实摘要模型与批次内插话 |
| [OpenHands](../openhands/) | 入口定位已核对 | 控制界面与实际 Agent 后端怎样分工？ |
| [Goose](../goose/) | 扩展 MCP 目录与调用已静态核对 | 实测逐步发现、目录变更与大结果处理 |
| [OpenClaw](../openclaw/) | 记忆注入与 deep 整理路径已静态核对 | 实测文件变更、索引同步和模型实际输入 |
| [Hermes Agent](../hermes-agent/) | 记忆编辑与提示刷新边界已静态核对 | 实测普通写入、压缩和会话重建后的可见内容 |
| [Browser Use](../browser-use/) | 素材就绪，待主题分析 | 网页观察、动作和页面变化怎样构成反馈？ |
| [LangChain Python](../langchain/) | Core 工具包装与错误返回已核对并参与实验 | 应用怎样消费返回状态与独立产物？ |
| [LangGraph Python](../langgraph/) | 恢复、工具重试与图步数已有局部实验 | 继续研究跨进程持久化与真实业务副作用 |
| [LangChain JS/TS](../langchainjs/) | 素材就绪，待主题分析 | JS/TS 的组合机制与 Python 版本有哪些语义差异？ |
| [LangGraph JS/TS](../langgraphjs/) | 素材就绪，待主题分析 | JS/TS 中的状态与恢复约定如何表达？ |
| [Deep Agents](../deepagents/) | 默认装配与子任务状态已静态核对 | 继续实测不同后端与继承模式 |
| [CrewAI](../crewai/) | 已形成初步案例 | 角色协作与事件流程怎样互相嵌入？ |
| [AutoGen](../autogen/) | 素材就绪，待主题分析 | 多个执行者之间如何传递控制、消息与停止信号？ |
| [Microsoft Agent Framework](../agent-framework/) | 素材就绪，待主题分析 | 跨执行者的工作流和恢复怎样组织？ |
| [Semantic Kernel](../semantic-kernel/) | 素材就绪，待主题分析 | 模型选择、业务能力和流程控制怎样组合？ |
| [OpenAI Agents SDK Python](../openai-agents-python/) | 委派、交接与轮数边界已核对并实测 | 继续观察输入过滤、取消和真实模型的汇总行为 |
| [OpenAI Agents SDK JS/TS](../openai-agents-js/) | 素材就绪，待主题分析 | JS/TS 的执行与协作机制怎样对应实际任务？ |
| [Google ADK](../adk-python/) | 素材就绪，待主题分析 | 运行、会话状态和工具调用如何连接？ |
| [Smolagents](../smolagents/) | 已形成初步案例 | 代码行动改变了哪些往返、执行和调试成本？ |
| [Pydantic AI](../pydantic-ai/) | 素材就绪，待主题分析 | 类型与校验如何帮助表达工具结果和任务约定？ |
| [Agno](../agno/) | 素材就绪，待主题分析 | 会话、工具和持久信息怎样进入工作过程？ |
| [AgentScope](../agentscope/) | 素材就绪，待主题分析 | 消息、角色和协作如何组织，并在何处停止？ |
| [CAMEL](../camel/) | 素材就绪，待主题分析 | 角色设定如何转化为真实任务分工与结果汇总？ |
| [LlamaIndex](../llama-index/) | 素材就绪，待主题分析 | 资料检索怎样进入行动与状态变化？ |
| [Letta](../letta/) | 入口定位已核对 | 实际实现已迁移到哪里，记忆研究需要补哪些材料？ |
| [Mastra](../mastra/) | 素材就绪，待主题分析 | 工具、工作流与持久状态怎样协同？ |

[返回项目比较](../book/10-project-comparisons.md) · [固定源码版本](../docs/source-catalog.md)
