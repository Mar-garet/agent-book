# 开源项目研究地图

这份地图记录 32 个项目的研究范围和后续问题。全部项目均已沿九个设计维度核查相关实现，调用过程与条件见[跨项目设计地图](system-design-map.md)。静态核查回答程序如何组织机制；它不提供整套产品的任务成功率。

## 32 个项目的取样边界

以下每行的状态都包含九维核查，并单独注明需要限制的范围或已有运行观察。后续问题用于安排实际任务验证。

| 项目 | 本轮状态 | 下一步的研究问题 |
| --- | --- | --- |
| [Codex CLI](../codex/) | 九维相关实现已静态核查 | 继续实测不同拒绝阶段与审批范围 |
| [Gemini CLI](../gemini-cli/) | 九维相关实现已静态核查 | 上下文组装、工具调度和会话恢复分别由谁组织？ |
| [OpenCode](../opencode/) | 九维相关实现已静态核查 | 不同工具与权限配置怎样进入同一会话执行链？ |
| [Cline](../cline/) | 九维核查：SDK 路径；VSCode 宿主另列 | 实测目录重建和错误包装，并另查 VSCode 宿主 |
| [Aider](../aider/) | 九维相关实现已静态核查 | 代码修改、版本记录与验证反馈怎样形成循环？ |
| [Qwen Code](../qwen-code/) | 九维相关实现已静态核查 | 终端任务中的工具反馈和长会话如何组织？ |
| [Pi](../pi/) | 九维核查；执行与投影已核对，摘要输入裁剪已实测 | 继续观察真实摘要模型与批次内插话 |
| [OpenHands](../openhands/) | 九维核查：Canvas 与客户端；后端服务边界单列 | 控制界面与实际 Agent 后端怎样分工？ |
| [Goose](../goose/) | 九维相关实现已静态核查 | 实测逐步发现、目录变更与大结果处理 |
| [OpenClaw](../openclaw/) | 九维相关实现已静态核查 | 实测文件变更、索引同步和模型实际输入 |
| [Hermes Agent](../hermes-agent/) | 九维相关实现已静态核查 | 实测普通写入、压缩和会话重建后的可见内容 |
| [Browser Use](../browser-use/) | 九维相关实现已静态核查 | 网页观察、动作和页面变化怎样构成反馈？ |
| [LangChain Python](../langchain/) | 九维核查；Core 工具包装与错误返回已核对并参与实验 | 应用怎样消费返回状态与独立产物？ |
| [LangGraph Python](../langgraph/) | 九维核查；恢复、工具重试与图步数已有局部实验 | 继续研究跨进程持久化与真实业务副作用 |
| [LangChain JS/TS](../langchainjs/) | 九维相关实现已静态核查 | JS/TS 的组合机制与 Python 版本有哪些语义差异？ |
| [LangGraph JS/TS](../langgraphjs/) | 九维相关实现已静态核查 | JS/TS 中的状态与恢复约定如何表达？ |
| [Deep Agents](../deepagents/) | 九维相关实现已静态核查 | 继续实测不同后端与继承模式 |
| [CrewAI](../crewai/) | 九维相关实现已静态核查 | 角色协作与事件流程怎样互相嵌入？ |
| [AutoGen](../autogen/) | 九维相关实现已静态核查 | 多个执行者之间如何传递控制、消息与停止信号？ |
| [Microsoft Agent Framework](../agent-framework/) | 九维相关实现已静态核查 | 跨执行者的工作流和恢复怎样组织？ |
| [Semantic Kernel](../semantic-kernel/) | 九维相关实现已静态核查 | 模型选择、业务能力和流程控制怎样组合？ |
| [OpenAI Agents SDK Python](../openai-agents-python/) | 九维核查；委派、交接与轮数边界已核对并实测 | 继续观察输入过滤、取消和真实模型的汇总行为 |
| [OpenAI Agents SDK JS/TS](../openai-agents-js/) | 九维相关实现已静态核查 | JS/TS 的执行与协作机制怎样对应实际任务？ |
| [Google ADK](../adk-python/) | 九维相关实现已静态核查 | 运行、会话状态和工具调用如何连接？ |
| [Smolagents](../smolagents/) | 九维相关实现已静态核查 | 代码行动改变了哪些往返、执行和调试成本？ |
| [Pydantic AI](../pydantic-ai/) | 九维相关实现已静态核查 | 类型与校验如何帮助表达工具结果和任务约定？ |
| [Agno](../agno/) | 九维相关实现已静态核查 | 会话、工具和持久信息怎样进入工作过程？ |
| [AgentScope](../agentscope/) | 九维相关实现已静态核查 | 消息、角色和协作如何组织，并在何处停止？ |
| [CAMEL](../camel/) | 九维相关实现已静态核查 | 角色设定如何转化为真实任务分工与结果汇总？ |
| [LlamaIndex](../llama-index/) | 九维相关实现已静态核查 | 资料检索怎样进入行动与状态变化？ |
| [Letta](../letta/) | 迁移占位已核对；补查官方 Letta Code 本地实现 | 继续实测本地记忆编译、后台合并与提示更新 |
| [Mastra](../mastra/) | 九维相关实现已静态核查 | 工具、工作流与持久状态怎样协同？ |

[返回项目比较](../book/10-project-comparisons.md) · [固定源码版本](../docs/source-catalog.md)
