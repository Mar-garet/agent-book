# Agent 系统设计分歧与全仓覆盖索引

> 更新：2026-10-17。本页按九个主题串联全部 32 个收录仓库的研究，另提供 32 × 9 的核查索引。这里的 288 项是静态研究记录，不是 288 次模型任务或通过成绩。

本页服务于复核设计与追查来源。正文沿读者问题展开，三份调查逐仓保留实际入口、请求、状态、适配器和限制。原始快照固定于 [SOURCES.json](../SOURCES.json)；项目所处层次、是否启用组件和调用路径都属于结论前提。我们没有运行新的远程模型评测，不按机制数量排列性能或安全名次。

两处范围尤其需要保留。Cline 本轮主要核对 SDK，不将结果自动推广到 VSCode 产品。OpenHands 当前快照主要体现 Canvas 到 agent-server 的调用与设置边界，后端算法不能从前端字段反推。Letta 收录提交是迁移入口，运行机制来自另行只读固定的官方 letta-code 补充版本，不能写成原占位仓里存在的实现。

## 行动循环与工具：选择和执行在哪里相遇

Codex、Gemini CLI、Qwen Code、Pi、Goose、OpenCode 和 Cline SDK 都把模型响应、工具执行与后续请求连成循环，控制单位却不同：会话轮、步骤、状态机操作和 SDK iteration 不能直接换算。LangChain 的 Python 与 JS 构造器在图上安排模型/工具转移；Semantic Kernel 将自动调用放在连接器一侧，Kernel 承接函数路由；OpenAI Agents SDK 则由 Runner 区分工具、交接和最终输出。

Aider 的中心是编辑协议、补丁应用与检查反馈。smolagents 可以让代码表达组合动作。Browser Use 要在动作前后重新观察页面。Google ADK、Pydantic AI、Agno、AgentScope 和 CAMEL 也有工具循环，但前台调用、外部工具请求与真正执行不一定发生在同一组件。LlamaIndex 的工作流还可检索工具再交给当前 Agent；Mastra 需要分别看普通与持久执行分支。

对业务设计的影响是先选可观察的动作单位，再安排准入与反馈。协议接通只解决通信；MCP 的可选适配、工具筛选和宿主默认执行都要单列条件。一个工具结果显示成功，也不能越过任务产物验收。

## 上下文：存档、投影和本轮输入怎样分开

Pi 的会话树、OpenCode 的持久事件、Codex 的 Rollout 与 Cline SDK 的运行消息保存经历；模型拿到的却是选中分支、压缩后历史或最终请求。LangGraph 的 Python 与 JS、LangChain 两种语言及 Pydantic AI 都提供修改模型输入的结构，但结构合法不能保证约束没有被删。

Deep Agents 与 CrewAI 有条件地外置大结果；Goose 和 Gemini 依据窗口/使用量安排压缩，Qwen 单独约束摘要输入与输出预算。LlamaIndex 的新 Memory 将活动历史与可选记忆块按预算合成；Mastra 的处理器次序也参与构造当前输入。OpenClaw 的 bootstrap 注入模式和 Hermes 的常驻/预取路径说明，刷新时机同样影响可见内容。

设计时应把持续约束、当前观察、待证假设和原文定位分开。可回查的档案解决追溯，稳定的选择和刷新规则才解决本轮依据。Letta 补充本地后端按已提交 MemFS 版本编译提示，也体现“磁盘工作区已经改动”不等于“模型已经见到新版本”。

## 记忆：写入、整理、检索与生效是四件事

文件型持续资料可从 Pi、Cline SDK、OpenClaw 和 Hermes 的读取/更新边界研究；Codex、Gemini、Qwen 的受控后台管线又把历史候选、提取、整理、审阅或召回拆开。后台工作减少手工整理，也带来并发、资格筛选、失败恢复与新鲜度成本。Letta 补充版本进一步用私有 worktree 和提交版本管理记忆更新。

框架机制的粒度也不同。LangGraph 两种语言提供 Store，与执行检查点分别配置；LangChain 负责将这些设施接入图。AutoGen 的具体 ListMemory 把列表全部加入上下文，ADK 的内存记忆按应用与用户组织事件；它们不应被描述为默认向量语义库。Semantic Kernel 的旧记忆接口负责 embedding 与存储，不自动决定该记住什么。Agent Framework 的 memory provider、AgentScope 的文件记忆中间层、Agno 的记忆管理器、CrewAI 的统一 Memory 均有明确接入条件。

CAMEL 可组合聊天与向量记录，LlamaIndex 的新 Memory 分配活动队列和长期块，Mastra 按会话/资源范围召回。OpenAI Agents SDK 的 Session、Aider 的历史恢复、Browser Use 的动作 memory 与 smolagents 的步骤记录主要解决运行经历；不能仅凭“memory”名称就当成同一种跨任务事实系统。Pydantic AI 传入的历史和 OpenHands 委托的 agent_context 也各有责任边界。

适合业务的选择要先说明对象、来源、有效期与调用者，再决定存储和查询。文件、数据库和索引可以组合；读写顺序正确也仍需检验事实是否适用。

## 规划与 Skills：可复用说明和控制结构不宜混同

Aider 的 Architect/Editor 是先方案后编辑；CrewAI 可加独立规划器，smolagents 可按间隔产生规划步骤。LangGraph 与 Agent Framework Workflow 则让程序固定阶段和消息转移。这些机制分别处理决策内容、决策时间和执行顺序，不是同一条“规划能力”刻度。

Pi、Goose、Hermes、OpenClaw、Cline SDK、Agno 等技能机制将目录、元信息与正文读取分开；Qwen 的条件技能让路径影响可见性，ADK 的能力生命周期还可控制失效。Deep Agents 的 Skills 需要显式来源/后端，OpenAI Agents SDK 的 sandbox Skills 也不能泛指每个普通 Runner 都自动读本机目录。Mastra 的处理器和 AgentScope 的 viewer 各在自己的装配层提供经验。

适用面很窄的确定任务可以直接采用程序流程；探索任务保留逐步反馈，有足够依赖和交接时再增加计划。技能说明帮助选择，必须始终成立的约束落到工具和权限；读取脚本不等于执行脚本。

## 多 Agent：分发、交接、共享状态和汇总怎样取舍

OpenAI Agents SDK 与 LlamaIndex 让交接改变当前执行者；工具式子调用则期望结果回到父过程。Deep Agents 区分消息隔离与状态继承，Cline SDK 显式传子工具/策略，Hermes 可以跳过父方记忆和上下文，Codex 与 OpenCode 用线程/子会话身份保留归属。Goose 还校验子会话类型与父 ID，再决定复用最终结果或启动。

AutoGen 选择下位发言者，CrewAI 的管理者安排任务，AgentScope 将同成员任务串行、不同成员并行，CAMEL 的 Workforce 可重试或重规划。Agno Team、Mastra network、Agent Framework Workflow、LangGraph 图任务分别承担不同调度单位；它们不能因都有多个 Agent 就视为同一种共享状态。Browser Use 可被包成上层工具，Aider 则提供串行模型分工，Letta 的专门记忆 worker 也不能代表通用团队。

并行收益要扣除输入复制、重复查询、来源核对与冲突处理。协调者需要的是能验收的证据与终止状态，不只是多份写着“完成”的文本。父会话仍在运行，也不证明子任务已达目标。

## 恢复与副作用：继续哪份状态，谁核实外部效果

LangGraph 的 Python/JS 节点执行、Agent Framework 的状态提交、CrewAI checkpoint、Agno paused run、Mastra loop snapshot、OpenAI Agents SDK RunState 和 OpenCode execution claim 保存的是不同层次的连续性。AutoGen、CAMEL、smolagents 的经历保存/续接也不能直接升级为跨进程事务保证。LlamaIndex 部分恢复依赖外部 workflows 包，需要固定那一层版本再研究。

Aider、Cline SDK、Hermes 的本地回退主要保护文件；Letta 补充版本用私有 Git worktree 处理记忆分支；Browser Use 的 rerun_history 会再次执行浏览器动作。OpenClaw 在特定候选 fallback 中检查已提交副作用/交付证据，说明防重复必须落到真实动作边界。OpenHands 的连接重连只能恢复事件观察，不能独自解释服务是否重做动作。

业务写入先有稳定身份，再记录准备、发出、确认或未知。检查点减少重做范围，服务查询和幂等处理已经产生的效果。取消、暂停与补偿也应分别记录，不能用清空会话状态代替撤回远端事实。

## 权限与信任：参数、批准、隔离各在哪里检查

Codex 将审批、工具环境和执行限制分层；Gemini 在工具前钩子改参后核对策略；Qwen 的权限流程结合工具默认与规则覆盖；Cline SDK 在最终参数与 policy 上请求批准。Pi 和 CrewAI 的调用前钩子是可插入准入点，不等于默认操作系统隔离。OpenCode 的 action/resource 规则与真实服务凭证仍是两层。

框架中的 guardrail、filter、interrupt、approval 或 deferred tool 为应用提供准入位置，具体身份与资源范围仍须配置。Browser Use 的域名监控限制访问目的地，允许网站里的文字仍不能增加任务授权。MCP 注解、工具名、目录快照、参数结构与业务批准分别表达不同事实。Letta 的自有记忆路径检查也只保证可写范围，不保证写入内容具有业务指挥权。

应当同时控制工具可见性与执行权限，必要时让业务服务在最终提交处再核对对象和版本。外部材料可作为证据，摘要和记忆必须保留其来源，不能在转述中把文档作者变成当前用户。

## 预算：轮数、步骤、调用、时间和费用不能共用一个名字

OpenAI Agents SDK 的 turn、Goose 的 assistant-turn、Cline SDK 的 iteration、Aider 的 reflection、Browser Use 的 step、AutoGen 的 tool iteration 与 LangGraph 的图步数，各自约束不同单位。smolagents 的规划和最终回答还可额外调用模型；AgentScope 结构化收尾有宽限迭代。Qwen 还区分用户会话调用与 Goal 调度消费，Hermes 子 Agent 实际创建新的预算，不能用旧注释的 shared 概括。

Pydantic AI 对请求前、响应后的 usage 分别检查，费用限制依赖价格；Agent Framework 的函数配置还分别表示往返、工具总调用与时长。OpenClaw 为执行和结算设置不同期限，OpenCode 为重启恢复另计尝试，Codex 有模型提供的上下文预算配置；这些都不能自动换算成全树费用硬上限。OpenHands 的余额 UI 更是报告而非执行器额度证明。

局部控制可以组合，根任务还需关联子运行、重试和昂贵工具。先为验收与收尾预留资源，再分配探索；结果未知的消费保留待结算状态，而不是因为本地超时就记为零。

## 评测与完成：明确谁检查了什么

机制回归、在线输出检查、离线任务验收和模型评委回答不同问题。Pi 的隔离 eval harness、Goose/Cline 的 Harbor 适配、Aider 的带测试题目，以及 Gemini 的行为评测定义都需固定模型、任务与开关；Qwen 集成测试会主动关闭与目标无关的后台记忆，测试配置不能当产品默认。

LangChain classic 的 QA evaluator 与 LlamaIndex 的答案评审按给定输入打分；Pydantic AI 的工具正确性读取工具 span，ADK 的轨迹指标按期望调用排序/匹配。Browser Use 可同时保留自报和 judge，Agno 检查实际执行错误，CrewAI guardrail 和 smolagents 最终答案检查可阻止交付。AgentScope 成员超限仍可被映射为工具成功，Mastra scorer 未运行也可能只是没被采样；运行正常结束与业务目标达成必须分开。

验收应独立读取产物和必要过程，报告已通过、未通过与证据不足。静态读到测试定义只能说明项目安排了某种检查，不能声称本书运行通过，更不能把不同层次的记录加成跨项目成功率。

## 全部 32 个仓库 × 九维核查索引

每格跳到该仓九维记录，那里保留实际路径、入口、事实、取舍和范围。标记只表示本轮研究证据类型：

- **链**：读取了该维度的一条关键实现链，仍可能有未覆盖分支、可选组件或后端。
- **界**：主要核对状态、扩展或完成边界，不足以宣称已有完整同类系统。
- **托**：核对了委托接口，底层机制在依赖/服务中，尚未据本仓证明。
- **验**：读过检查或评测定义，未因此声称运行通过。
- **补**：Letta 运行事实来自单独固定的 letta-code 补充实现，原收录提交没有这些运行源码。

表内“循环/工具”合并为一维，MCP 具体传输与可选适配的覆盖限制写在每仓范围内。记录存在表示已研究相应责任，不表示每仓同样默认支持九套完整产品能力。


| 仓库 | 循环/工具 | 上下文 | 记忆 | 规划/Skills | 协作 | 恢复/副作用 | 权限/信任 | 预算 | 评测/完成 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex CLI | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [链](studies/system-survey-coding.md#codex-cli) | [验](studies/system-survey-coding.md#codex-cli) |
| Gemini CLI | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [链](studies/system-survey-coding.md#gemini-cli) | [验](studies/system-survey-coding.md#gemini-cli) |
| OpenCode | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [链](studies/system-survey-coding.md#opencode) | [验](studies/system-survey-coding.md#opencode) |
| Cline | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [链](studies/system-survey-coding.md#cline) | [验](studies/system-survey-coding.md#cline) |
| Aider | [链](studies/system-survey-coding.md#aider) | [链](studies/system-survey-coding.md#aider) | [界](studies/system-survey-coding.md#aider) | [链](studies/system-survey-coding.md#aider) | [链](studies/system-survey-coding.md#aider) | [链](studies/system-survey-coding.md#aider) | [链](studies/system-survey-coding.md#aider) | [链](studies/system-survey-coding.md#aider) | [验](studies/system-survey-coding.md#aider) |
| Qwen Code | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [链](studies/system-survey-coding.md#qwen-code) | [验](studies/system-survey-coding.md#qwen-code) |
| Pi | [链](studies/system-survey-coding.md#pi) | [链](studies/system-survey-coding.md#pi) | [界](studies/system-survey-coding.md#pi) | [链](studies/system-survey-coding.md#pi) | [界](studies/system-survey-coding.md#pi) | [链](studies/system-survey-coding.md#pi) | [链](studies/system-survey-coding.md#pi) | [链](studies/system-survey-coding.md#pi) | [验](studies/system-survey-coding.md#pi) |
| OpenHands | [托](studies/system-survey-coding.md#openhands) | [托](studies/system-survey-coding.md#openhands) | [托](studies/system-survey-coding.md#openhands) | [链](studies/system-survey-coding.md#openhands) | [链](studies/system-survey-coding.md#openhands) | [界](studies/system-survey-coding.md#openhands) | [链](studies/system-survey-coding.md#openhands) | [托](studies/system-survey-coding.md#openhands) | [验](studies/system-survey-coding.md#openhands) |
| Goose | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [链](studies/system-survey-coding.md#goose) | [验](studies/system-survey-coding.md#goose) |
| OpenClaw | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [链](studies/system-survey-systems.md#openclaw) | [验](studies/system-survey-systems.md#openclaw) |
| Hermes Agent | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [链](studies/system-survey-systems.md#hermes-agent) | [验](studies/system-survey-systems.md#hermes-agent) |
| Browser Use | [链](studies/system-survey-systems.md#browser-use) | [链](studies/system-survey-systems.md#browser-use) | [界](studies/system-survey-systems.md#browser-use) | [链](studies/system-survey-systems.md#browser-use) | [链](studies/system-survey-systems.md#browser-use) | [链](studies/system-survey-systems.md#browser-use) | [链](studies/system-survey-systems.md#browser-use) | [链](studies/system-survey-systems.md#browser-use) | [验](studies/system-survey-systems.md#browser-use) |
| LangChain Python | [链](studies/system-survey-frameworks.md#langchain) | [链](studies/system-survey-frameworks.md#langchain) | [链](studies/system-survey-frameworks.md#langchain) | [链](studies/system-survey-frameworks.md#langchain) | [界](studies/system-survey-frameworks.md#langchain) | [链](studies/system-survey-frameworks.md#langchain) | [链](studies/system-survey-frameworks.md#langchain) | [链](studies/system-survey-frameworks.md#langchain) | [验](studies/system-survey-frameworks.md#langchain) |
| LangGraph Python | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [链](studies/system-survey-frameworks.md#langgraph) | [界](studies/system-survey-frameworks.md#langgraph) |
| LangChain JS/TS | [链](studies/system-survey-frameworks.md#langchainjs) | [链](studies/system-survey-frameworks.md#langchainjs) | [链](studies/system-survey-frameworks.md#langchainjs) | [链](studies/system-survey-frameworks.md#langchainjs) | [界](studies/system-survey-frameworks.md#langchainjs) | [链](studies/system-survey-frameworks.md#langchainjs) | [链](studies/system-survey-frameworks.md#langchainjs) | [链](studies/system-survey-frameworks.md#langchainjs) | [验](studies/system-survey-frameworks.md#langchainjs) |
| LangGraph JS/TS | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [链](studies/system-survey-frameworks.md#langgraphjs) | [界](studies/system-survey-frameworks.md#langgraphjs) |
| Deep Agents | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [链](studies/system-survey-systems.md#deepagents) | [验](studies/system-survey-systems.md#deepagents) |
| CrewAI | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [链](studies/system-survey-systems.md#crewai) | [验](studies/system-survey-systems.md#crewai) |
| AutoGen | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [链](studies/system-survey-frameworks.md#autogen) | [验](studies/system-survey-frameworks.md#autogen) |
| Microsoft Agent Framework | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [链](studies/system-survey-frameworks.md#agent-framework) | [验](studies/system-survey-frameworks.md#agent-framework) |
| Semantic Kernel | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [链](studies/system-survey-frameworks.md#semantic-kernel) | [界](studies/system-survey-frameworks.md#semantic-kernel) |
| OpenAI Agents SDK Python | [链](studies/system-survey-frameworks.md#openai-agents-python) | [链](studies/system-survey-frameworks.md#openai-agents-python) | [界](studies/system-survey-frameworks.md#openai-agents-python) | [链](studies/system-survey-frameworks.md#openai-agents-python) | [链](studies/system-survey-frameworks.md#openai-agents-python) | [链](studies/system-survey-frameworks.md#openai-agents-python) | [链](studies/system-survey-frameworks.md#openai-agents-python) | [链](studies/system-survey-frameworks.md#openai-agents-python) | [界](studies/system-survey-frameworks.md#openai-agents-python) |
| OpenAI Agents SDK JS/TS | [链](studies/system-survey-frameworks.md#openai-agents-js) | [链](studies/system-survey-frameworks.md#openai-agents-js) | [界](studies/system-survey-frameworks.md#openai-agents-js) | [链](studies/system-survey-frameworks.md#openai-agents-js) | [链](studies/system-survey-frameworks.md#openai-agents-js) | [链](studies/system-survey-frameworks.md#openai-agents-js) | [链](studies/system-survey-frameworks.md#openai-agents-js) | [链](studies/system-survey-frameworks.md#openai-agents-js) | [界](studies/system-survey-frameworks.md#openai-agents-js) |
| Google Agent Development Kit | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [链](studies/system-survey-frameworks.md#adk-python) | [验](studies/system-survey-frameworks.md#adk-python) |
| Smolagents | [链](studies/system-survey-frameworks.md#smolagents) | [链](studies/system-survey-frameworks.md#smolagents) | [界](studies/system-survey-frameworks.md#smolagents) | [链](studies/system-survey-frameworks.md#smolagents) | [链](studies/system-survey-frameworks.md#smolagents) | [链](studies/system-survey-frameworks.md#smolagents) | [链](studies/system-survey-frameworks.md#smolagents) | [链](studies/system-survey-frameworks.md#smolagents) | [验](studies/system-survey-frameworks.md#smolagents) |
| Pydantic AI | [链](studies/system-survey-frameworks.md#pydantic-ai) | [链](studies/system-survey-frameworks.md#pydantic-ai) | [界](studies/system-survey-frameworks.md#pydantic-ai) | [链](studies/system-survey-frameworks.md#pydantic-ai) | [链](studies/system-survey-frameworks.md#pydantic-ai) | [链](studies/system-survey-frameworks.md#pydantic-ai) | [链](studies/system-survey-frameworks.md#pydantic-ai) | [链](studies/system-survey-frameworks.md#pydantic-ai) | [验](studies/system-survey-frameworks.md#pydantic-ai) |
| Agno | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [链](studies/system-survey-systems.md#agno) | [验](studies/system-survey-systems.md#agno) |
| AgentScope | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [链](studies/system-survey-systems.md#agentscope) | [界](studies/system-survey-systems.md#agentscope) |
| CAMEL | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [链](studies/system-survey-systems.md#camel) | [验](studies/system-survey-systems.md#camel) |
| LlamaIndex | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [链](studies/system-survey-systems.md#llama-index) | [验](studies/system-survey-systems.md#llama-index) |
| Letta | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) | [补](studies/system-survey-systems.md#letta) |
| Mastra | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [链](studies/system-survey-systems.md#mastra) | [验](studies/system-survey-systems.md#mastra) |

## 固定来源与仍需深化的范围

- [九个编程类仓库调查](studies/system-survey-coding.md)：运行系统、编辑系统与前端/服务委托边界；包括 Codex、Gemini、Qwen、OpenCode 记忆更新的多文件补充链。
- [十二个框架仓库调查](studies/system-survey-frameworks.md)：Python/JS 分开，装配、执行、可选能力与独立评测分层。
- [十一个运行系统与应用框架调查](studies/system-survey-systems.md)：文件记忆、团队、浏览器、持久运行与 Letta 补充版本。

下一轮应围绕任务暴露的缺口深化，而不是把“链”机械变成“全部支持”：外部依赖版本、不同配置与插件的生命周期、真实服务副作用，以及有模型参与的重复任务都需要另外证据。本文不以尚未找到某条实现判定项目不具备该能力。

