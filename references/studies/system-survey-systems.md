# 系统专题全仓核查：运行系统与应用框架组

> 核查日期：2026-10-17。本文是源码研究材料，不是运行测试报告。已逐仓读取实际函数体及相邻调用边界；上游源码只读，所有比较固定到 SOURCES.json 的提交。

本组负责 11 个仓库：OpenClaw、Hermes、Browser Use、Deep Agents、CrewAI、Agno、AgentScope、CAMEL、LlamaIndex、Letta、Mastra。正文写作可按设计范式综合，不能把本研究的仓库分节直接当书的目录。没有核对的分支只记研究边界，不判为能力不存在。

每个维度分别记录调用入口、状态责任与设计代价；这里的入口只在该条明确范围内计数。参数、请求对象、业务适配器与缓存均不因有类名而变成额外入口。取舍段是从代码边界得到的设计推断，没有成功率、时延或成本优劣结论。

## 可用于全书的横向判断

- 文件、聊天轨迹、索引与当前模型输入是不同对象。AgentScope 的文件目录选择、CrewAI 的统一记忆读屏障、LlamaIndex 的活动队列与长期块、Mastra 的作用域召回，提供不同于单一“向量库记忆”的案例。
- 完成信号需要连着主语读：Browser Use 的 Agent 自报与 judge 并列，AgentScope 团队成员超限仍可被包装为工具成功，Agno 的可靠性评测则刻意要求实际无错执行。
- 恢复对象必须说明：Hermes 文件检查点、Crew checkpoint、Agno 暂停运行与 Mastra loop snapshot保存不同状态，不能互换成远端副作用去重保证。
- 框架的便利来自预先安排责任，也来自可选组件；Deep Agents 的 Skills/Memory、AgentScope 的记忆中间层、LlamaIndex 的新 Memory 都应标明接入条件。
- 已核对 Hermes 子Agent实际构造新预算；run_agent 构造函数旧注释“shared”与真实子构造不一致，采用调用实现，不拿注释替代执行链。

## 证据口径

本地链接从本文位置指向主仓库的只读子模块；隔离工作树未初始化子模块时，校验需用 `--source-root /Users/jianan/agent_book`。每仓末尾集中列出本地范围与固定提交链接。未运行上游测试、benchmark、远程模型或业务服务。

## browser-use

类型：浏览器Agent运行库。固定提交：`ccd22fef47a1a36e0c4596fef5db73a5117b9d06`。

浏览器当前状态、行动队列与任务历史构成循环；工具、计划和judge都有专门位置，不能把历史里的memory字段当跨任务知识库。

### 行动循环与工具/MCP

入口与责任链：Agent.run → step → _prepare_context/_get_next_action/_execute_actions。单步先抓浏览器状态，再请求模型、执行动作，最后记录结果；MCP服务另将tools/call交给_execute_tool（mcp/server.py 466–513）。

设计取舍：页面变化会使动作定位失效，运行系统需要重新观察而不是盲用旧索引。

核查范围：实读主循环及独立MCP服务器；不是所有外部MCP客户端能力审计。来源：S1, S2。

### 上下文

入口与责任链：MessageManager.maybe_compact_messages。历史过长时以已有compacted_memory、agent_history和可选read_state构造摘要请求；失败返回False保留原路径。

设计取舍：压缩可以减少输入，但摘要是否保住未完成动作仍需任务验证。

核查范围：默认Agent参数message_compaction=True，具体阈值由设置对象决定。来源：S3。

### 记忆

入口与责任链：AgentState / ActionResult.long_term_memory。AgentState保存步数、历史与消息管理状态；ActionResult.long_term_memory在源码中被标为本次动作的memory，不可仅凭名字视为跨任务事实库。

设计取舍：工作轨迹便于继续运行，但业务规则更新与持久知识选择不能由字段名保证。

核查范围：本轮核对运行内状态，未追踪独立外部长期记忆产品。来源：S4。

### 规划与Skills

入口与责任链：SkillService.execute_skill。按skill_id加载定义，检查所需cookie、校验参数，再调用_client.skills.execute_skill；Agent有enable_planning与计划注入路径。

设计取舍：复用确定流程减少逐步浏览，但cookie与技能执行存在远端边界。

核查范围：仅显式配置skill_ids/skill_service时接入；不是本地SKILL.md全文执行的同义词。来源：S5。

### 协作

入口与责任链：retry_with_browser_use_agent。MCP服务器可把一个任务转为内部Agent重试，并单独传max_steps、模型与allowed_domains。

设计取舍：浏览器可成为上层Agent工具，但子运行的状态与步数需要另关联。

核查范围：实际核对的是工具式嵌套，不声称仓库只有这一种协作方式。来源：S6。

### 恢复与副作用

入口与责任链：rerun_history。保存动作历史可以被明确重放，重放配置每动作重试次数与失败跳过策略。multi_act同时在页面变化后中止剩余旧动作。

设计取舍：重放会再次执行浏览器动作；提交表单等副作用应由业务服务核实而非当纯恢复。

核查范围：动作replay，不等同Exactly-once或远端回滚。来源：S7, S8。

### 权限与信任

入口与责任链：SecurityWatchdog导航/新标签事件处理器。导航前核对URL，导航完成后再捕获重定向，新标签不允许时尝试关闭。

设计取舍：域名边界能约束访问目的地，但不证明允许站点里的内容具有任务授权。

核查范围：策略是否收紧取决于browser profile；未做攻击实验。来源：S9。

### 预算

入口与责任链：Agent.run(max_steps)。循环按state.n_steps与max_steps继续，并检查consecutive_failures、停止和暂停状态；每步还可执行多个动作。

设计取舍：步数不是动作总数或费用总额，judge和压缩也可另外调用模型。

核查范围：只从代码核对计数边界，未测量耗时费用。来源：S10。

### 评测

入口与责任链：_judge_trace → _judge_and_log。judge读取任务、最终结果、步骤与截图，产出JudgementResult；结果附加在末个动作上，不覆盖Agent自报success。

设计取舍：同时保存自报和judge便于发现分歧，但两者仍需与业务产物核对。

核查范围：use_judge构造默认True；未运行judge或使用其结果排名。来源：S11。

### 本仓来源

- S1：[本地 browser-use/browser_use/agent/service.py#L1035-L1085](../../browser-use/browser_use/agent/service.py#L1035-L1085) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/service.py#L1035-L1085)。
- S2：[本地 browser-use/browser_use/mcp/server.py#L466-L513](../../browser-use/browser_use/mcp/server.py#L466-L513) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/mcp/server.py#L466-L513)。
- S3：[本地 browser-use/browser_use/agent/message_manager/service.py#L216-L280](../../browser-use/browser_use/agent/message_manager/service.py#L216-L280) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/message_manager/service.py#L216-L280)。
- S4：[本地 browser-use/browser_use/agent/views.py#L251-L340](../../browser-use/browser_use/agent/views.py#L251-L340) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/views.py#L251-L340)。
- S5：[本地 browser-use/browser_use/skills/service.py#L165-L258](../../browser-use/browser_use/skills/service.py#L165-L258) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/skills/service.py#L165-L258)。
- S6：[本地 browser-use/browser_use/mcp/server.py#L502-L513](../../browser-use/browser_use/mcp/server.py#L502-L513) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/mcp/server.py#L502-L513)。
- S7：[本地 browser-use/browser_use/agent/service.py#L3103-L3138](../../browser-use/browser_use/agent/service.py#L3103-L3138) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/service.py#L3103-L3138)。
- S8：[本地 browser-use/browser_use/agent/service.py#L2730-L2790](../../browser-use/browser_use/agent/service.py#L2730-L2790) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/service.py#L2730-L2790)。
- S9：[本地 browser-use/browser_use/browser/watchdogs/security_watchdog.py#L35-L91](../../browser-use/browser_use/browser/watchdogs/security_watchdog.py#L35-L91) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/browser/watchdogs/security_watchdog.py#L35-L91)。
- S10：[本地 browser-use/browser_use/agent/service.py#L2503-L2635](../../browser-use/browser_use/agent/service.py#L2503-L2635) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/service.py#L2503-L2635)。
- S11：[本地 browser-use/browser_use/agent/service.py#L1593-L1643](../../browser-use/browser_use/agent/service.py#L1593-L1643) · [固定源码](https://github.com/browser-use/browser-use/blob/ccd22fef47a1a36e0c4596fef5db73a5117b9d06/browser_use/agent/service.py#L1593-L1643)。

## deepagents

类型：LangChain/LangGraph上的装配框架。固定提交：`e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27`。

工厂先装配文件、摘要、工具记录修补等中间层，再把业务工具与状态设施交给底层Agent；memory、skills、权限与持久化要按参数解释。

### 行动循环与工具/MCP

入口与责任链：create_deep_agent → create_agent。工厂提供FilesystemMiddleware、摘要与PatchToolCalls，按配置加入子代理与其他中间层，最后转交create_agent。

设计取舍：开箱装配减少接线，也使默认中间层顺序成为行为的一部分。

核查范围：MCP需作为用户工具接入；本轮没有把MCP客户端算作工厂内置默认。来源：S1。

### 上下文

入口与责任链：create_summarization_middleware / FilesystemMiddleware。摘要位于核心栈，大工具结果由文件中间层支持外置；memory/skills在尾部条件接入。

设计取舍：缩短输入与更新提示前缀是不同职责，必须跟踪实际状态。

核查范围：工厂默认栈及已有同SHA研究，未运行模型。来源：S2, S3。

### 记忆

入口与责任链：MemoryMiddleware.before_agent。从配置sources下载内容并存memory_contents；状态中已存在该键时跳过重新加载。

设计取舍：文件已更新不代表已有线程立即重读，应用需要决定刷新边界。

核查范围：memory参数显式启用，后端决定文件存在哪里。来源：S4。

### 规划与Skills

入口与责任链：SkillsMiddleware(backend,sources)。skills非None才接入技能加载；文件后端提供资料，模型通过已公开的技能机制取得内容。

设计取舍：技能可按需披露，但不能把未配置的资料写成默认可用能力。

核查范围：skills加载细节参照同SHA pi-deepagents-execution研究，未审计全部profile替换。来源：S5。

### 协作

入口与责任链：task → _validate_and_prepare_state → subagent.invoke。isolated路径替换messages为任务描述，fork路径另构造父历史；子图运行后按允许状态生成回传Command。

设计取舍：减少父历史复制，但子任务必须收到必要约束，状态回流不是自动业务验收。

核查范围：区分isolated和实验fork；不是全历史默认共享。来源：S6。

### 恢复与副作用

入口与责任链：checkpointer/store透传。工厂把调用者提供的checkpointer和store交给底层图；默认文件后端在658行为StateBackend。

设计取舍：恢复记录和跨任务存储需明确配置，检查点不能撤销外部业务写入。

核查范围：未把图状态文件当本地磁盘或自动跨天持久化。来源：S7。

### 权限与信任

入口与责任链：permissions → interrupt_on → HumanInTheLoopMiddleware。文件权限规则转为中断配置，再与显式interrupt_on合并，必要时加入人工确认中间层。

设计取舍：声明式规则可约束派发，但服务权限与外部副作用仍由实际后端承担。

核查范围：仅这一工厂的权限组装，未宣称所有工具默认需要确认。来源：S8。

### 预算

入口与责任链：with_config(recursion_limit=9999)。工厂为图绑定recursion_limit 9999；子图另外有配置继承与绑定规则。

设计取舍：这是图推进上限，不能拿它当全树金额或工具次数。

核查范围：固定版本工厂代码值；不从此推断合理生产预算。来源：S9。

### 评测

入口与责任链：RubricMiddleware / GraderResponse。评分对象要求逐项criteria，并拒绝satisfied却含失败项等自相矛盾输出。

设计取舍：结构一致性检查可以挡住一类评分错误，但不能证明首次准则拆分完整。

核查范围：可选rubric中间层，graph默认核心栈不自动包含它。来源：S10。

### 本仓来源

- S1：[本地 deepagents/libs/deepagents/deepagents/graph.py#L893-L1007](../../deepagents/libs/deepagents/deepagents/graph.py#L893-L1007) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L893-L1007)。
- S2：[本地 deepagents/libs/deepagents/deepagents/graph.py#L915-L949](../../deepagents/libs/deepagents/deepagents/graph.py#L915-L949) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L915-L949)。
- S3：[本地 deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3500-L3569](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3500-L3569) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3500-L3569)。
- S4：[本地 deepagents/libs/deepagents/deepagents/middleware/memory.py#L279-L311](../../deepagents/libs/deepagents/deepagents/middleware/memory.py#L279-L311) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/memory.py#L279-L311)。
- S5：[本地 deepagents/libs/deepagents/deepagents/graph.py#L935-L940](../../deepagents/libs/deepagents/deepagents/graph.py#L935-L940) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L935-L940)。
- S6：[本地 deepagents/libs/deepagents/deepagents/middleware/subagents.py#L826-L866](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L826-L866) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L826-L866)。
- S7：[本地 deepagents/libs/deepagents/deepagents/graph.py#L995-L1007](../../deepagents/libs/deepagents/deepagents/graph.py#L995-L1007) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L995-L1007)。
- S8：[本地 deepagents/libs/deepagents/deepagents/graph.py#L952-L957](../../deepagents/libs/deepagents/deepagents/graph.py#L952-L957) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L952-L957)。
- S9：[本地 deepagents/libs/deepagents/deepagents/graph.py#L1008-L1010](../../deepagents/libs/deepagents/deepagents/graph.py#L1008-L1010) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L1008-L1010)。
- S10：[本地 deepagents/libs/deepagents/deepagents/middleware/rubric.py#L309-L352](../../deepagents/libs/deepagents/deepagents/middleware/rubric.py#L309-L352) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/rubric.py#L309-L352)。

## agentscope

类型：带事件与权限系统的Agent框架。固定提交：`976e2ffc9c28869282bbcdde9a2661c48147ff3b`。

统一Agent持有AgentState，Toolkit是工具/MCP/Skills来源；事件驱动把确认、外部执行与继续运行显式分开。

### 行动循环与工具/MCP

入口与责任链：reply_stream / reply → _reply。两个应用入口分别流式输出事件或消费事件返回消息，接受新消息、确认结果、外部执行结果和中断事件。

设计取舍：宿主容易接入UI等待，但必须正确路由reply_id与外部结果。

核查范围：当前统一Agent实现，不沿用旧ReActAgent类名。来源：S1。

### 上下文

入口与责任链：_prepare_model_input。请求由系统提示、state.summary、state.context与当前激活工具组schemas组成，摘要作为独立消息加入。

设计取舍：存档/摘要/当前上下文分离便于控制输入，摘要身份和来源需保留。

核查范围：原始Agent默认配置，压缩细节还受ContextConfig与offloader影响。来源：S2。

### 记忆

入口与责任链：AgenticMemoryMiddleware.on_system_prompt / _retrieve_relevant_files。可选文件记忆中间层读取MEMORY.md并按预算裁剪；另一读取链由模型从文件头目录挑相关主题文件（709–749）。

设计取舍：人可编辑的文件加目录选择便于审阅，但索引截断和额外模型检索仍有成本。

核查范围：显式装配中间层；Mem0/ReMe是另外可选实现，未混成默认。来源：S3, S4。

### 规划与Skills

入口与责任链：Skill viewer.call。从activated_groups取得技能，按名称返回目标markdown，缺失则返回ERROR；TaskContext还保留计划状态。

设计取舍：发现与全文加载分开；技能文字不等于程序自动执行保证。

核查范围：只读技能查看真实链；计划策略未展开为效果结论。来源：S5。

### 协作

入口与责任链：TeamPipeline._run_assignments。按成员分组，同成员逐次reply_stream，不同成员建并发任务；最终消息的文字/数据转为leader工具结果。

设计取舍：leader只接收提取结果，必须规定证据骨架与验收；不是所有历史自动回流。

核查范围：TeamPipeline的协作路径，默认reset_members在130–147为True。来源：S6, S7。

### 恢复与副作用

入口与责任链：AgentState等待工具状态 / 确认事件继续。已有结果的调用被排除；有待确认或外部执行时退出等待，之后按事件继续。

设计取舍：显式等待减少重复派发机会，但远端动作是否已发生仍需业务编号。

核查范围：运行状态恢复边界；未核对应用数据库的崩溃持久性。来源：S8。

### 权限与信任

入口与责任链：_execute_tool_call → _check_permission。先取得PermissionEngine决定；ASK/PASSTHROUGH改状态并发确认事件，DENY形成拒绝结果，ALLOW才进入执行或外部提交。

设计取舍：权限判断先于动作，模型输入隔离仍不能代替服务端权限。

核查范围：策略由Toolkit/PermissionEngine与中间层共同决定，未给出安全成功率。来源：S9。

### 预算

入口与责任链：ReActConfig.max_iters / structured_output_grace_iters。达到普通迭代上限后，可强制结构化工具并允许配置的grace iterations，最终超限结束。

设计取舍：名义轮数和结构化收尾轮数不同，全树费用还需上层账本。

核查范围：实际条件代码，未推断远程模型计费。来源：S10。

### 评测

入口与责任链：成员finished_reason → 工具结果映射。COMPLETED与EXCEED_MAX_ITERS均映射SUCCESS；因此leader收到工具成功不能独自证明成员完成目标。

设计取舍：需要独立验收发现、证据与覆盖范围。

核查范围：评测维本轮核对的是完成声明边界；独立benchmark框架未核对，不断言不存在。来源：S11。

### 本仓来源

- S1：[本地 agentscope/src/agentscope/agent/_agent.py#L288-L360](../../agentscope/src/agentscope/agent/_agent.py#L288-L360) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/agent/_agent.py#L288-L360)。
- S2：[本地 agentscope/src/agentscope/agent/_agent.py#L3236-L3272](../../agentscope/src/agentscope/agent/_agent.py#L3236-L3272) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/agent/_agent.py#L3236-L3272)。
- S3：[本地 agentscope/src/agentscope/middleware/_longterm_memory/_agentic_memory/_middleware.py#L513-L566](../../agentscope/src/agentscope/middleware/_longterm_memory/_agentic_memory/_middleware.py#L513-L566) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/middleware/_longterm_memory/_agentic_memory/_middleware.py#L513-L566)。
- S4：[本地 agentscope/src/agentscope/middleware/_longterm_memory/_agentic_memory/_middleware.py#L709-L749](../../agentscope/src/agentscope/middleware/_longterm_memory/_agentic_memory/_middleware.py#L709-L749) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/middleware/_longterm_memory/_agentic_memory/_middleware.py#L709-L749)。
- S5：[本地 agentscope/src/agentscope/tool/_builtin/_skill.py#L90-L127](../../agentscope/src/agentscope/tool/_builtin/_skill.py#L90-L127) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/tool/_builtin/_skill.py#L90-L127)。
- S6：[本地 agentscope/src/agentscope/pipeline/_team_pipeline.py#L284-L346](../../agentscope/src/agentscope/pipeline/_team_pipeline.py#L284-L346) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/pipeline/_team_pipeline.py#L284-L346)。
- S7：[本地 agentscope/src/agentscope/pipeline/_team_pipeline.py#L130-L147](../../agentscope/src/agentscope/pipeline/_team_pipeline.py#L130-L147) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/pipeline/_team_pipeline.py#L130-L147)。
- S8：[本地 agentscope/src/agentscope/agent/_agent.py#L3502-L3542](../../agentscope/src/agentscope/agent/_agent.py#L3502-L3542) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/agent/_agent.py#L3502-L3542)。
- S9：[本地 agentscope/src/agentscope/agent/_agent.py#L2513-L2604](../../agentscope/src/agentscope/agent/_agent.py#L2513-L2604) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/agent/_agent.py#L2513-L2604)。
- S10：[本地 agentscope/src/agentscope/agent/_agent.py#L3575-L3624](../../agentscope/src/agentscope/agent/_agent.py#L3575-L3624) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/agent/_agent.py#L3575-L3624)。
- S11：[本地 agentscope/src/agentscope/pipeline/_team_pipeline.py#L102-L107](../../agentscope/src/agentscope/pipeline/_team_pipeline.py#L102-L107) · [固定源码](https://github.com/agentscope-ai/agentscope/blob/976e2ffc9c28869282bbcdde9a2661c48147ff3b/src/agentscope/pipeline/_team_pipeline.py#L102-L107)。

## crewai

类型：任务/Crew/Flow组织框架。固定提交：`40bb2d3b586e8367d206090cc62df5242206008f`。

当前快照已有统一Memory与Flow执行器；流程、任务guardrail和可选checkpoint分工，不能套用旧版记忆分类。

### 行动循环与工具/MCP

入口与责任链：Crew.kickoff → prepare_kickoff → process。应用以inputs启动Crew，按process运行任务；MCPNativeTool把同步调用适配为异步客户端请求（tools/mcp_native_tool.py 83–112）。

设计取舍：任务组织减少手写调度，工具业务语义仍来自接入函数。

核查范围：同步主入口与MCP适配；kickoff_async为另一个应用入口。来源：S1, S2。

### 上下文

入口与责任链：_prepare_tool_result_for_context。仅在成功、不是reader/result_as_answer、better compaction开启且超阈值时把结果存artifact并注册读取工具。

设计取舍：保留可回查原文但多一次读取；不能宣称全部结果无条件外置。

核查范围：按该分支全部条件限定。来源：S3。

### 记忆

入口与责任链：Memory.remember / recall。写入通过串行save pool；recall先drain_writes再搜索，默认deep通过RecallFlow，小范围shallow直接向量搜索（686–724）。

设计取舍：读屏障减少读到未落盘写入，deep检索又增加模型与路由成本；语义正确性另验。

核查范围：Crew.memory=True才构造默认Memory，或调用者提供Memory/Scope/Slice。来源：S4, S5, S6。

### 规划与Skills

入口与责任链：CrewPlanner._handle_crew_planning。规划器建立规划Agent和任务，execute_sync后要求PlannerTaskPydanticOutput才接受。

设计取舍：结构化计划便于传递，但多一个规划模型不保证后续步骤适用。

核查范围：planning显式启用；此处核对规划，不冒充SKILL.md标准能力。来源：S7。

### 协作

入口与责任链：sequential / hierarchical process。顺序流程直接执行任务；分层流程建立manager与delegation工具，再执行任务；已有manager不得任意带其他tools。

设计取舍：管理者集中分配，需额外规划与核对；顺序任务更直接。

核查范围：Crew组织层，非所有Flow/Agent适配模式总览。来源：S8。

### 恢复与副作用

入口与责任链：kickoff(from_checkpoint) / from_checkpoint。apply_checkpoint可返回恢复后的Crew再kickoff；恢复起点按任务output状态选择（1563–1569）。

设计取舍：任务状态持久化有用，但已执行外部动作需单独去重与核实。

核查范围：checkpoint显式配置，不声称外部服务事务。来源：S9, S10。

### 权限与信任

入口与责任链：before_tool_call hooks。工具执行前构建hook context；命中阻止时返回blocked结果并继续发after hook，不调用业务tool_usage。

设计取舍：可插入任务权限策略，但默认hook是否配置与服务真实授权仍需应用决定。

核查范围：实读文本工具路径；不把指纹SecurityConfig当通用沙箱。来源：S11。

### 预算

入口与责任链：AgentExecutor.max_iter。执行器max_iter默认25，setup把Flow的max_method_calls设为max_iter*10。

设计取舍：Agent迭代与Flow方法调用是两个单位，任务guardrail重试又会额外耗费。

核查范围：固定字段与设置代码，不是全Crew费用上限。来源：S12。

### 评测

入口与责任链：Task._invoke_guardrail_function。对输出执行guardrail，按guardrail_max_retries控制重试，并累积之前被阻止尝试的tool_failures。

设计取舍：结果检查可触发修订，但反复执行任务可能重新触发业务动作。

核查范围：可选task guardrail；未运行其评分或宣称模型判断正确。来源：S13。

### 本仓来源

- S1：[本地 crewai/lib/crewai/src/crewai/crew.py#L995-L1055](../../crewai/lib/crewai/src/crewai/crew.py#L995-L1055) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/crew.py#L995-L1055)。
- S2：[本地 crewai/lib/crewai/src/crewai/tools/mcp_native_tool.py#L83-L112](../../crewai/lib/crewai/src/crewai/tools/mcp_native_tool.py#L83-L112) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/tools/mcp_native_tool.py#L83-L112)。
- S3：[本地 crewai/lib/crewai/src/crewai/agents/agent_executor.py#L296-L342](../../crewai/lib/crewai/src/crewai/agents/agent_executor.py#L296-L342) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/agents/agent_executor.py#L296-L342)。
- S4：[本地 crewai/lib/crewai/src/crewai/memory/unified_memory.py#L435-L451](../../crewai/lib/crewai/src/crewai/memory/unified_memory.py#L435-L451) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/memory/unified_memory.py#L435-L451)。
- S5：[本地 crewai/lib/crewai/src/crewai/memory/unified_memory.py#L686-L724](../../crewai/lib/crewai/src/crewai/memory/unified_memory.py#L686-L724) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/memory/unified_memory.py#L686-L724)。
- S6：[本地 crewai/lib/crewai/src/crewai/crew.py#L656-L690](../../crewai/lib/crewai/src/crewai/crew.py#L656-L690) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/crew.py#L656-L690)。
- S7：[本地 crewai/lib/crewai/src/crewai/utilities/planning_handler.py#L57-L94](../../crewai/lib/crewai/src/crewai/utilities/planning_handler.py#L57-L94) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/utilities/planning_handler.py#L57-L94)。
- S8：[本地 crewai/lib/crewai/src/crewai/crew.py#L1522-L1561](../../crewai/lib/crewai/src/crewai/crew.py#L1522-L1561) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/crew.py#L1522-L1561)。
- S9：[本地 crewai/lib/crewai/src/crewai/crew.py#L995-L1015](../../crewai/lib/crewai/src/crewai/crew.py#L995-L1015) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/crew.py#L995-L1015)。
- S10：[本地 crewai/lib/crewai/src/crewai/crew.py#L1563-L1569](../../crewai/lib/crewai/src/crewai/crew.py#L1563-L1569) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/crew.py#L1563-L1569)。
- S11：[本地 crewai/lib/crewai/src/crewai/utilities/tool_utils.py#L113-L145](../../crewai/lib/crewai/src/crewai/utilities/tool_utils.py#L113-L145) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/utilities/tool_utils.py#L113-L145)。
- S12：[本地 crewai/lib/crewai/src/crewai/agents/agent_executor.py#L202-L262](../../crewai/lib/crewai/src/crewai/agents/agent_executor.py#L202-L262) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/agents/agent_executor.py#L202-L262)。
- S13：[本地 crewai/lib/crewai/src/crewai/task.py#L1327-L1384](../../crewai/lib/crewai/src/crewai/task.py#L1327-L1384) · [固定源码](https://github.com/crewAIInc/crewAI/blob/40bb2d3b586e8367d206090cc62df5242206008f/lib/crewai/src/crewai/task.py#L1327-L1384)。

## agno

类型：Agent/Team/Session一体框架。固定提交：`6e434823383280f33465121d3eeedeada2ff27d3`。

运行先载会话、依赖和工具；记忆、知识、历史、Skills和审批分属不同组件，后台更新与当前输入要分别追踪。

### 行动循环与工具/MCP

入口与责任链：Agent.run/arun → _run/_arun。每次尝试载入会话与session_state、解析依赖、运行pre_hooks再确定模型工具；Agent门面转交运行模块。

设计取舍：完整应用装配减少接线，但重试可能重进多段运行阶段。

核查范围：实读同步主路径；MCP工具另在tools/mcp/mcp.py，本轮未审计其网络生命周期。来源：S1。

### 上下文

入口与责任链：history/session_state/knowledge配置。会话状态可持久，是否加入上下文另有add_session_state_to_context；历史条数与知识检索配置独立。

设计取舍：拥有状态不等于当前模型看到状态，窗口/检索仍需分配。

核查范围：字段与_run载入状态链实读；本轮未展开全部消息压缩分支。来源：S2。

### 记忆

入口与责任链：make_memories → MemoryManager.create_user_memories。只有memory_manager存在且update_memory_on_run开启时，用户内容与extra_messages进入创建记忆流程，按user_id/agent_id关联。

设计取舍：自动提炼降低用户整理负担，但会引入归纳错误和更新完成时间。

核查范围：启用条件明确，不把knowledge库当同一种用户记忆。来源：S3。

### 规划与Skills

入口与责任链：get_skill_instructions/reference/script。Skills先提供元数据，再公开三个读取/脚本工具；脚本默认读取，execute=True才运行。

设计取舍：渐进披露减少常驻全文，脚本执行仍需业务权限边界。

核查范围：调用者提供loaders/skills，不声称每Agent都默认安装。来源：S4。

### 协作

入口与责任链：Team任务模式_run_tasks。团队运行加载session、hooks与task管理工具，leader迭代规划和委派，TeamSession承载运行材料。

设计取舍：可用任务模式组织多成员，但成员证据与总目标仍需明确。

核查范围：仅task mode准备链；其他Team模式未用同一结论概括。来源：S5。

### 恢复与副作用

入口与责任链：handle_agent_run_paused / continue_run_dispatch。暂停先写RunStatus.paused、建立approval，再cleanup_and_store；继续入口按已保存run上下文接续。

设计取舍：人工等待可以保存，不等于已发生外部动作被撤销或可盲重试。

核查范围：本轮核对pause保存与继续入口，未模拟服务崩溃。来源：S6。

### 权限与信任

入口与责任链：create_approval_from_pause。需要确认/外部完成的工具让运行停在有编号的审批状态，记录入数据库后等待继续。

设计取舍：宿主能将权限决定与模型文字分离，但业务服务仍需限制资源。

核查范围：仅需要确认的工具配置，不是所有工具默认询问。来源：S7。

### 预算

入口与责任链：retries+1尝试循环。运行尝试数由agent.retries+1控制；tool_call_limit另为工具限制，不能从运行重试数推断全树调用额。

设计取舍：整次重试与单工具重试成本/副作用不同，要关联业务编号。

核查范围：只核对本段重试及Agent字段，不给出全局硬额度承诺。来源：S8。

### 评测

入口与责任链：ReliabilityEval._evaluate。工具预期只由无tool_call_error且未paused的实际执行满足；历史消息请求不充当本轮执行，Team递归收集成员证据。

设计取舍：比请求匹配更贴近已执行动作，但仍不能替代报表内容验收。

核查范围：可靠性工具证据检查，不是所有质量评测的总称。来源：S9。

### 本仓来源

- S1：[本地 agno/libs/agno/agno/agent/_run.py#L425-L501](../../agno/libs/agno/agno/agent/_run.py#L425-L501) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/agent/_run.py#L425-L501)。
- S2：[本地 agno/libs/agno/agno/agent/agent.py#L99-L184](../../agno/libs/agno/agno/agent/agent.py#L99-L184) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/agent/agent.py#L99-L184)。
- S3：[本地 agno/libs/agno/agno/agent/_managers.py#L29-L81](../../agno/libs/agno/agno/agent/_managers.py#L29-L81) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/agent/_managers.py#L29-L81)。
- S4：[本地 agno/libs/agno/agno/skills/agent_skills.py#L150-L185](../../agno/libs/agno/agno/skills/agent_skills.py#L150-L185) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/skills/agent_skills.py#L150-L185)。
- S5：[本地 agno/libs/agno/agno/team/_run.py#L236-L297](../../agno/libs/agno/agno/team/_run.py#L236-L297) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/team/_run.py#L236-L297)。
- S6：[本地 agno/libs/agno/agno/agent/_run.py#L236-L257](../../agno/libs/agno/agno/agent/_run.py#L236-L257) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/agent/_run.py#L236-L257)。
- S7：[本地 agno/libs/agno/agno/agent/_run.py#L247-L252](../../agno/libs/agno/agno/agent/_run.py#L247-L252) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/agent/_run.py#L247-L252)。
- S8：[本地 agno/libs/agno/agno/agent/_run.py#L425-L439](../../agno/libs/agno/agno/agent/_run.py#L425-L439) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/agent/_run.py#L425-L439)。
- S9：[本地 agno/libs/agno/agno/eval/reliability.py#L119-L164](../../agno/libs/agno/agno/eval/reliability.py#L119-L164) · [固定源码](https://github.com/agno-agi/agno/blob/6e434823383280f33465121d3eeedeada2ff27d3/libs/agno/agno/eval/reliability.py#L119-L164)。

## camel

类型：研究/多Agent与工具框架。固定提交：`e5e55256e9446f744bf7309c478b084587dbf985`。

ChatAgent自己组织模型和工具循环，Workforce另调度任务；聊天/向量记忆、外部工具请求与重试都存在明确接缝。

### 行动循环与工具/MCP

入口与责任链：ChatAgent.step/astep → 内部工具执行。模型工具请求先记录，再将内部工具直接执行，外部工具请求保留后退出循环交调用方；to_mcp另包装Agent入口。

设计取舍：分清谁执行很重要：外部请求返回不代表外部动作完成。

核查范围：同步step实读；MCP对外包装在6408–6542单独范围。来源：S1。

### 上下文

入口与责任链：_get_context_with_summarization。memory.get_context给候选消息和token计数；满足阈值时生成摘要并更新memory，再取得上下文。

设计取舍：摘要更新会改变后续证据表示，需留来源与关键约束。

核查范围：summarize_threshold为可选配置，不能宣称所有会话默认摘要。来源：S2。

### 记忆

入口与责任链：LongtermAgentMemory.retrieve/write_records。组合实现将记录写入聊天和向量块；读取把当前主题向量候选插入聊天记录，主题来自用户消息。

设计取舍：历史与召回可并存，但向量相似不是事实有效性，重复/冲突还需应用策略。

核查范围：明确是LongtermAgentMemory组合实现，非所有Agent默认memory。来源：S3。

### 规划与Skills

入口与责任链：Workforce REPLAN恢复。质量或执行失败的恢复决策可以修改task.content后重新调度；RETRY则把同任务重新发给原worker。

设计取舍：计划可随证据修改，但需要防止任务语义漂移与重复副作用。

核查范围：实读恢复中重规划，不据此宣称标准Skills协议。来源：S4。

### 协作

入口与责任链：Workforce任务恢复调度。调度器根据task与recovery_decision选择继续原worker或后续重规划路径，任务身份在Task中保留。

设计取舍：调度有控制点，但工作者独立结论仍需协调与验收。

核查范围：Workforce层，不与ChatAgent内部循环混计。来源：S5。

### 恢复与副作用

入口与责任链：load_memory/load_memory_from_path/save_memory。可加载AgentMemory或JSON记录并写回当前memory；记录带agent_id并校验形状。

设计取舍：恢复聊天资料不同于恢复外部世界；重新step可能重做工具。

核查范围：会话记忆存取边界，未证明完整Workforce崩溃恢复。来源：S6。

### 权限与信任

入口与责任链：_execute_tool / mask_tool_output。内部工具按注册名直接调用，异常转文字；可将原始结果锁存并仅给模型已执行提示。

设计取舍：输出遮蔽减少暴露，不是执行授权；有风险动作需要工具适配层管控。

核查范围：仅所读内部工具路径，不断言仓库无其他安全机制。来源：S7。

### 预算

入口与责任链：max_iteration/stop_event/terminators。循环检查stop_event，工具轮数达到max_iteration后停止；无工具时还可由response_terminators决定终止。

设计取舍：轮数上限与多工具执行量不同，停本地循环不能撤销外部请求。

核查范围：默认max_iteration可为None，是否限额由调用者配置。来源：S8。

### 评测

入口与责任链：GAIABenchmark.run。benchmark入口校验数据集split与level，选择任务子集后运行评测；这与Agent的终止器是分离组件。

设计取舍：离线数据集便于可重复比较，但需要固定任务/模型，不能当生产任务验收。

核查范围：仅源码读取GAIA适配与输入校验，未下载数据或运行benchmark。来源：S9。

### 本仓来源

- S1：[本地 camel/camel/agents/chat_agent.py#L3077-L3129](../../camel/camel/agents/chat_agent.py#L3077-L3129) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/agents/chat_agent.py#L3077-L3129)。
- S2：[本地 camel/camel/agents/chat_agent.py#L1032-L1066](../../camel/camel/agents/chat_agent.py#L1032-L1066) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/agents/chat_agent.py#L1032-L1066)。
- S3：[本地 camel/camel/memories/agent_memories.py#L247-L306](../../camel/camel/memories/agent_memories.py#L247-L306) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/memories/agent_memories.py#L247-L306)。
- S4：[本地 camel/camel/societies/workforce/workforce.py#L1850-L1883](../../camel/camel/societies/workforce/workforce.py#L1850-L1883) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/societies/workforce/workforce.py#L1850-L1883)。
- S5：[本地 camel/camel/societies/workforce/workforce.py#L1828-L1859](../../camel/camel/societies/workforce/workforce.py#L1828-L1859) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/societies/workforce/workforce.py#L1828-L1859)。
- S6：[本地 camel/camel/agents/chat_agent.py#L1716-L1780](../../camel/camel/agents/chat_agent.py#L1716-L1780) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/agents/chat_agent.py#L1716-L1780)。
- S7：[本地 camel/camel/agents/chat_agent.py#L4101-L4149](../../camel/camel/agents/chat_agent.py#L4101-L4149) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/agents/chat_agent.py#L4101-L4149)。
- S8：[本地 camel/camel/agents/chat_agent.py#L3062-L3140](../../camel/camel/agents/chat_agent.py#L3062-L3140) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/agents/chat_agent.py#L3062-L3140)。
- S9：[本地 camel/camel/benchmarks/gaia.py#L203-L247](../../camel/camel/benchmarks/gaia.py#L203-L247) · [固定源码](https://github.com/camel-ai/camel/blob/e5e55256e9446f744bf7309c478b084587dbf985/camel/benchmarks/gaia.py#L203-L247)。

## llama-index

类型：检索与Agent工作流框架。固定提交：`619d74664e8404612038bc15a1a40c686037277c`。

AgentWorkflow以事件推进步骤和工具汇聚，Context store持当前Agent与memory；检索集成和长记忆块是可组合能力，不是一个默认全集。

### 行动循环与工具/MCP

入口与责任链：AgentWorkflow.run → run_agent_step → agent.take_step。工作流从Context取得memory和当前Agent，取固定/检索工具，再把输入交给take_step。MCPToolSpec另外把list_tools转换FunctionTool。

设计取舍：检索工具可缩小目录，但每次选择与返回还需跟踪。

核查范围：AgentWorkflow主线与可选MCP集成；不代表旧AgentRunner全部接口。来源：S1, S2。

### 上下文

入口与责任链：Memory.aget。从sql_store取ACTIVE历史，向各memory block取内容，按token预算裁剪、格式化后插入消息。

设计取舍：业务原文、归档和本轮输入不同，块优先级影响最终可见内容。

核查范围：这是新Memory组件；AgentWorkflow默认在269–276另用ChatMemoryBuffer。来源：S3, S4。

### 记忆

入口与责任链：Memory._manage_queue。活动消息超配额后按FIFO组织待flush消息，并保持至少一份消息/相关对话结构，归档与memory blocks承接。

设计取舍：长期材料可与短期队列分工，但flush不等于提炼正确事实。

核查范围：显式Memory及可选blocks，不能写成默认每Agent都有事实提炼。来源：S5。

### 规划与Skills

入口与责任链：ReActAgent.take_step。从ctx.store读current_reasoning，与工具和聊天历史一起格式化下一次输入；解析后的推理/行动再写回。

设计取舍：工作草稿可以连续推进，但不是已经验证的业务计划。

核查范围：ReAct路径；标准Skills加载未在本轮核对，不判不存在。来源：S6, S7。

### 协作

入口与责任链：handoff / aggregate_tool_results。handoff校验目标及can_handoff_to后设置next_agent，汇聚工具结果时切换current_agent_name。

设计取舍：明确控制权转移，但不自动保证原协调者回来验收。

核查范围：同一工作流handoff，不与并行委派混写。来源：S8, S9。

### 恢复与副作用

入口与责任链：_call_tool异常边界 / run(ctx=...)。普通工具异常转is_error输出；等待事件异常透传；run允许复用Context，但Context实现由外部workflows依赖提供。

设计取舍：接续工作流状态与重做业务动作必须分开，持久化保证需继续固定外部依赖。

核查范围：明确未追外部workflows包内部恢复，不从兼容导入文件造实现。来源：S10, S11。

### 权限与信任

入口与责任链：MCPToolSpec.fetch_tools(allowed_tools)。allowed_tools为None时列全部，非空则按名称过滤，空列表返回空工具；调用闭包交client.call_tool。

设计取舍：工具可见范围是第一层限制，业务服务授权仍独立。

核查范围：可选集成包，未把allowlist当细粒度业务权限。来源：S12。

### 预算

入口与责任链：parse_agent_output max_iterations。每次Agent输出增加num_iterations，达到上限按early_stopping_method生成收尾或抛WorkflowRuntimeError。

设计取舍：计的是Agent步输出，工具数量和token仍需另记。

核查范围：默认force，generate为显式选择；非全局金额。来源：S13。

### 评测

入口与责任链：CorrectnessEvaluator.aevaluate。用query/response/reference调用评审LLM，解析score和reasoning，再按阈值给passing；该实现显式忽略contexts参数。

设计取舍：评审输出可比较答案，但不能凭接口参数以为检查了引用材料。

核查范围：可选答案评测；未运行或推导任务成功率。来源：S14。

### 本仓来源

- S1：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L467-L482](../../llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L467-L482) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L467-L482)。
- S2：[本地 llama-index/llama-index-integrations/tools/llama-index-tools-mcp/llama_index/tools/mcp/base.py#L126-L163](../../llama-index/llama-index-integrations/tools/llama-index-tools-mcp/llama_index/tools/mcp/base.py#L126-L163) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-integrations/tools/llama-index-tools-mcp/llama_index/tools/mcp/base.py#L126-L163)。
- S3：[本地 llama-index/llama-index-core/llama_index/core/memory/memory.py#L624-L670](../../llama-index/llama-index-core/llama_index/core/memory/memory.py#L624-L670) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/memory/memory.py#L624-L670)。
- S4：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L269-L276](../../llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L269-L276) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L269-L276)。
- S5：[本地 llama-index/llama-index-core/llama_index/core/memory/memory.py#L672-L729](../../llama-index/llama-index-core/llama_index/core/memory/memory.py#L672-L729) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/memory/memory.py#L672-L729)。
- S6：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/react_agent.py#L121-L153](../../llama-index/llama-index-core/llama_index/core/agent/workflow/react_agent.py#L121-L153) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/react_agent.py#L121-L153)。
- S7：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/react_agent.py#L264-L291](../../llama-index/llama-index-core/llama_index/core/agent/workflow/react_agent.py#L264-L291) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/react_agent.py#L264-L291)。
- S8：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L73-L92](../../llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L73-L92) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L73-L92)。
- S9：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L709-L750](../../llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L709-L750) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L709-L750)。
- S10：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L348-L379](../../llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L348-L379) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L348-L379)。
- S11：[本地 llama-index/llama-index-core/llama_index/core/workflow/context.py#L1](../../llama-index/llama-index-core/llama_index/core/workflow/context.py#L1) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/workflow/context.py#L1)。
- S12：[本地 llama-index/llama-index-integrations/tools/llama-index-tools-mcp/llama_index/tools/mcp/base.py#L53-L74](../../llama-index/llama-index-integrations/tools/llama-index-tools-mcp/llama_index/tools/mcp/base.py#L53-L74) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-integrations/tools/llama-index-tools-mcp/llama_index/tools/mcp/base.py#L53-L74)。
- S13：[本地 llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L524-L547](../../llama-index/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L524-L547) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/agent/workflow/multi_agent_workflow.py#L524-L547)。
- S14：[本地 llama-index/llama-index-core/llama_index/core/evaluation/correctness.py#L120-L153](../../llama-index/llama-index-core/llama_index/core/evaluation/correctness.py#L120-L153) · [固定源码](https://github.com/run-llama/llama_index/blob/619d74664e8404612038bc15a1a40c686037277c/llama-index-core/llama_index/core/evaluation/correctness.py#L120-L153)。

## mastra

类型：TypeScript Agent/工作流与存储框架。固定提交：`f8cb6873cfa2848c8fdd374454476ed49f173a33`。

Agent把请求、作用域、处理器、工具循环与Memory组合；当前版本具备持久化分支，必须区分普通与durable执行。

### 行动循环与工具/MCP

入口与责任链：Agent.generate/stream → loop；durable分支另路由。generate先解析durable分支、校验requestContext、合并options/作用域并做执行FGA，再解析模型。

设计取舍：丰富生命周期便于应用接入，但方法返回与业务完成仍需拆开。

核查范围：非legacy generate主线；MCP工具类型不等于所有客户端网络生命周期已审计。来源：S1。

### 上下文

入口与责任链：getSkillsProcessors / 配置processors。系统解析Agent/workspace技能，若已有eager/on-demand处理器则不重复添加，否则返回SkillsProcessor。

设计取舍：处理器顺序和动态配置会改变模型输入，不能仅看Agent构造参数。

核查范围：实读技能处理器接入；未穷尽全部输入输出处理器。来源：S2。

### 记忆

入口与责任链：Memory.recall。合并thread config，决定历史与semantic recall；资源范围检索要求resourceId，向量查询显式带resource/thread过滤。

设计取舍：历史与语义召回可共存，但范围标识必须来自可信宿主，内容仍需有效期判断。

核查范围：memory需配置；semantic recall还依赖vector/query，不当默认永远启用。来源：S3。

### 规划与Skills

入口与责任链：submitPlanTool.execute。内置工具接收计划文件路径，按resumeData处理批准/拒绝，暂停与读取呈现由宿主协同。

设计取舍：计划文本可先审阅，但批准计划不等于任意后续业务动作授权。

核查范围：可选内置计划工具，不是每Agent默认自动审批。来源：S4。

### 协作

入口与责任链：Agent.network → networkLoop。network解析默认/调用级routing和completion，固定运行作用域，再交networkLoop由routingAgent组织。

设计取舍：协调策略可组合，跨Agent资料/权限仍需按scope传递。

核查范围：网络入口准备链，不以此证明所有子调用共享硬预算。来源：S5。

### 恢复与副作用

入口与责任链：resumeGenerate。durable时路由durable resume；普通路径按runId载入agentic-loop snapshot并解析恢复作用域。

设计取舍：持久等待有状态依据，但工具副作用仍需要业务幂等和结果核实。

核查范围：分别说明两种执行路径，不泛化为Exactly-once。来源：S6。

### 权限与信任

入口与责任链：executeToolCall异常分类。授权FGADeniedError透传使运行失败，不把它转为供LLM重试的普通工具错误；abort则留下未完成状态。

设计取舍：拒绝与可恢复错误分流能保住边界，授权来源和细粒度策略仍须配置。

核查范围：共享实际执行段；审批/suspend另在引擎层。来源：S7。

### 预算

入口与责任链：continuation判定 maxSteps/stopWhen。只有仍可继续且未超maxSteps才评stopWhen；委派bail为硬停；迭代feedback仍受预算上限。

设计取舍：反馈修订不能无限绕过有限步数，但全网络消费需另汇总。

核查范围：共享循环判定，不将maxSteps换算费用。来源：S8。

### 评测

入口与责任链：runScorer。运行评分先检查trace是否被丢弃，再按filter筛选、按traceId/runId确定性采样；错误filter与未知采样类型跳过评分。

设计取舍：采样可控成本，但没有分数可能是未选中而不是任务合格。

核查范围：配置scorers后运行的hook链，未运行真实评分。来源：S9。

### 本仓来源

- S1：[本地 mastra/packages/core/src/agent/agent.ts#L9358-L9406](../../mastra/packages/core/src/agent/agent.ts#L9358-L9406) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/agent/agent.ts#L9358-L9406)。
- S2：[本地 mastra/packages/core/src/agent/agent.ts#L1774-L1795](../../mastra/packages/core/src/agent/agent.ts#L1774-L1795) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/agent/agent.ts#L1774-L1795)。
- S3：[本地 mastra/packages/memory/src/index.ts#L775-L927](../../mastra/packages/memory/src/index.ts#L775-L927) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/memory/src/index.ts#L775-L927)。
- S4：[本地 mastra/packages/core/src/tools/builtin/submit-plan.ts#L67-L124](../../mastra/packages/core/src/tools/builtin/submit-plan.ts#L67-L124) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/tools/builtin/submit-plan.ts#L67-L124)。
- S5：[本地 mastra/packages/core/src/agent/agent.ts#L9143-L9186](../../mastra/packages/core/src/agent/agent.ts#L9143-L9186) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/agent/agent.ts#L9143-L9186)。
- S6：[本地 mastra/packages/core/src/agent/agent.ts#L10736-L10768](../../mastra/packages/core/src/agent/agent.ts#L10736-L10768) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/agent/agent.ts#L10736-L10768)。
- S7：[本地 mastra/packages/core/src/loop/shared/steps/execute-tool-core.ts#L73-L110](../../mastra/packages/core/src/loop/shared/steps/execute-tool-core.ts#L73-L110) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/loop/shared/steps/execute-tool-core.ts#L73-L110)。
- S8：[本地 mastra/packages/core/src/loop/shared/continuation-core.ts#L141-L187](../../mastra/packages/core/src/loop/shared/continuation-core.ts#L141-L187) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/loop/shared/continuation-core.ts#L141-L187)。
- S9：[本地 mastra/packages/core/src/evals/hooks.ts#L23-L119](../../mastra/packages/core/src/evals/hooks.ts#L23-L119) · [固定源码](https://github.com/mastra-ai/mastra/blob/f8cb6873cfa2848c8fdd374454476ed49f173a33/packages/core/src/evals/hooks.ts#L23-L119)。

## openclaw

类型：多渠道Agent宿主与插件运行系统。固定提交：`ec38f535d3d5de9e087d834fe58e6190852fcb2a`。

本次快照的执行已按harness和逻辑turn组织；memory-core、Skills、委派、审批等通过宿主策略和插件契约组合。

### 行动循环与工具/MCP

入口与责任链：runEmbeddedAgentEntry。入口校验worker选择、会话placement和prepared admission，运行候选后才settle requester；底层harness按运行配置选择。

设计取舍：逻辑turn与具体模型候选分开，失败切换必须保留已提交工作的事实。

核查范围：一条宿主运行主链；MCP在agent-bundle-mcp-tools另有独立物化门面。来源：S1, S2。

### 上下文

入口与责任链：resolveContextInjectionMode / hasCompletedBootstrapTurn。注入模式有always、continuation-skip、never；有效分支遇compaction/reset不复用旧full-bootstrap标记。

设计取舍：稳定前缀可减少重复输入，但压缩/重置必须重判来源与注入边界。

核查范围：仅bootstrap资料注入路径，非全部harness上下文实现。来源：S3。

### 记忆

入口与责任链：memory_search → manager查询；memory_get另读片段。memory-core插件注册检索能力和工具，写入精选记忆另用文件；搜索校验corpus，未启用session来源时拒绝扩大。

设计取舍：文件、索引、检索片段和当前输入分离；搜索范围也必须受宿主配置控制。

核查范围：memory-core插件路径，非所有宿主安装配置默认；intent为另外注册能力。来源：S4, S5。

### 规划与Skills

入口与责任链：buildSkillsSection。根据列出的目录、code mode与已安装技能搜索/读取工具生成提示；无匹配时不凭空构造路径。

设计取舍：目录发现与全文读取分开，提示指导本身不是执行正确保证。

核查范围：已安装skills及能力条件，搜索不等于安装。来源：S6。

### 协作

入口与责任链：spawnSubagentDirect → resolveSubagentSpawnRequest。捕获当前会话归属，解析子任务模式、深度、超时与reservation后准备委派策略和创建子会话。

设计取舍：异步子会话需明确所有权/回传与清理，不能当函数调用后自动完成。

核查范围：sessions spawn一条实现链，非所有远程协作协议。来源：S7。

### 恢复与副作用

入口与责任链：canFallback committedSideEffect/deliveryEvidence。command-rpc已提交副作用或channel已有交付证据时，fallback不能无条件继续候选。

设计取舍：提供防重复决策位置，但所有远端服务是否去重仍取决于服务契约。

核查范围：仅该运行类型的候选fallback保护，不宣称通用事务。来源：S8。

### 权限与信任

入口与责任链：applyToolPolicyPipeline。工具列表按configured policy layers逐层过滤，并可发审计事件；memory corpus另有运行时闭枚举校验。

设计取舍：减少可见工具和约束可执行动作属于不同边界，还要核对适配器执行权限。

核查范围：可见工具过滤实际代码；未运行攻击实验。来源：S9。

### 预算

入口与责任链：createAgentHarnessAttemptDeadlineController。执行与settlement采用各自绝对期限；执行elapsed用单调时钟，超时回调受当前deadline/signal约束。

设计取舍：等待结算也要预算，墙钟时间上限不等于token或跨子树金额。

核查范围：harness单attempt控制器，不推断全树额度。来源：S10。

### 评测

入口与责任链：runScenarioFlow → assert action。QA扩展在运行flow中求assert表达式，不满足则抛出带场景信息的错误。

设计取舍：可检查明确机制条件，但场景声明覆盖不等于真实产品能力已经通过。

核查范围：可选qa-lab测试基础设施；本轮只读未执行scenario。来源：S11。

### 本仓来源

- S1：[本地 openclaw/src/agents/embedded-agent-runner/run-entry.ts#L75-L108](../../openclaw/src/agents/embedded-agent-runner/run-entry.ts#L75-L108) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/embedded-agent-runner/run-entry.ts#L75-L108)。
- S2：[本地 openclaw/src/agents/agent-bundle-mcp-tools.ts#L1-L15](../../openclaw/src/agents/agent-bundle-mcp-tools.ts#L1-L15) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/agent-bundle-mcp-tools.ts#L1-L15)。
- S3：[本地 openclaw/src/agents/bootstrap-files.ts#L55-L93](../../openclaw/src/agents/bootstrap-files.ts#L55-L93) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-files.ts#L55-L93)。
- S4：[本地 openclaw/extensions/memory-core/src/tools.ts#L213-L268](../../openclaw/extensions/memory-core/src/tools.ts#L213-L268) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/tools.ts#L213-L268)。
- S5：[本地 openclaw/extensions/memory-core/index.ts#L315-L372](../../openclaw/extensions/memory-core/index.ts#L315-L372) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/index.ts#L315-L372)。
- S6：[本地 openclaw/src/agents/system-prompt-skills.ts#L3-L36](../../openclaw/src/agents/system-prompt-skills.ts#L3-L36) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/system-prompt-skills.ts#L3-L36)。
- S7：[本地 openclaw/src/agents/subagents/spawn/subagent-spawn.ts#L68-L130](../../openclaw/src/agents/subagents/spawn/subagent-spawn.ts#L68-L130) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/subagents/spawn/subagent-spawn.ts#L68-L130)。
- S8：[本地 openclaw/src/agents/embedded-agent-runner/run-entry.ts#L193-L236](../../openclaw/src/agents/embedded-agent-runner/run-entry.ts#L193-L236) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/embedded-agent-runner/run-entry.ts#L193-L236)。
- S9：[本地 openclaw/src/agents/tool-policy-pipeline.ts#L135-L162](../../openclaw/src/agents/tool-policy-pipeline.ts#L135-L162) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/tool-policy-pipeline.ts#L135-L162)。
- S10：[本地 openclaw/src/agents/harness/attempt-deadlines.ts#L18-L98](../../openclaw/src/agents/harness/attempt-deadlines.ts#L18-L98) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/harness/attempt-deadlines.ts#L18-L98)。
- S11：[本地 openclaw/extensions/qa-lab/src/scenario-flow-runner.ts#L299-L318](../../openclaw/extensions/qa-lab/src/scenario-flow-runner.ts#L299-L318) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/qa-lab/src/scenario-flow-runner.ts#L299-L318)。

## hermes-agent

类型：带工具、记忆与网关的Agent运行系统。固定提交：`e31c674f7c523070f48f3baad0650c2fdd7ef6e5`。

主循环按turn组织，工具分段派发、记忆provider和子任务都拥有生命周期；当前代码里父子预算独立，不能依旧注释想象共享。

### 行动循环与工具/MCP

入口与责任链：AIAgent.run_conversation → _run_conversation_turn。构建turn上下文后循环准备/组装请求/preflight/调用重试；工具批次按读写安全分段顺序执行（run_agent.py 1299–1325）。

设计取舍：并行提高独立读取效率，但状态变更要跨屏障；请求重试不等于业务重做安全。

核查范围：本地默认模型路径；codex_app_server另在1537附近显式分支。来源：S1, S2。

### 上下文

入口与责任链：MemoryManager.build_system_prompt/prefetch_all。provider提供常驻提示块与按query预取，技能脚手架从预取query中剥离；外部预取单独受timeout约束。

设计取舍：常驻、按需与外部调用可分工，但失败/新鲜度不能从记忆写盘推断。

核查范围：provider管理器与内置路径，不把所有外部provider默认开启。来源：S3。

### 记忆

入口与责任链：memory_tool → MemoryStore.add/patch/remove/apply_batch。内置memory工具校验目标与动作，拒绝replace，批次先经过写入门再apply_batch，运行中记录调用结果。

设计取舍：原子写入约束提交一致性，事实真假、生效日期与提示快照仍需另管。

核查范围：内置Markdown精选记忆；MemoryManager可并存其他provider。来源：S4。

### 规划与Skills

入口与责任链：skills_list / skill_view。技能列表按目录扫描提供名称描述，skill_view另读完整正文和关联文件；目录按当前profile解析。

设计取舍：按需加载节省常驻全文，技能的外部动作还须经过工具权限。

核查范围：本轮核对目录与查看入口，不从技能宣传推导任务效果。来源：S5。

### 协作

入口与责任链：delegate_task → child AIAgent。子Agent用独立session DB、parent_session_id、限定工具集与上下文，skip_context_files/skip_memory；顶层模型委派默认背景运行（run_agent.py1335–1349）。

设计取舍：父历史不默认全复制，调用方必须给足子任务约束；回传可能稍后进入消息。

核查范围：显式delegate tool；子角色/工具集和深度有另外配置。来源：S6, S7。

### 恢复与副作用

入口与责任链：ensure_checkpoint / restore。显式启用才对工作目录拍文件检查点；每turn目录去重，过宽目录拒绝；restore safe模式按写入ledger保留用户改动（1118–1157）。

设计取舍：文件回滚可保护工作区，不能回滚已发邮件或远端数据库副作用。

核查范围：本地文件检查点，不与聊天/网关运行恢复混计。来源：S8, S9。

### 权限与信任

入口与责任链：check_all_command_guards。先处理container/用户拒绝与floor，之后才考虑prepared gate、yolo/off、allowlist和人工/smart决策；无人值守按上下文配置决定。

设计取舍：执行前门禁比自然语言提醒更直接，但非交互配置会改变确认行为。

核查范围：终端命令守卫这一真实路径，不宣称所有工具同样审批。来源：S10。

### 预算

入口与责任链：IterationBudget / child fresh budget。构造child显式iteration_budget=None；agent_init为其新建budget，IterationBudget持线程安全consume/refund计数。

设计取舍：父上限不能直接限制父子累计成本；execute_code等退回计数也要解释。

核查范围：代码优先于run_agent构造参数旧注释中的shared说法；不引用互相不一致的默认数。来源：S11, S12, S13。

### 评测

入口与责任链：TASK.grade(ctx) / orchestrator.run_cell。worker收集工作区、事件、工具参数、最终答复和todo后交任务grade；orchestrator独立记录超时和worker异常。

设计取舍：机制评测应保留过程证据，单最终文本不足；harness参数和替身也需披露。

核查范围：仓库自带评测工具源码，只读未运行；不作为本书新实验结果。来源：S14, S15。

### 本仓来源

- S1：[本地 hermes-agent/agent/conversation_loop.py#L1555-L1678](../../hermes-agent/agent/conversation_loop.py#L1555-L1678) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_loop.py#L1555-L1678)。
- S2：[本地 hermes-agent/run_agent.py#L1299-L1325](../../hermes-agent/run_agent.py#L1299-L1325) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/run_agent.py#L1299-L1325)。
- S3：[本地 hermes-agent/agent/memory_manager.py#L501-L525](../../hermes-agent/agent/memory_manager.py#L501-L525) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/memory_manager.py#L501-L525)。
- S4：[本地 hermes-agent/tools/memory_tool.py#L222-L289](../../hermes-agent/tools/memory_tool.py#L222-L289) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L222-L289)。
- S5：[本地 hermes-agent/tools/skills_tool.py#L268-L310](../../hermes-agent/tools/skills_tool.py#L268-L310) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/skills_tool.py#L268-L310)。
- S6：[本地 hermes-agent/tools/delegate_tool.py#L278-L304](../../hermes-agent/tools/delegate_tool.py#L278-L304) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/delegate_tool.py#L278-L304)。
- S7：[本地 hermes-agent/run_agent.py#L1335-L1349](../../hermes-agent/run_agent.py#L1335-L1349) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/run_agent.py#L1335-L1349)。
- S8：[本地 hermes-agent/tools/checkpoint_manager.py#L920-L949](../../hermes-agent/tools/checkpoint_manager.py#L920-L949) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/checkpoint_manager.py#L920-L949)。
- S9：[本地 hermes-agent/tools/checkpoint_manager.py#L1118-L1157](../../hermes-agent/tools/checkpoint_manager.py#L1118-L1157) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/checkpoint_manager.py#L1118-L1157)。
- S10：[本地 hermes-agent/tools/approval.py#L1150-L1194](../../hermes-agent/tools/approval.py#L1150-L1194) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/approval.py#L1150-L1194)。
- S11：[本地 hermes-agent/tools/delegate_tool.py#L278-L292](../../hermes-agent/tools/delegate_tool.py#L278-L292) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/delegate_tool.py#L278-L292)。
- S12：[本地 hermes-agent/agent/iteration_budget.py#L1-L59](../../hermes-agent/agent/iteration_budget.py#L1-L59) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/iteration_budget.py#L1-L59)。
- S13：[本地 hermes-agent/agent/agent_init.py#L2330-L2338](../../hermes-agent/agent/agent_init.py#L2330-L2338) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/agent_init.py#L2330-L2338)。
- S14：[本地 hermes-agent/evals/core_tool_deferral/worker.py#L318-L347](../../hermes-agent/evals/core_tool_deferral/worker.py#L318-L347) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/evals/core_tool_deferral/worker.py#L318-L347)。
- S15：[本地 hermes-agent/evals/core_tool_deferral/orchestrator.py#L56-L87](../../hermes-agent/evals/core_tool_deferral/orchestrator.py#L56-L87) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/evals/core_tool_deferral/orchestrator.py#L56-L87)。

## letta

类型：原仓为迁移入口；补充现行letta-code本地运行源码。固定提交：`5bcdd177d70fa2b31a754cfcd801e77b2e1ab16a`。

SOURCES收录的Letta提交仅含迁移说明和政策文件，git ls-tree未收录运行源码。按该README指向只读下载官方letta-code，另固定补充SHA核对；未修改子模块或SOURCES。补充实现有公开本地后端，并非只剩托管客户端；以下凡机制事实均属于补充版本，不能反推原占位快照或托管服务内部。

补充源码版本：`0d3ad1239ef0c15108e274f28e4f7cf08a79c305`，下载目录 `.downloads/letta-code`，仅作只读研究。

### 行动循环与工具/MCP

入口与责任链：sendMessageStreamWithBackend → prepareCurrentToolExecutionContext。发送前等待工具集切换结束并固定客户端工具执行context；backend接口分为本地与API路径，本地executor工厂连接ProviderTurnExecutor和PiStreamAdapter。

设计取舍：客户端工具、模型后端与消息存档分别持状态，不能把服务接口和本地循环混为一处。

核查范围：现行letta-code补充版本；不是已收录letta占位仓中存在的实现。来源：S1。

### 上下文

入口与责任链：getOrCompileSystemPrompt。比较rawSystemHash与committed memfsRevision；版本未变复用，memory提交变化时生成midConversationSystemPrompt更新，而不是盲重写全部旧前缀。

设计取舍：提交版本决定记忆何时进入输入，未提交工作区文本与模型可见快照可能不同。

核查范围：只证明公开本地后端；API托管服务内部如何编译未由客户端代码证明。来源：S2。

### 记忆

入口与责任链：collectCommittedMemoryFiles / Memory(path)。编译器用git ls-tree/show HEAD读取已提交Markdown，v2根文件为core，其余投影/延迟。Memory工具从活动目录按相对路径读取子目录/文件，拒绝越界和skills路径。

设计取舍：可审阅Git记忆加渐进披露便于版本追溯，但提交、同步、提示刷新是不同事件。

核查范围：现行MemFS v2本地链；云/API MemFS开关与状态归属另外处理。来源：S3。

### 规划与Skills

入口与责任链：技能源解析。技能目录有project、agent memory/skills、global、bundled来源顺序，并从frontmatter组织元数据。

设计取舍：项目覆写便于定制，但技能身份与来源必须保留，不可把正文当用户新授权。

核查范围：本轮实读发现模块及配置类型；未展开每个Skill工具执行分支。来源：S4。

### 协作

入口与责任链：runMemoryWorker → runUpdate。后台记忆worker经memory operation租约运行；可注入execute，完成后安排sync与recompile，刷新失败仅警告而不谎报已提交记忆失败。

设计取舍：把记忆维护从主任务拆开，但必须跟踪提交、同步和刷新三个状态。

核查范围：专门记忆worker，不用它概括所有子Agent共享方式。来源：S5。

### 恢复与副作用

入口与责任链：私有worktree → integrateMemoryWorkerWorktree。更新worker写私有记忆worktree；取消丢弃，merge conflict保留分支报告，成功才整合并settle；worker崩溃后已提交内容仍尝试整合。

设计取舍：版本控制解决部分并发覆盖问题，但不能证明记忆事实准确或远端副作用回滚。

核查范围：本地Git记忆更新恢复，不是通用业务Exactly-once。来源：S6。

### 权限与信任

入口与责任链：isOwnMemoryWrite。仅允许指定写工具且每个目标的字面路径与canonical路径都在当前Agent允许memory roots内，异常返回false。

设计取舍：写入范围可落实到路径，但自有记忆写入不意味着内容获得业务指挥权。

核查范围：cross-agent guard在此之前运行，完整权限模式另有模块，未做攻击实验。来源：S7。

### 预算

入口与责任链：checkMaxTurns / subagent startup budget。headless按buffers.usage.stepCount与maxTurns判超限；reflection子启动另用约4字符/token估计约束system+prompt。

设计取舍：运行步数与输入容量分开；估算不是精确token，父子总费用需另控制。

核查范围：显式maxTurns与reflection配置范围，不声称全树硬金额。来源：S8。

### 评测

入口与责任链：memory prompt integration tests。上游集成测试须显式环境开关与API key才运行，检查自定义系统提示在MemFS模式不会被后台重写。

设计取舍：这是可验证的不变量样例，不是本书运行结果或记忆准确率。

核查范围：本轮只读测试源码；独立业务质量评测尚未核对。来源：S9。

### 本仓来源

- S1：`.downloads/letta-code/src/agent/message.ts#L374-L431` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/agent/message.ts#L374-L431)。
- S2：`.downloads/letta-code/src/backend/local/local-backend.ts#L918-L970` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/backend/local/local-backend.ts#L918-L970)。
- S3：`.downloads/letta-code/src/backend/local/system-prompt-compilation.ts#L80-L145` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/backend/local/system-prompt-compilation.ts#L80-L145)。
- S4：`.downloads/letta-code/src/agent/skills.ts#L1-L40` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/agent/skills.ts#L1-L40)。
- S5：`.downloads/letta-code/src/agent/subagents/memory-worker.ts#L80-L137` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/agent/subagents/memory-worker.ts#L80-L137)。
- S6：`.downloads/letta-code/src/agent/subagents/memory-worker.ts#L174-L222` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/agent/subagents/memory-worker.ts#L174-L222)。
- S7：`.downloads/letta-code/src/permissions/memory-write-allowance.ts#L30-L62` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/permissions/memory-write-allowance.ts#L30-L62)。
- S8：`.downloads/letta-code/src/headless.ts#L2133-L2155` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/headless.ts#L2133-L2155)。
- S9：`.downloads/letta-code/src/agent/memory-prompt.integration.test.ts#L6-L65` · [固定源码](https://github.com/letta-ai/letta-code/blob/0d3ad1239ef0c15108e274f28e4f7cf08a79c305/src/agent/memory-prompt.integration.test.ts#L6-L65)。
