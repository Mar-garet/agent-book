# 编程类运行系统横向研究：九个仓库的系统职责与边界

> 研究日期：2026-10-17。固定版本取自 SOURCES.json。本轮只读上游，不更新快照；没有调用外网模型，也没有运行这些仓库的模型基准。这里记录实际读到的实现、配置和测试定义，不能把“测试存在”当“本轮测试通过”。

本轮覆盖 Codex、Gemini CLI、OpenCode、Cline、Aider、Qwen Code、Pi、OpenHands、Goose，每仓沿九个维度核对关键入口、状态和职责。它是跨系统取样，不是声称穷尽每个项目。对可选插件、SDK、前端与外部服务分别标注范围；尚未追到的依赖实现保留为待核查，不判作不支持。

## 阅读范围与比较方法

九个名字并不对应九个相同层次的对象：Cline 本轮取 SDK 主线，不能代替同仓 VSCode 产品；Aider 以编辑协议与反馈反射组织工作，不能强行映射为 MCP 工具循环；OpenHands 当前源码主要包含 Canvas、设置和 typed-client 接线，真正循环、压缩与预算执行需在相应 agent-server 版本核查。Pi 的核心与 coding-agent 宿主、Goose 的运行器与 Memory MCP 扩展也分开说明。

每段依次给出“实现事实 → 设计启示 → 尚未覆盖的边界”。设计启示是基于所读机制的推断，不是性能结论。文件记忆、上下文投影、执行检查点与外部副作用不按存储介质混为同一种能力。



## Codex CLI

快照：`5009a99dfc07830ddf7464c26f310a2b8532b55d`。

### 行动循环/工具与MCP

关键链：`run_turn → run_pre_sampling_compact；后续 run_sampling_request`。用户输入由Session和TurnContext组织，turn循环把函数请求交ToolCallRuntime，并根据needs_follow_up与待处理输入继续；自动压缩在采样前参与。MCP启动要求作为本轮显式状态保留。

设计启示：把采样、工具和启动依赖分开，使错误可归因；接入方需理解多层继续条件，不能把一条最终消息等同业务完成。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../codex/codex-rs/core/src/session/turn.rs#L155-L210) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/turn.rs#L155-L210)。


### 上下文

关键链：`reconstruct_history_from_rollout → ContextManager.reconstruct_rollout`。重建先选择会影响当前历史的compaction与suffix，再恢复window和存活turn状态；落盘历史与模型可见历史不是同一个集合。

设计启示：恢复可避开过时前缀，但比较完整会话长度无法推断实际请求；观察必须落到最终投影。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../codex/codex-rs/core/src/session/rollout_reconstruction.rs#L189-L245) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/rollout_reconstruction.rs#L189-L245)。


### 记忆

关键链：`MemoriesExtension.contribute_thread_context`。MemoryTool与use_memories共同控制读路径；按MemoryVersion读取summary并生成developer片段，V2将全文按8,900字节分片，不能把单片上限误写成整个摘要只留8,900字节。写入是独立启动期两阶段任务，补充链见下文。

设计启示：保存、整合、读取与注入有各自触发边界；统一版本namespace避免读写串库，但不自动保证业务规则有效期正确。

范围：已读启动提取/整合与读取扩展；未运行记忆生成质量或传播时延实验。来源：[本地实现](../../codex/codex-rs/ext/memories/src/extension.rs#L45-L101) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/ext/memories/src/extension.rs#L45-L101)。


### 规划与Skills

关键链：`skills_load_input_for_environments`。Skills发现以捕获的primary环境cwd与对应ExecutorFileSystem为准，结合配置层和插件技能快照生成HostSkillsLoadInput。

设计启示：环境与技能根绑定避免错误仓库的约定混入，但插件和配置使默认技能集不能由产品名推断。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../codex/codex-rs/core/src/skills.rs#L45-L81) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/skills.rs#L45-L81)。


### 多Agent协作

关键链：`spawn_agent Handler::handle → handle_spawn_agent`。工具执行器处理spawn请求，记录发送/接收thread、模型配置、状态及耗时；结果携带独立线程与配置快照。

设计启示：子线程身份可追踪，协调者仍需验收工作；这里不是“多个同名角色等于独立验证”。

范围：已读v2入口与spawn分派；是否暴露此工具取决于会话功能与配置。来源：[本地实现](../../codex/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L33-L109) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L33-L109)。


### 恢复与副作用

关键链：`ContextManager.reconstruct_rollout`。从持久RolloutItem重建历史和恢复元数据，不重新启动session或获取writer；选择压缩检查点后重放suffix。

设计启示：历史重建提供连续性，不替外部服务确认一个命令是否已产生效果；业务去重仍需动作身份。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../codex/codex-rs/core/src/session/rollout_reconstruction.rs#L208-L245) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/rollout_reconstruction.rs#L208-L245)。


### 权限信任

关键链：`ToolOrchestrator.run → exec_approval_requirement`。实际执行前从step settings取得approval policy，从tool对应environment取得permission profile与workspace roots，决定审批要求及沙箱上下文；Executor管理沙箱与本地映射有分支。

设计启示：审批绑定reviewed authority，工具环境决定真实权限；同意一个受限请求不等于同意提升后的权限。

范围：已读orchestrator初始审批和权限准备链；不同拒绝阶段的后续重试详见既有codex-tool-execution研究。来源：[本地实现](../../codex/codex-rs/core/src/tools/orchestrator.rs#L123-L170) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/orchestrator.rs#L123-L170)。


### 预算

关键链：`resolve_token_budget`。配置可采用模型提供的reminder阈值、guidance和auto-compact fallback；无效模型默认值会退回显式配置。

设计启示：提醒与上下文预算方便长期工作，但不自动成为跨工具/子线程的费用硬限额。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../codex/codex-rs/core/src/session/token_budget.rs#L81-L123) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/token_budget.rs#L81-L123)。


### 评测

关键链：`rollout reconstruction tests`。仓库保留针对Rollout重建的测试入口，可把历史状态和压缩选择作为确定性机制检查对象。

设计启示：机制回归可验证投影，不提供跨模型任务成功率；业务产物验收还需独立任务集。

范围：只读测试源码与测试组织，未运行；未把仓库测试数量当本书实验成绩。来源：[本地实现](../../codex/codex-rs/core/src/session/rollout_reconstruction_tests.rs#L1-L65) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/rollout_reconstruction_tests.rs#L1-L65)。


## Gemini CLI

快照：`ed96faedfd5571f055c44f2c9509d62321d1138d`。

### 行动循环/工具与MCP

关键链：`GeminiClient.sendMessageStream → processTurn`。入口重置turn、按prompt_id维护loop detector，先执行BeforeAgent hook，再把有界轮数交给processTurn；hook可停止、阻断或添加上下文。

设计启示：主循环支持扩展控制，hook改变流程后还需明确输入是否记入历史，不能仅观察最终文本。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/core/client.ts#L940-L1008) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/core/client.ts#L940-L1008)。


### 上下文

关键链：`DEFAULT_COMPRESSION_TOKEN_THRESHOLD / retrieval exemptions`。默认压缩阈值以模型token上限的比例表示，保护最近三轮工具结果，文件/搜索等检索工具有避免折叠的豁免集合。

设计启示：近期保真和旧结果压缩平衡容量，但豁免集合需维护；不能据摘要长度断言关键信息已保留。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/context/chatCompressionService.ts#L43-L76) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/context/chatCompressionService.ts#L43-L76)。


### 记忆

关键链：`MemoryContextManager.refresh → discoverMemoryPaths → loadMemoryContents`。刷新清空已加载身份集合，分别发现全局、扩展、项目、用户项目记忆；仅信任工作区才加载环境记忆，随后按文件身份去重并读取。

设计启示：来源分层和信任检查减少错误注入，但文件更新和刷新是独立事件。另读memoryService可见后台提取锁/节流，不把它与每次加载混为一谈。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/context/memoryContextManager.ts#L35-L101) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/context/memoryContextManager.ts#L35-L101)。


### 规划与Skills

关键链：`setDisabledSkills / getSkill / activateSkill`。技能发现结果有禁用状态，按名称取得完整定义，activeSkillNames独立记录已激活技能；发现、可见、激活是不同状态。

设计启示：可控制技能范围，但计划是否遵守仍需执行策略；激活一个Skill不等于授权其全部工具。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/skills/skillManager.ts#L172-L210) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/skills/skillManager.ts#L172-L210)。


### 多Agent协作

关键链：`LocalAgentExecutor.runInternal → executeTurn`。本地子Agent运行自有循环，每轮检查终止原因、组合取消/截止信号，再执行一轮并累加turnCounter。

设计启示：子循环可以配置专业工具和时间，父协调者仍需收集terminateReason，不能把有返回值等同子任务成功。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/agents/local-executor.ts#L685-L720) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/agents/local-executor.ts#L685-L720)。


### 恢复与副作用

关键链：`processRestorableToolCalls`。针对可恢复工具保存Git快照、clientHistory、toolCall名/参数和messageId；缺file_path则跳过并给错误。

设计启示：文件快照可恢复局部工作区，不覆盖任意远端任务、通知或数据库写入；checkpoint成功不能代替业务幂等。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/utils/checkpointUtils.ts#L110-L159) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/utils/checkpointUtils.ts#L110-L159)。


### 权限信任

关键链：`Scheduler._processToolCall → checkPolicy`。BeforeTool hook可修改参数并重建invocation，之后重新执行policy；ALLOW遇taint/build风险会转ASK_USER，非交互转DENY。

设计启示：对最终参数检查比只查原请求稳妥；交互与无头模式行为不同，安全结论需指定模式和策略。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/scheduler/scheduler.ts#L640-L707) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/scheduler/scheduler.ts#L640-L707)。


### 预算

关键链：`checkTermination(turnCounter,maxTurns) / DeadlineTimer`。本地Agent的轮数与截止时间在每轮之前检查，取消区分TIMEOUT和ABORTED；主入口另把turns限制到MAX_TURNS。

设计启示：多种终止原因可解释停止，但局部轮数不是父子整体成本；需要在上层汇总。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../gemini-cli/packages/core/src/agents/local-executor.ts#L685-L720) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/agents/local-executor.ts#L685-L720)。


### 评测

关键链：`evalTest：delegation断言`。真实评测定义显式启用experimental agents/taskTracker，准备三个专家文件，检查tracker调用、各委派成功及最终代码/文档产物。

设计启示：控制调用与产物都有断言，仍不保证普遍分工效果；实验开关应随结果记录。

范围：已读评测定义；本轮未执行，不能引用其名称USUALLY_PASSES为本书观测。来源：[本地实现](../../gemini-cli/evals/subtask_delegation.eval.ts#L21-L85) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/evals/subtask_delegation.eval.ts#L21-L85)。


## OpenCode

快照：`65932e870ca50d21886f9d0ee89c6603bac34a65`。

### 行动循环/工具与MCP

关键链：`SessionRunner.runStep → context.request.primary → SessionStep.attempt`。每step加载/刷新上下文，先做auto compaction，再构造model request并启动stream；工具定义和toolChoice分开控制。MCP工具另通过permission.assert后调用服务。

设计启示：Effect服务将依赖和转移显式化，嵌入方需维护session/location和插件生命周期，不能套用旧版packages/opencode结构。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/session/runner/llm.ts#L209-L250) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/runner/llm.ts#L209-L250)。


### 上下文

关键链：`SessionInstructions.load`。同session/path并行加载用inFlight claim防重；持久注入账本存于synthetic消息metadata，压缩或revert移出可见历史后允许重注入。

设计启示：把已加载状态绑定模型可见历史，避免“读过一次永远不再读”；代价是需正确处理并发和历史变化。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/session/instructions.ts#L36-L100) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/instructions.ts#L36-L100)。


### 记忆

关键链：`previouslyInjected → store.context`。持久指令读取检查当前session context中的synthetic metadata，不把进程内Map当永久知识库；项目文件仍是可回查来源。

设计启示：项目约定与会话历史能承载持续信息，但有效期、跨项目事实抽取和检索质量不由这个账本解决。

范围：本轮核对持久指令/会话记忆路径，未全查其他插件的长期记忆实现；environment/memory.ts是内存文件系统而非Agent长期记忆。来源：[本地实现](../../opencode/packages/core/src/session/instructions.ts#L103-L119) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/instructions.ts#L103-L119)。


### 规划与Skills

关键链：`SessionSkill.get`。等待Plugin激活后，在session对应Instance里取得Skill服务并按ID查找，不存在返回SkillNotFoundError。

设计启示：技能跟session位置与插件生命周期绑定，便于工作区限定；不能把目录里有SKILL文件当成已加载正文。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/session/skill.ts#L10-L16) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/skill.ts#L10-L16)。


### 多Agent协作

关键链：`SubagentJob.start / notify / background`。以childSessionID登记Job，resume子session并读取完成助手输出；通知按child与startedAt这一代运行去重，观察者在全局scope存活。

设计启示：子Agent能越过启动插件生命周期继续工作，代价是必须管理完成通知、世代与取消，不能只等待一个函数返回。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/session/subagent-job.ts#L27-L76) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/subagent-job.ts#L27-L76)。


### 恢复与副作用

关键链：`resumeSuspendedSessions / prepareResume`。持久execution claim跨崩溃保留；每次恢复先持久计数，默认最多10次，过限终结并释放claim；实现明确恢复是at-least-once。

设计启示：抑制重启循环，但本地claim只能协调执行者，不能保证外部动作恰好一次。managed-server确认旧owner死亡是前提。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/session/execution/restart.ts#L17-L90) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/execution/restart.ts#L17-L90)。


### 权限信任

关键链：`Permission.evaluate / ask / assert`。按规则集最后匹配的action/resource决定，未匹配默认为ask；ask和assert是与session关联的独立服务请求。

设计启示：规则顺序和资源身份可审查，但服务凭证仍需限制真实效果，审批本身不等于隔离。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/permission.ts#L87-L119) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/permission.ts#L87-L119)。


### 预算

关键链：`stepLimitReached → toolChoice:none`。达到agent.steps后保留工具定义以稳定provider缓存前缀，但把toolChoice设none并加入收尾提示；step执行层也拒绝工具。

设计启示：模型提示与执行拒绝相接，局部step限额仍不是子job共享费用上限。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../opencode/packages/core/src/session/runner/llm.ts#L226-L247) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/runner/llm.ts#L226-L247)。


### 评测

关键链：`subagent observer lifetime / TestLLM.testLayer`。测试替换LLM、模型与watcher，覆盖子会话迁移、evict及不同完成状态下父通知恰好一次。

设计启示：这是控制流和生命周期验收，不能作为真实模型协作成功率；适合为恢复和通知建立回归。

范围：已读测试定义，本轮未运行。来源：[本地实现](../../opencode/packages/core/test/subagent-lifetime.test.ts#L1-L80) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/test/subagent-lifetime.test.ts#L1-L80)。


## Cline

快照：`b549ceb4bb4247284c975f6d6ca0979decec097c`。

### 行动循环/工具与MCP

关键链：`AgentRuntime.run/continue → execute`。execute初始化runId与usage，排队输入并运行beforeRun hooks，iteration循环调用模型。工具批次先prepare，再按相邻parallel分组执行；MCP映射属于Core扩展层。

设计启示：运行器和工具宿主分层，用户可改策略；SDK事实不能直接外推同仓库VSCode产品所有默认。

范围：已读SDK运行循环与工具准备链；本章组选择SDK，不声称覆盖VSCode宿主。来源：[本地实现](../../cline/sdk/packages/agents/src/agent-runtime.ts#L788-L869) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L788-L869)。


### 上下文

关键链：`getTotalTokens / sanitizeTypedUserMessage / dropped-work summaries`。基本压缩先估算消息token，清理空用户块，再由budget projection和工具活动摘要构造缩短的历史；近期助手正文有单独保留数量。

设计启示：有损表示减少输入，但结构合法不保证原意保留；agentic/basic压缩路径应按配置分别比较。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../cline/sdk/packages/core/src/extensions/context/basic-compaction.ts#L21-L99) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/context/basic-compaction.ts#L21-L99)。


### 记忆

关键链：`workspace config candidates / AGENTS.md`。扫描Markdown规则候选，并在工作区根特别加入AGENTS.md，避免重复候选；项目持续约定由配置加载层进入运行系统。

设计启示：文件型规则可查看，但此链不提供自动事实提炼与生效期选择；需区分全局、项目及会话输入。

范围：已读SDK规则加载；没有把社区memory-bank工作法宣称为SDK默认内置长期记忆。来源：[本地实现](../../cline/sdk/packages/core/src/extensions/config/user-instruction-config-loader.ts#L539-L583) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/config/user-instruction-config-loader.ts#L539-L583)。


### 规划与Skills

关键链：`parseAgentSkillMarkdown相关元数据验证`。技能元数据有name、description、compatibility、allowed-tools等字段，名称做NFKC与大小写、目录名一致性验证，正文独立保存。

设计启示：包格式验证能提前发现配置错误，allowed-tools元数据仍需运行策略解释，不能仅凭字段存在断言强制权限已实现。

范围：已读解析/验证与ParsedAgentSkill结构；技能发现和使用配置不在本行展开。来源：[本地实现](../../cline/sdk/packages/core/src/extensions/agent-plugin/agent-skill.ts#L4-L97) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/agent-plugin/agent-skill.ts#L4-L97)。


### 多Agent协作

关键链：`spawn_agent.execute → createDelegatedAgent → run`。为子Agent显式选择tools、maxIterations、父ID、abortSignal、toolPolicies与审批回调；返回text、iterations、finishReason及usage。

设计启示：子工具集和权限可收窄，父仍要依据finishReason验收；共享取消不等于共享费用或任意状态。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../cline/sdk/packages/core/src/extensions/tools/team/spawn-agent-tool.ts#L125-L173) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/tools/team/spawn-agent-tool.ts#L125-L173)。


### 恢复与副作用

关键链：`beginWorktreeRestoreTransaction`。恢复前通过包含未跟踪文件的临时stash保存工作区，把对象移到私有ref并清理用户stash记录，提供commit/rollback事务接口。

设计启示：保护本地破坏性恢复，但无法撤销远端通知或数据库写入；事务边界必须说明只覆盖工作区。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../cline/sdk/packages/core/src/session/checkpoint-restore.ts#L42-L100) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/checkpoint-restore.ts#L42-L100)。


### 权限信任

关键链：`beforeTool → resolveToolPolicy → requestToolApproval`。钩子可调整input、policy或skip；最后合并toolPolicies与覆盖策略，disabled直接阻断，autoApprove:false调用approval callback。

设计启示：最终输入与最终策略一起检查；自定义hook拥有高权力，应纳入可信配置，不可等同非可信工具结果。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../cline/sdk/packages/agents/src/agent-runtime.ts#L2440-L2505) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L2440-L2505)。


### 预算

关键链：`maxIterations / state.iteration`。每次execute把iteration归零，循环按config.maxIterations约束；子Agent另接defaultMaxIterations并回传usage。

设计启示：运行级限额清楚，但连续run与子run不能自动拼成根任务统一额度；应用要汇总和预留验收。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../cline/sdk/packages/agents/src/agent-runtime.ts#L830-L850) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L830-L850)。


### 评测

关键链：`run-cline-bench launcher`。仓库单独保存Cline benchmark启动器；它与SDK运行器不是同一层，评测须固定模型、宿主及任务环境。

设计启示：评测基础设施可以复用，不能因同名仓库就把VSCode或CLI结果当SDK同配置效果。

范围：已读评测启动组织与SDK范围；本轮未执行基准或引用分数。来源：[本地实现](../../cline/evals/e2e/run-cline-bench.ts#L1-L70) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/evals/e2e/run-cline-bench.ts#L1-L70)。


## Aider

快照：`5dc9490bb35f9729ef2c95d00a19ccd30c26339c`。

### 行动循环/工具与MCP

关键链：`Coder.run_one → send_message → reflected_message`。循环按编辑协议发送请求，若解析/检查产生reflected_message就继续修正，反射次数达到max_reflections时停止；不以MCP函数请求作为这条链的中心。

设计启示：围绕代码变更和检查反馈组织，语义更贴近编辑任务；不能强行把所有系统画成同一种函数工具循环。

范围：已读编辑主循环；本轮未核对其他MCP插件集成，不能从此判定项目不支持MCP。来源：[本地实现](../../aider/aider/coders/base_coder.py#L924-L945) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/coders/base_coder.py#L924-L945)。


### 上下文

关键链：`ChatSummary.summarize_real`。按模型token_count计算历史大小，保留较近尾部，旧前缀摘要；头部还按模型输入上限减512限制，必要时递归压缩。

设计启示：保留近期内容减少丢失，但多次摘要可能传播旧遗漏；repo-map与文件选择另承担代码上下文职责。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../aider/aider/history.py#L8-L98) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/history.py#L8-L98)。


### 记忆

关键链：`restore_chat_history / done_messages / read_only_fnames`。可配置从聊天Markdown恢复done_messages，read_only文件作为参考集合，历史再交ChatSummary处理。

设计启示：历史与参考文件支持持续工作，不等于自动形成可检索、可更新的事实库；规则有效期由用户资料管理。

范围：已读聊天恢复与只读参考路径，未穷尽第三方长期记忆工作流。来源：[本地实现](../../aider/aider/coders/base_coder.py#L478-L526) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/coders/base_coder.py#L478-L526)。


### 规划与Skills

关键链：`ArchitectCoder.reply_completed`。Architect输出方案后默认询问是否编辑，再创建Editor Coder，清空其聊天历史，并禁用建议shell和repo map。

设计启示：先方案后编辑分配不同职责，额外模型阶段增加往返；这里是内置编辑模式，不应重命名成通用Skill调度。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../aider/aider/coders/architect_coder.py#L6-L45) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/coders/architect_coder.py#L6-L45)。


### 多Agent协作

关键链：`Coder.create(editor_model) → editor_coder.run`。编辑器可用单独editor_model，继承必要文件/配置但使用新的当前与完成消息，完成后把cost与commit hashes交回Architect。

设计启示：串行分工带来明确结果边界，并非并行团队；编辑器仍需执行自己的检查，方案文字本身不是正确性证明。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../aider/aider/coders/architect_coder.py#L20-L45) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/coders/architect_coder.py#L20-L45)。


### 恢复与副作用

关键链：`cmd_undo → raw_cmd_undo`。撤销前核对Git仓库、父提交、上次提交属于本会话aider_commit_hashes且相关文件无未提交变更。

设计启示：用版本控制约束本地回退范围，远端shell动作不在Git撤销里；交付应注明两种效果。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../aider/aider/commands.py#L553-L594) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/commands.py#L553-L594)。


### 权限信任

关键链：`apply_updates → get_edits → dry_run → prepare_to_edit → apply_edits`。解析编辑、预演并准备允许编辑的文件后才应用变更；异常可转reflected_message供下一次修复。只读文件另由abs_read_only_fnames集合维护。

设计启示：缩小编辑集合并在应用前检查，但这不是操作系统沙箱；shell执行仍需独立授权与隔离。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../aider/aider/coders/base_coder.py#L2296-L2338) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/coders/base_coder.py#L2296-L2338)。


### 预算

关键链：`num_reflections / max_reflections`。错误反馈修正至多采用配置的反射次数，达到后停止而不是无限要求模型重做。

设计启示：限制修正循环容易解释，却不等于token/费用总预算；Architect与Editor还要累计cost。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../aider/aider/coders/base_coder.py#L932-L945) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/aider/coders/base_coder.py#L932-L945)。


### 评测

关键链：`benchmark main：tries / no_unit_tests / num_tests`。benchmark暴露每题尝试次数、是否运行单测与题数等配置；这些条件会改变成绩含义。

设计启示：有单元测试的编辑任务可验证行为，允许多次修正与单次成功是不同指标，报告须含tries和完整任务条件。

范围：已读基准配置及run_test分派；本轮未运行，不引用排行榜。来源：[本地实现](../../aider/benchmark/benchmark.py#L181-L205) · [固定提交](https://github.com/Aider-AI/aider/blob/5dc9490bb35f9729ef2c95d00a19ccd30c26339c/benchmark/benchmark.py#L181-L205)。


## Qwen Code

快照：`4e2753b006bde1bd42476c62161f6d6fd241c9bf`。

### 行动循环/工具与MCP

关键链：`sendMessageStream`。区分UserQuery、Retry、Cron、Notification、Teammate和Goal等消息来源，借interaction span归属一次工作；工具与继续调用经过本client。

设计启示：调度任务和交互任务共用循环时必须保留来源，否则预算与完成归属容易混乱。

范围：已读client入口和计数链；MCP更细路由本轮未单独深追，不声称所有工具同一路径。来源：[本地实现](../../qwen-code/packages/core/src/core/client.ts#L3610-L3648) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/core/client.ts#L3610-L3648)。


### 上下文

关键链：`computeCompactionOutputBudget`。摘要输出额度按窗口减去已精简输入估计及1024安全边际，再限在1到20000；精简输入和摘要生成预算不同。

设计启示：避免小窗口请求在调用前必超限，但字符估计有误差，仍可能被provider拒绝，不能承诺一定可压缩。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../qwen-code/packages/core/src/services/chatCompressionService.ts#L86-L104) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/services/chatCompressionService.ts#L86-L104)。


### 记忆

关键链：`MemoryManager.recall → resolveRelevantAutoMemoryPromptForQuery`。统一Manager把查询交给相关记忆解析，另有scheduleExtract、scheduleDream、forget与buildAutoMemoryPrompt；后台任务由inFlight集合追踪并可drain。

设计启示：后台维护与前台使用分开，提升复用同时产生新鲜度、关闭时等待与记录一致性成本。

范围：已读Manager入口、recall与drain实现；没有运行提取质量/检索效果评测，不把设置开关视为所有部署默认。来源：[本地实现](../../qwen-code/packages/core/src/memory/manager.ts#L2243-L2260) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/memory/manager.ts#L2243-L2260)。


### 规划与Skills

关键链：`splitConditionalSkills / SkillActivationRegistry`。带paths前言的技能先不进入工具描述，工具接触匹配文件才激活；无条件技能始终可提供，refreshCache重建会重置激活。

设计启示：大仓库减少无关技能描述，但路径匹配、符号链接和缓存刷新决定可见性，加载经验仍需另验执行权限。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../qwen-code/packages/core/src/skills/skill-activation.ts#L1-L63) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/skills/skill-activation.ts#L1-L63)。


### 多Agent协作

关键链：`resolveAgentExecutionBackend`。子Agent声明只接受container这一特定后端值；不可信项目不能凭定义选择容器执行，最终选择结合全局配置。

设计启示：后端声明进入信任校验，避免错误配置静默退回本地；容器选择不自动证明全部数据与凭证隔离。

范围：已读后端解析及SubagentExecutor接口；独立本地/ACP/Codex执行器的所有细节未全覆盖。来源：[本地实现](../../qwen-code/packages/core/src/subagents/execution-backend.ts#L12-L39) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/subagents/execution-backend.ts#L12-L39)。


### 恢复与副作用

关键链：`openDurableLockDirectory`。打开持久锁目录后比对设备和inode，使用NOFOLLOW等标志拒绝目录换位；会话写入协调具有文件系统身份边界。

设计启示：防止同会话写入竞争与路径替换不等于外部命令去重；重启恢复仍要核对服务状态。

范围：已读writer lease的安全打开链；尚未运行跨进程崩溃场景。来源：[本地实现](../../qwen-code/packages/core/src/services/session-writer-lease.ts#L47-L90) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/services/session-writer-lease.ts#L47-L90)。


### 权限信任

关键链：`evaluatePermissionFlow`。工具调度器委托permissionFlow统一处理权限决定，而不是让模型参数决定是否有权；工具不存在时还区分用户禁用和配置未注册。

设计启示：注册目录和权限允许集并不相同，诊断不能把“不在模型工具表”解释成能力不存在。

范围：已读permissionFlow入口与scheduler禁用诊断；细分自动审批分类器全部分支未覆盖。来源：[本地实现](../../qwen-code/packages/core/src/core/permissionFlow.ts#L64-L112) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/core/permissionFlow.ts#L64-L112)。


### 预算

关键链：`sessionTurnCount / boundedTurns / isGoalRuntimeTurn`。用户提示驱动的模型调用（包括工具继续）消耗会话轮数，Goal runtime turn不占同一maxSessionTurns，改由Goal预算限制；递归turn另有MAX_TURNS。

设计启示：避免自动Goal挤掉用户会话额度，但统一监控必须按消息来源汇总，不能只看一个maxSessionTurns。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../qwen-code/packages/core/src/core/client.ts#L4430-L4519) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/core/client.ts#L4430-L4519)。


### 评测

关键链：`E2E_MEMORY_SETTINGS_DEFAULTS`。集成测试统一关闭managed auto-memory与dream，相关套件按键重新启用，避免每个工具完成触发的后台模型请求扰动无关测试。

设计启示：隔离非目标后台工作使测试可归因，性能/记忆评测却必须主动开启相应条件；测试默认不能冒充产品默认。

范围：已读测试配置实现，本轮未运行集成测试或推断成功率。来源：[本地实现](../../qwen-code/integration-tests/e2e-memory-defaults.ts#L1-L20) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/integration-tests/e2e-memory-defaults.ts#L1-L20)。


## Pi

快照：`8efd314fa3d3232ce197d8d7a6a5660530b9d83e`。

### 行动循环/工具与MCP

关键链：`agentLoop/agentLoopContinue → streamAssistantResponse → executeToolCalls`。核心循环准备请求、读取steering、流式收集模型响应，把工具结果写回上下文；length截断响应中的工具请求整体返回错误，避免执行截断参数。

设计启示：核心清晰可扩展，宿主仍要安排投影和权限；核心工具循环与编程会话MCP扩展是不同层。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../pi/packages/agent/src/agent-loop.ts#L179-L285) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L179-L285)。


### 上下文

关键链：`buildSessionContext → buildSessionProjection`。当前leaf投影生成模型消息、thinkingLevel和model；按cwd编码的session目录保存原始记录。

设计启示：树形存档允许分支回查，只有活动投影进入推理；保留全历史不代表每次全读。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../pi/packages/coding-agent/src/core/session-manager.ts#L576-L605) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L576-L605)。


### 记忆

关键链：`loadContextFileFromDir`。按AGENTS.override.md、AGENTS.md、CLAUDE.md等候选顺序选择目录上下文并读取正文，供资源加载器装配。

设计启示：文件可审阅且可由用户修订；它提供项目约定的读取路径，未单独解决自动抽取、有效期和跨用户隔离。

范围：已读上下文文件加载；不将文件机制扩张成完整内置长期记忆库。来源：[本地实现](../../pi/packages/coding-agent/src/core/resource-loader.ts#L184-L207) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/resource-loader.ts#L184-L207)。


### 规划与Skills

关键链：`resource loader：skillsResult装配`。资源层通过loadSkills与覆盖入口组织技能与诊断；Skills和扩展位于coding-agent宿主，不是Agent核心的独立执行入口。

设计启示：按需经验可以扩展而不膨胀核心，但技能说明和扩展行为需另做信任与版本管理。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../pi/packages/coding-agent/src/core/resource-loader.ts#L841-L872) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/resource-loader.ts#L841-L872)。


### 多Agent协作

关键链：`_executeNestedToolCall`。编程会话为工具内部调用其他工具提供嵌套执行和事件上下文；这本身不是内置子Agent调度器。协作可以由扩展调用独立会话来组织。

设计启示：扩展可复用工具事件链，应用仍需提供任务拆分、独立会话和汇总规则。

范围：已读嵌套工具边界；未核对全体扩展中的协作实现，不能据此断言项目不支持多Agent。来源：[本地实现](../../pi/packages/coding-agent/src/core/agent-session.ts#L731-L776) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L731-L776)。


### 恢复与副作用

关键链：`SessionManager.appendMessage`。消息附加到session树后可按leaf重建；记录关注会话经历，而不是对任意远端服务提供提交事务。

设计启示：分支连续性便于回看，但恢复对话不能证明命令未执行；服务动作还应有查询或去重。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../pi/packages/coding-agent/src/core/session-manager.ts#L1204-L1235) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1204-L1235)。


### 权限信任

关键链：`_beforeToolCall → extensionRunner.emitToolCall`。宿主在工具前运行tool_call扩展钩子，钩子异常会阻止执行；无处理器则返回undefined继续默认路径。

设计启示：可插入业务限制，配置方必须确保需要的拦截器真正加载；不能把可扩展钩子说成默认沙箱。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../pi/packages/coding-agent/src/core/agent-session.ts#L650-L684) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L650-L684)。


### 预算

关键链：`_compactBeforeNextAssistantResponse / compaction threshold`。编程会话在下一助手响应前检查投影token是否超过模型压缩阈值，可能先压缩再发请求。

设计启示：管理上下文容量与成本不同；此阈值不是整项任务的统一调用或费用额度。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../pi/packages/coding-agent/src/core/agent-session.ts#L767-L790) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L767-L790)。


### 评测

关键链：`PiCodingAgentHarnessOptions / resolveModelSelection / applyIsolatedEnvironment`。eval harness显式选模型，支持工具与工作区文件，暂换隔离HOME/agentDir；缺模型配置会报错。

设计启示：隔离评测有助于防历史污染，最终评分仍需任务特定断言；不能从harness存在推导模型成绩。

范围：已读eval实现；本轮未运行真实模型评测。来源：[本地实现](../../pi/packages/evals/src/harness.ts#L47-L101) · [固定提交](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/evals/src/harness.ts#L47-L101)。


## OpenHands

快照：`045290739f0af2ae4cc89d2a209c6bd930bb81ee`。

### 行动循环/工具与MCP

关键链：`sendMessage → ConversationClient.sendEvent(run:true)`。Canvas根据当前local/cloud后端解析conversationUrl和sessionApiKey，然后把消息事件发给agent-server并要求run；模型/工具循环不在该前端方法内。

设计启示：前端和执行后端可独立演进，但必须记录server版本；不能把这个快照的UI代码当成Python Agent引擎实现。

范围：已读实际前端至typed-client调用；agent-server依赖实现未在此仓完整展开，MCP设置亦是服务接口而非前端执行器。来源：[本地实现](../../openhands/src/api/conversation-service/agent-server-conversation-service.api.ts#L475-L511) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/api/conversation-service/agent-server-conversation-service.api.ts#L475-L511)。


### 上下文

关键链：`CondenserSettingsScreen → SdkSectionPage`。设置页向SDK通用设置组件指定agent_settings.condenser节，说明压缩配置由后端能力/设置schema承接；前端不在这里实现摘要算法。

设计启示：配置界面可跟随服务schema，但部署差异要核对服务版本，不能凭同一个下拉选项比较压缩质量。

范围：已读UI接线；压缩内部执行委托agent-server，不声称本轮已核对外部实现。来源：[本地实现](../../openhands/src/routes/condenser-settings.tsx#L1-L14) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/routes/condenser-settings.tsx#L1-L14)。


### 记忆

关键链：`AgentContextSettingsScreen → agent_context`。持续上下文设置通过agent_settings.agent_context交给通用SDK设置页。客户端能说明配置归属，不能证明后端具体检索、写入和缓存行为。

设计启示：把设置和引擎分开利于复用，研究必须追到对应server固定版本才可写记忆系统机制结论。

范围：本轮已核对设置委托边界；未在本仓找到的服务实现不判为不存在，记忆算法本身仍待依赖源码核查。来源：[本地实现](../../openhands/src/routes/agent-context-settings.tsx#L1-L14) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/routes/agent-context-settings.tsx#L1-L14)。


### 规划与Skills

关键链：`SkillsService.getSkills`。公共Skill目录是@openhands/extensions的构建时快照；本地再请求SkillsClient加载user/project，失败退回公共目录，Cloud走独立API。

设计启示：显示技能可用性和实际后端加载不同；构建时内容更新要升级依赖并重建。另有createLocalPlanningConversation创建规划子会话。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../openhands/src/api/skills-service.ts#L29-L79) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/api/skills-service.ts#L29-L79)。


### 多Agent协作

关键链：`createLocalPlanningConversation`。读取父工作目录与执行runtime，保持workspace种类，按父有效profile构造规划请求；较新agent-server持久父子链接，旧版仅客户端fallback。

设计启示：协作依赖版本和后端能力，客户端链接提示不等于服务已持久关系；隔离是否落实要检查响应。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../openhands/src/api/conversation-service/agent-server-conversation-service.api.ts#L675-L722) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/api/conversation-service/agent-server-conversation-service.api.ts#L675-L722)。


### 恢复与副作用

关键链：`useWebSocket：queryParams getter / reconnect`。连接时求值resume cursor，重连指数退避到30秒，并以WebSocket实例跟踪是否可重连；事件传输恢复与Agent执行恢复分开。

设计启示：重连能恢复观察，不证明服务没有重复执行；前端游标和业务动作编号承担不同连续性。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../openhands/src/hooks/use-websocket.ts#L6-L73) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/hooks/use-websocket.ts#L6-L73)。


### 权限信任

关键链：`EventService.respondToConfirmation`。事件历史可由Cloud App API保存，运行确认直达每会话runtime host并带session API key；确认消息只包含本次accept请求。

设计启示：UI发送确认与server检查权限是两个事件；不能把按钮点击宣称为前端沙箱，也不能把App bearer凭证混成runtime会话凭证。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../openhands/src/api/event-service/event-service.api.ts#L17-L55) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/api/event-service/event-service.api.ts#L17-L55)。


### 预算

关键链：`LLMBalanceService.getBalance`。客户端读取agent-server报告的provider余额，旧server/不支持的provider返回null，超时仍作为错误而非永久无余额。

设计启示：余额呈现与执行前预算强制不同；是否真正阻止超支必须继续检查server，UI字段不能证明硬限额。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../openhands/src/api/llm-balance-service.ts#L54-L88) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/src/api/llm-balance-service.ts#L54-L88)。


### 评测

关键链：`Playwright conversation rendering performance spec`。当前仓库有真实浏览器E2E测试入口，关注会话显示与交互表现；后端模型任务效果应另行固定runtime与任务集。

设计启示：UI正确性/渲染性能与Agent完成率是不同验收层，不能将前端通过数量计作Agent成功样本。

范围：已读浏览器测试定义；本轮未运行，未引用外部Agent基准成绩。来源：[本地实现](../../openhands/tests/e2e/conversation-markdown-render-performance.spec.ts#L1-L70) · [固定提交](https://github.com/OpenHands/OpenHands/blob/045290739f0af2ae4cc89d2a209c6bd930bb81ee/tests/e2e/conversation-markdown-render-performance.spec.ts#L1-L70)。


## Goose

快照：`59e588dfd941ae129f2938deb7acf9f80b6edd02`。

### 行动循环/工具与MCP

关键链：`GooseInferenceProvider / InferenceRunner / prepare_tool_requests`。状态机推理操作接Provider流，携带advertised tools记录；对未被认领的工具错误补充当时可用工具名单。

设计启示：工具目录属于某次请求上下文，失败可以反馈修正；描述可见与实际可执行仍需approval操作配合。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_llm.rs#L21-L75) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_llm.rs#L21-L75)。


### 上下文

关键链：`CompactionOperation::context_tokens / over_threshold`。按模型窗口与配置比例判断压缩，补计上一推理后未计入usage的工具token；Provider可声明自行管理上下文。

设计启示：报告usage可能落后于工具结果，额外计数减少误判，但估算与真实服务拒绝仍需分开处理。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_compaction.rs#L24-L85) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_compaction.rs#L24-L85)。


### 记忆

关键链：`MemoryServer / RememberMemoryParams / RetrieveMemoriesParams`。Memory MCP服务按category、tags和is_global提供存取请求，工作目录来自元数据；是独立扩展服务。

设计启示：分类文件机制容易审阅，但全局/局部选择仍需调用方正确传递，不能直接视为任意会话默认记忆。

范围：已读Memory MCP服务接口和目录结构；未运行，不声称默认启用。来源：[本地实现](../../goose/crates/goose-mcp/src/memory/mod.rs#L64-L120) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose-mcp/src/memory/mod.rs#L64-L120)。


### 规划与Skills

关键链：`SkillOperation → skill_instructions / load_skill`。系统提示列出发现的技能名和描述，模型通过load_skill读取完整正文和支持文件。

设计启示：先索引后正文减少常驻材料，但模型必须正确选择加载，执行硬限制仍需工具审批。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_skills.rs#L29-L88) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_skills.rs#L29-L88)。


### 多Agent协作

关键链：`ForegroundSubagentRunner::start`。加载子session后校验类型和parent_session_id，已有成功final_output则复用，否则携取消令牌启动并向父发通知。

设计启示：父子身份和完成结果可追踪，可避免部分重复执行；父仍需审查结果是否满足总目标。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_subagent.rs#L100-L148) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_subagent.rs#L100-L148)。


### 恢复与副作用

关键链：`start：successful_output复用`。已存在的子会话成功产物可以直接返回，历史meta还保留早期后台委派记录的兼容处理。

设计启示：复用已完成子结果缩小恢复范围，不为子任务内部任意外部写入提供一次性提交保证。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_subagent.rs#L109-L148) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_subagent.rs#L109-L148)。


### 权限信任

关键链：`ToolApprovalOperation::run → inspect_tools`。从本次kickoff后的消息重建审批状态，AlwaysAllow/AlwaysDeny更新权限管理，再由inspector处理待执行请求；Chat模式走不同分支。

设计启示：审批记录与运行模式共同决定可执行性，不能只按工具readOnly提示推断安全，也不能把所有模式概括为同一流程。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_tool_approval.rs#L45-L105) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_tool_approval.rs#L45-L105)。


### 预算

关键链：`MaxTurnsOperation::run / moim_parts`。统计kickoff后的assistant turns，达到max_turns时yield并请用户继续，过半时可注入已用预算提示。

设计启示：限制自主轮数不等于全部工具动作次数，更不是共享子任务费用账本；计数单位需要呈现。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/crates/goose/src/agents/state_machine/ops_maxturns.rs#L14-L68) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_maxturns.rs#L14-L68)。


### 评测

关键链：`GooseBinaryAgent / _run_env`。Harbor适配器使用调用方提供的二进制、配置模板与扩展条目，在任务容器中设置模型和provider。

设计启示：完整配置显式化便于复现，但结果受模型、扩展和容器条件影响；本书未执行这些benchmark。

范围：已读实现；本轮未运行模型或服务实验。来源：[本地实现](../../goose/evals/harbor/agent.py#L34-L92) · [固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/evals/harbor/agent.py#L34-L92)。


## 记忆更新补充：从触发到下一次读取

以下补足跨文件协调链；它们仍是静态实现事实，没有新增效果实测。

### Codex CLI 的更新与生效

`start_memories_startup_task`：非ephemeral、启用MemoryTool且是根会话才启动异步管线；可dual-write两版本。先检查state DB、建目录并prune，再过rate-limit guard，按顺序运行phase1和phase2。触发是合格会话启动，不是每轮任意输出都立即写长期记忆。 [本地实现](../../codex/codex-rs/memories/write/src/start.rs#L20-L94) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/memories/write/src/start.rs#L20-L94)。

`claim_startup_jobs`：第一阶段从state DB按允许交互来源、最大候选数、历史年龄、空闲小时与租约领取历史rollout；run_jobs并行提取，成功提交还携ownership_token与source_updated_at，保存raw_memory、rollout_summary。领取与提交分开，避免将过期工作当最新提取。 [本地实现](../../codex/codex-rs/memories/write/src/phase1.rs#L119-L155) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/memories/write/src/phase1.rs#L119-L155)。

`phase2::run`：第二阶段先领全局锁，准备Git基线记忆工作区与收紧配置，再从DB选择有效raw memories、同步到workspace，并检查diff；有变化才继续启动consolidation agent。整合写入不是单条对话直接覆盖summary。 [本地实现](../../codex/codex-rs/memories/write/src/phase2.rs#L49-L135) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/memories/write/src/phase2.rs#L49-L135)。

`spawn_consolidation_agent → agent::handle`：整合Agent使用版本化root的prompt；后续handler接管完成处理、心跳和基线重置。进程里有任务返回并不代表summary已经可读。 [本地实现](../../codex/codex-rs/memories/write/src/phase2.rs#L154-L184) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/memories/write/src/phase2.rs#L154-L184)。

`build_memory_tool_developer_instructions`：读取版本root下memory_summary.md，按summary token上限裁剪，再渲染对应V1/V2模板；读不到或空内容不注入。扩展构造thread context时调用它；配置变化保留原version，使注入和检索namespace一致。 [本地实现](../../codex/codex-rs/ext/memories/src/prompts.rs#L30-L68) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/ext/memories/src/prompts.rs#L30-L68)。

### Gemini CLI 的更新与生效

`startAutoMemoryIfEnabled`：启用Auto Memory后才后台startMemoryService；调用点包括CLI AppContainer及ACP会话创建/恢复。开关、触发宿主和是否后台等待应随部署记录。 [本地实现](../../gemini-cli/packages/cli/src/utils/autoMemory.ts#L13-L21) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/cli/src/utils/autoMemory.ts#L13-L21)。

`startMemoryService`：获取项目目录独占锁，注册可取消后台执行，读取提取状态；距上次不足30分钟或没有新合格session则跳过。候选以已保存聊天与索引为输入，不是把当前模型一句话直接当记忆事实。 [本地实现](../../gemini-cli/packages/core/src/services/memoryService.ts#L1133-L1207) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/services/memoryService.ts#L1133-L1207)。

`extraction state / memory inbox feedback`：结果记录已处理会话、新技能、patch与memory候选并原子写提取状态；反馈明确要求/memory inbox review。候选产生与权威记忆应用是两步。 [本地实现](../../gemini-cli/packages/core/src/services/memoryService.ts#L1410-L1461) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/services/memoryService.ts#L1410-L1461)。

`applyMemoryPatchFile`：用户采用候选时解析patch，检查有效hunk、目标目录与allowlist，再应用；非法路径或解析失败保留错误。memoryCommand的onReloadMemory回调随后调用refreshMemory，MemoryContextManager重新读取并发出变化事件，完成“候选→接受→刷新”的读取衔接。 [本地实现](../../gemini-cli/packages/core/src/commands/memory.ts#L780-L832) · [固定提交](https://github.com/google-gemini/gemini-cli/blob/ed96faedfd5571f055c44f2c9509d62321d1138d/packages/core/src/commands/memory.ts#L780-L832)。

### Qwen Code 的更新与生效

`managed memory scheduling`：受开关控制，UserQuery和ToolResult可调metadata migration；Extract/Dream仅按UserQuery调度，隐藏session-agent对话被排除。此处“每个工具完成都必提取”的概括不成立，应以当前路径条件为准。 [本地实现](../../qwen-code/packages/core/src/core/client.ts#L3184-L3267) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/core/client.ts#L3184-L3267)。

`scheduleExtract`：主Agent本轮已写memory文件时跳过自动提取，避免重复竞争；同项目提取正在运行时，后续请求以尾随队列合并/替换为较新参数。后台记录与原始记忆文件不能用一个success状态混同。 [本地实现](../../qwen-code/packages/core/src/memory/manager.ts#L1093-L1160) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/memory/manager.ts#L1093-L1160)。

`recall prefetch`：新查询取消旧prefetch，父abort连接到召回abort；按projectRoot、query、recentTools调用Manager.recall，legacy模式还排除已展示文件。读回内容何时展示仍由前台安全投递边界决定，而不是后台一写文件就自动变成当前输入。 [本地实现](../../qwen-code/packages/core/src/core/client.ts#L1432-L1468) · [固定提交](https://github.com/QwenLM/qwen-code/blob/4e2753b006bde1bd42476c62161f6d6fd241c9bf/packages/core/src/core/client.ts#L1432-L1468)。

### OpenCode 的更新与生效

`SessionContext.select → load`：每次准备从builtins/discovery/skills/references/MCP/entries取得指令来源，组合后由SessionHistory为runner装配。持续项目说明的改变要通过这一读取链进入请求。 [本地实现](../../opencode/packages/core/src/session/context.ts#L134-L178) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/context.ts#L134-L178)。

`InstructionState.observe → commit`：observe并行读取指令source和DB现状，比较hash生成delta；变化以InstructionsUpdated持久事件提交，并冻结当时渲染文字。初始baseline与后续时序更新分别处理，避免之后换Location重渲染旧历史。 [本地实现](../../opencode/packages/core/src/session/instruction-state.ts#L21-L60) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/session/instruction-state.ts#L21-L60)。

`Instructions.read / diff`：每个source.read得到observed value；缺失、删除和未变化hash分别处理，初始化不可用会阻断。这里更新的是持久指令来源及其版本，不是本轮已证明存在的自动经验提取器。 [本地实现](../../opencode/packages/core/src/instructions/index.ts#L134-L159) · [固定提交](https://github.com/anomalyco/opencode/blob/65932e870ca50d21886f9d0ee89c6603bac34a65/packages/core/src/instructions/index.ts#L134-L159)。

## 横向结论与下一步

循环的共同点是“根据反馈继续”，差异在执行单位：Codex 的 turn/step、Pi 的核心与宿主投影、Goose 的状态机操作、Gemini/Qwen 的client与scheduler、OpenCode 的持久session服务、Cline SDK 的iteration、Aider 的编辑反射，以及OpenHands前端委托的外部runtime。比较时先固定这一单位，才有可能解释同名的继续、压缩或限制。

记忆不能只比较文件名：静态项目约定、后台提取、当前输入、子会话进度和版本控制恢复各回答不同问题。权限也不能只比较是否弹窗：调用前hook、最终参数policy、service credential和隔离环境各自承担一段责任。

第一版业务设计可以从风险决定边界：探索查询保持可组合，关键写入采用明确业务身份和独立权限；任务状态保存观察和未决事实，模型输入只投影当前所需材料；子任务返回终止状态和来源，协调者独立验收。增加机制会增加配置、状态协调与维护成本，需要针对具体任务验证，不能从本轮静态核对推出成功率排名。

下一轮优先补齐本轮明确委托的实现：OpenHands所接agent-server与extensions的固定依赖版本、Cline SDK之外宿主的默认装配、Qwen外部executor与MCP完整路由、Codex记忆写入与读取注入协调。其余机制也需在业务环境运行故障注入和重复任务后，才能形成任务效果结论。

