# 委派与交接：更多 Agent 之后，谁负责收尾？

> 核对日期：2026-10-17。对象：OpenAI Agents SDK Python `9abc9182d06dbd28330af888306031269d57a175`、Deep Agents `e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27`，均与 [SOURCES.json](../../SOURCES.json) 一致。本记录对照固定源码、上游测试定义，以及本书已运行的 SDK 五场景实验。没有运行外网模型、Deep Agents 实验或上游测试；实现事实、运行观察与设计推断分别说明。

## 范围与实际入口

本记录追踪 OpenAI Agents SDK 的 **3 个调用者运行入口**：异步 `Runner.run`、同步 `Runner.run_sync`、流式 `Runner.run_streamed`。统计的是应用启动一次 Agent 运行的方法，不包括实时语音、实验性扩展和自定义 Runner。`run_sync` 包装异步运行；流式入口返回供调用者消费事件的运行结果。`Agent.as_tool()` 和 `handoff()` 是组装协作关系的方法，不是两个额外的应用运行循环。[^o01][^o02]

在模型能够点名的层面，`as_tool()` 为一个被包装的 Agent 生成一个函数工具，交接关系也各自提供一个模型可见的交接工具名称；数量随配置变化。本记录比较这 **2 条协作路径**，不能据此声称 SDK 总共只有两个工具。Deep Agents 则只对照 **1 个模型工具入口 `task`**：它用 `subagent_type` 选择子代理，内部有同步和异步处理函数，两者不是模型看到的两个工具。本文不分析 Deep Agents 的异步远程子代理路径，也不概括它的整个协作系统。[^o03][^o08][^d01]

设想用户要求写一份供应商调查报告。协调者让研究者查资料，研究者返回五条发现。研究者结束，只说明这次资料子任务得到了一个输出；协调者还要决定资料够不够、结论是否矛盾、是否需要补查，以及何时向用户交稿。如果应用直接把会话转交给另一名专员，接下来回答用户的人就换了。这里的关键区别是“谁继续决策、谁拥有交稿职责”，不是 Agent 名字是否听起来更专业。

上面的情境是解释机制的例子，不是这两个库已经实现的特定业务流程。SDK 提供运行与编排机制；最终应用仍然要定义“调查报告完成”的业务标准。

## 先区分执行者、输入与基础设施

调用者把起始 Agent、输入和配置交给 `Runner`。`Runner` 维持模型调用循环，根据返回内容执行工具、切换 Agent 或形成最终结果。`Agent` 保存指令、工具和交接关系等配置；模型响应中的函数调用只是动作请求，不会自行启动另一个运行循环。SDK 将交接名称匹配到交接分支，将普通函数工具名称匹配到函数工具分支。[^o01][^o04]

`as_tool()` 生成的包装函数负责把工具参数变为子代理输入，调用子 `Runner`，再将子结果适配成父工具结果。`handoff()` 生成的回调负责解释交接参数、运行应用的 `on_handoff` 回调并交回目标 Agent；随后仍由当前 `Runner` 切换执行者。输入构建器、交接回调和实际业务工具是应用接入业务的适配位置，不应杜撰为 SDK 中一个统一名叫 `Port` 的接口。[^o03][^o05][^o08][^o09]

`HandoffInputData` 是过滤历史时使用的数据对象，`RunResult` 是运行结果，均不是独立执行入口。`Session` 是供不同存储实现接入的会话历史协议，提供获取、追加、弹出和清空历史的方法；它属于持久化基础设施。`RunContextWrapper` 则携带应用交给代码的上下文与用量信息，其 `context` 不会自动发送给模型。会话历史、应用上下文和模型本次输入必须分别讨论。[^o10][^o11][^o12]

## 路径一：把另一个 Agent 当作工具调用

本节追踪一个由 `worker.as_tool(...)` 生成的模型工具入口。调用者仍从上述三个 `Runner` 方法之一启动父运行，包装函数内部再启动子运行。

```text
应用启动父 Runner
→ 父模型提出某个 Agent 工具调用
→ 工具执行层建立 ToolContext 并检查工具批准状态
→ as_tool 包装函数校验参数，构造子输入
→ 包装函数调用子 Runner.run（提供 on_stream 时改用 run_streamed）
→ 子 Runner 取得最终输出、暂停结果或异常
→ 包装函数提取输出，作为父工具结果
→ 父 Runner 按 tool_use_behavior 决定继续问父模型还是结束
```

这条链的工具上下文、批准检查和嵌套运行均能在实现中直接对应，不能把模型发出工具调用写成子代理已经完成工作。[^o05][^o06][^o07]

### 默认传递的是生成的子任务输入

**事实。** 默认工具参数是 `{"input": "..."}`，输入解析器返回其中的字符串；支持结构化参数和自定义 `input_builder`，构建结果可以是字符串或输入项列表。默认路径没有把父运行的全部消息历史拼进子输入；应用可以用构建器或子会话配置有意提供更多资料。[^o05][^o13]

**事实。** 父运行的应用上下文与消息历史不是同一份东西。在正常工具执行路径中，`as_tool` 建立新的 `ToolContext`，但将 `context.context` 和 `context.usage` 传给它，同时使用新的批准状态包装。没有显式设置子 `run_config` 时，它可以继承父工具上下文中的运行配置。子运行调用中传入的 `session`、`conversation_id` 和 `previous_response_id` 来自 `as_tool` 自身参数；不能据共享应用上下文推断子代理自动加入父会话。[^o05][^o06]

**设计推断。** 研究者看不到父模型的全部消息，并不意味着它与父任务之间有完整的业务隔离：业务工具可能通过共享的应用对象访问相同服务，双方也可能读写同一外部系统。反过来，继承同一个应用对象也不意味着模型已经看到了对象里的事实。正文应分别画出消息输入、代码依赖和外部资源三条关系。

### 返回的是一个被选取的输出，不是子过程的全部知识

**事实。** 自定义提取器可以读取子运行结果；没有提取器时，包装器优先取非空的 `final_output`。若最终输出为空且输出防护检查已经运行，保留这个最终输出；否则向后查找这次子运行里最近的非空消息或字符串工具输出。遇到嵌套批准暂停，包装器会记录子运行结果供后续恢复，不能把它简单描述为“子代理没有答案就失败”。[^o07]

**事实。** 父 Agent 默认的 `tool_use_behavior` 为 `run_llm_again`，工具结果会交回父模型。但应用可以选择 `stop_on_first_tool`、指定工具即停止或自定义结果处理；这时子工具结果可能直接成为父运行的最终输出。因此“Agent 当工具时父模型一定再审查一遍”也不是成立的普遍断言。[^o14]

**设计推断。** 工具结果让协调者有机会继续判断，并不会强迫协调者正确验收。子研究者说“已完成”、包装器返回文本、父运行生成 `final_output`、业务报告满足验收条件，是四件需要分别确认的事。

## 路径二：将当前会话交给另一名 Agent

本节追踪一个配置的交接工具入口。交接仍发生在同一次 `Runner` 中，没有像 `as_tool` 那样启动一个等待回传的子 `Runner`。

```text
应用启动 Runner，当前 Agent 为 A
→ A 的模型提出交接工具调用
→ SDK 匹配交接名称，解析交接参数并运行 on_handoff
→ 交接回调返回目标 Agent B
→ SDK 记录交接项，按配置整理传给 B 的历史
→ 同一个 Runner 将 current_agent 改为 B
→ 下一轮调用 B，后续最终输出由当时的 current_agent 产生
```

**事实。** `handoff(agent=B, ...)` 的帮助函数最终总返回所捕获的 B；`on_handoff` 用于副作用或记账，并不是让这个帮助函数任意选择动态目的地。`execute_handoffs` 调用交接回调，构造交接输出项并返回 `NextStepHandoff`；运行循环收到它后替换 `current_agent`，没有在这条分支创建子 `Runner`。[^o08][^o09][^o15]

**事实。** 一次模型响应请求多个交接时，实现采用第一个，其余交接得到被忽略的工具输出；不能把它理解为把当前会话同时转给所有目标 Agent。[^o09]

### 交接参数与交接历史是两条通道

**事实。** `input_type` 校验的是模型生成的交接工具参数，解析值交给 `on_handoff`；它不替换目标 Agent 的主输入。历史由 `HandoffInputData` 表达为初始历史、交接前生成项和本轮新项；可用 `input_filter` 改写。具体交接的过滤器优先于 `RunConfig` 全局过滤器。[^o08][^o10][^o16]

**事实。** 默认不启用 `nest_handoff_history`；没有过滤或嵌套时，交接实现保留原输入和已生成项。过滤器可以区分保存在会话中的项和提供给目标模型的项，因此“目标看到的输入”和“会话里保存的全部记录”也不一定相同。[^o16][^o17]

**事实。** 服务端管理历史的配置有单独限制：设置 `conversation_id`、`previous_response_id` 或自动响应链等模式时，交接输入过滤会被拒绝；自动嵌套历史会给出警告并停用。不能无条件承诺应用可在所有历史管理模式里自由裁剪交接输入。[^o18]

### 换执行者，并不自动安排返回给原协调者

**事实。** 交接后结果构造使用当前 Agent 作为 `_last_agent`，`final_output` 来自当前步骤的最终输出；这条分支没有自动回到 A 再汇总的步骤。若业务需要 B 完成后交回 A，应用必须另行设计反向交接、外层编排或其他明确的返回过程。前半句是实现事实，后半句是由运行链得出的设计要求。[^o15][^o19]

**设计推断。** 交接适合表达“下一阶段由谁继续服务当前会话”；当用户期待一位总负责人持续收集、协调和交稿时，应用则应明确谁保存这份责任。两者都可以组成更复杂流程；源码不支持对其中一种作普遍优劣排名。

## `max_turns` 限制哪一层？

**事实。** 对 `Runner.run`，一轮定义为一次模型调用，包含该次调用所引出的工具执行。新运行从 `current_turn = 0` 开始；每次准备进入模型轮次时先加一，超过限制则触发 `MaxTurnsExceeded`，也可以配置对应错误处理器。直接调用 `Runner` 时可用 `max_turns=None` 关闭轮数限制；默认常量为 10。它不是秒数、token 数或业务工具动作总数。[^o01][^o20]

**事实。** 交接只替换同一循环中的 `current_agent`，不清零 `current_turn`，所以一次运行中的 A→B→C 交接共同消耗这次 `Runner` 的轮数。用保存的 `RunState` 恢复时，代码取回状态中的 `_max_turns`，不能将每次恢复调用都视为预算重置。[^o15][^o20][^o21]

**事实。** 流式运行也在自身循环中累加 `current_turn` 并检查同一 `max_turns`，交接分支替换当前 Agent，没有为每个交接目标重建轮数。本文没有把同步、异步和流式三种调用形式误当作三种不同的协作预算。[^o26]

**事实。** `as_tool` 单独解析 `resolved_max_turns`，再传给子 `Runner`；它没有读取父 Runner 已经消耗的轮数来分配剩余额度。未设值或传 `None` 都在此处解析为 `DEFAULT_MAX_TURNS`，与直接 `Runner.run(max_turns=None)` 的语义不同。新子运行从自己的零轮开始；若恢复已暂停的子运行，则应遵循保存状态的预算，而不是把恢复当成新子任务。[^o05][^o06][^o20][^o21]

**设计推断。** 外层限制 2 轮，不能据此推出整棵委派树最多调用 2 次模型；一个外层工具轮次中可以进入另一个有独立轮数的运行。共享 `usage` 便于汇总用量，但本节所核对的代码没有将这个共享计数自动变为“全任务剩余额度”。若应用要求总费用、总时间或总模型调用次数，需要在这个边界上设计并执行共享额度，而不是只把一个外层 `max_turns` 配小。

## 错误究竟交给谁？

**事实。** `as_tool` 的普通 `Exception` 进入函数工具失败包装器：默认失败处理器返回固定错误文本供父模型接收；自定义处理器可以提供应用批准的错误文本；设置 `failure_error_function=None` 则重新抛出。上游有相应测试定义，但本轮没有执行它们。这个包装只捕获 `Exception`，不能推广成所有取消或 `BaseException` 都变成模型反馈。[^o03][^o22][^o23]

**事实。** 子运行超过轮数也会产生普通的 SDK 异常，因此在默认 `as_tool` 失败策略下可以成为父工具失败反馈，而不是必然终止整个父流程；若显式禁用失败格式化，异常会向外传播。此结论由轮数异常和工具包装调用链共同得到，不是本轮运行实验。正常工具执行层对未处理的 SDK `AgentsException` 会继续抛出，对其他普通异常则包装为 `UserError`。[^o20][^o22][^o24][^o27]

**事实。** `handoff` 没有 `as_tool` 这项 `failure_error_function` 参数。交接回调在 `execute_handoffs` 中直接被等待，交接帮助函数的错误处理也没有把普通应用异常转成一个“子研究者失败”的文本结果。不要把普通函数工具的默认失败策略原样套到交接分支。[^o08][^o09][^o25]

**设计推断。** “运行没有抛异常”与“研究者没有失败”不是同一件事：失败可能已经变为父模型看到的一段文本。应用应记录错误状态及验收结果，避免只检查最终文本是否非空。

## Deep Agents 的 `task`：同为委派，交付边界仍要细看

本节仅追踪 **1 个模型工具 `task`**。`TaskToolSchema` 是其输入数据，提供任务描述 `description` 和目标类型 `subagent_type`；`ToolRuntime` 由运行系统注入，不是模型又要调用的工具。`SubAgentMiddleware` 负责安装工具；内部包装函数选择已编译子图、准备状态并调用 `invoke` 或 `ainvoke`；子图执行和 `Command` 更新由下层运行基础设施承担。[^d01][^d02][^d03]

```text
父模型调用 task(description, subagent_type)
→ 包装函数选择子代理
→ 按 isolated / fork 模式准备消息和允许传递的状态
→ 子代理图 invoke / ainvoke
→ 提取结构化结果或最近的非空 AI 文本
→ 构造 Command，把结果作为父 ToolMessage 并合并允许的状态更新
→ 父图继续
```

**事实。** 默认 `isolated` 模式用一条任务描述的 `HumanMessage` 作为子消息；同时将父状态中未被排除的部分传给子代理。因此它隔离的是这条默认消息路径，不能写成所有状态均隔离。`messages`、`todos`、`structured_response`、Skills 的若干运行字段、业务评分字段和代理私有字段有专门排除规则。[^d03][^d04]

**事实。** 这份快照还包含实验性的 `mode="fork"`：子代理继承父有效历史及相应状态，具体过滤规则区分声明式子代理和已编译子图。声明式 fork 会设置标记，使其中的 `task` 拒绝再次委派。不能沿用“Deep Agents 的所有子代理都只看到任务字符串”的旧概括，也不能由这条 fork 限制推出整个系统不支持任何递归或其他协作方式。[^d03][^d05]

**事实。** 子图返回必须含 `messages`。包装器优先把 `structured_response` 序列化为结果文本，否则从后向前选择最近的非空 AI 文本，再生成匹配原调用编号的 `ToolMessage`。子代理整个消息历史不会原样并回父消息；其他合规且确实改变的状态项可通过 `Command.update` 返回。[^d06]

**事实。** 未知 `subagent_type` 在该处理函数中返回说明文本，缺调用编号则抛 `ValueError`；对子图的 `invoke` / `ainvoke` 没有在这段包装函数内增加通用异常转换或重试。本记录没有继续核对所有外层工具节点策略，因此不能把这个局部事实写成 Deep Agents 所有子任务失败必定终止或必定交回模型。[^d03]

**事实与边界。** `task` 的模型参数没有 `max_turns`；包装器只显式加子代理跟踪配置。源码说明其余配置从环境继承、子图绑定配置在冲突时生效；上游测试定义检查子工具取得子图绑定的 `recursion_limit=5000`，而主图装配默认绑定 `9999`。这说明轮数/图步数配置不能脱离实际调用链来比较。本轮未审计下层 LangGraph 的全套步数、取消和预算语义，不将这些数字换算为全树总模型调用次数，也不将它们与 SDK 的 `max_turns` 直接等同。[^d03][^d07][^d08]

## 三种协作路径的比较

以下是限定在本记录所追踪路径中的对照，默认行为均可被明确配置改变。

| 读者的问题 | SDK Agent 当工具 | SDK 交接 | Deep Agents 默认 `task` 路径 |
| --- | --- | --- | --- |
| 谁继续作决策？ | 子 Runner 返回父工具层，父运行按工具结果策略继续或结束 | 同一 Runner 换当前 Agent | 子图返回结果和状态更新，父图继续 |
| 默认子输入从哪里来？ | 工具生成的 `input` 字符串 | 当前运行的历史与交接项 | 任务描述形成一条子消息，另有经筛选的状态 |
| 谁持有历史？ | 子 Runner 使用自己的输入及显式配置的会话 | 同一运行持有历史，可按交接配置整理 | 默认子消息独立；fork 是另一条显式配置路径 |
| 原协调者一定再汇总吗？ | 不一定，取决于 `tool_use_behavior` | 没有自动返回原协调者的步骤 | 工具结果交回父图，不等于父业务必定正确验收 |
| 限额的计数边界是什么？ | 外层与新子 Runner 各自计轮 | 同一 Runner 内交接共用计轮 | 此处核对到配置传递，未证明全树共享额度 |

表格对应的实现分别见上文引用；它不构成质量、安全性或性能排名。[^o05][^o06][^o14][^o15][^o20][^d03][^d06]

三个执行者都返回“完成”，最终报告仍可能缺少一项用户要求。应用因此需要明确交付物、子结果的来源与未解决问题、跨结果的一致性检查、失败反馈、预算扣减与最终汇报。上述框架提供了安排这些责任的位置，完整业务验收仍由应用定义。

## 不调用外网模型的实际实验

该 SDK 快照公开导出 `ScriptedModel`、`ModelStep`、`assistant_message` 与 `function_call`，允许以预编排响应检查运行控制，不必调用真实模型。运行仍需 SDK 的实际依赖，不能只用 Python 标准库。[^t01][^t02][^t03]

本书在独立环境安装固定本地 SDK，保留 [第三方依赖锁](../../experiments/agents-sdk-dependencies.lock)，关闭追踪后运行 [委派预算脚本](../../experiments/agents_delegation_budgets.py)。[五场景结果](../../experiments/results/agents-delegation-budgets.json) 记录调用次数、最后执行者、异常与工具结果；复现命令见 [实验目录](../../experiments/README.md#委派交接与轮数边界)。[^o17]

交接场景中，协调者与接收者共用同一次运行的轮数上限；工具式委派中，子运行有自己的上限。外层上限为两轮、子运行采用默认值时，协调者调用两次、子执行者调用两次，共四次预编排模型调用。

子运行被限制为一轮时，实验观察到超限异常。错误回调记录异常类型后调用 SDK 默认处理器，父运行拿到通用工具错误，仍能在后续返回预设的完成文本。这里的文本由实验事先安排，不是让真实模型作出判断；它说明父运行正常返回与业务目标达成仍需分别检查。

Deep Agents 仅做源码核对。上游测试提供 `GenericFakeChatModel`，已有父调用 `task`、子返回、父继续的测试定义；本轮没有执行这些测试。[^t04][^t05]

输入过滤前后的实际模型请求、同一 `RunState` 恢复后的轮数，以及取消过程中并行子任务的收尾，仍需另设场景。

## 当前研究能够说明什么

已核对两个项目的上述协作路径，并实际运行 SDK 的五个受控场景。取消时所有并行子任务的收尾、全部会话后端、SDK 的所有实验性扩展与 Deep Agents 远程异步子代理不在本轮完整覆盖范围内。

最适合写入正文的判断是：**增加执行者会增加需要明说的交付边界。** 它是从控制权、输入、结果和预算边界推导出的设计观点。子运行产生输出并不自动证明用户任务完成；哪位组件负责验收、汇总和最终交付，应用应给出明确规则。

## 源码与参考资料

下列本地链接和 GitHub 链接逐项对应，GitHub 使用完整固定 SHA。

[^o01]: [本地 Runner 异步入口与约定](../../openai-agents-python/src/agents/run.py#L279-L364) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L279-L364)。
[^o02]: [本地同步入口](../../openai-agents-python/src/agents/run.py#L385-L407) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L385-L407)；[本地流式入口](../../openai-agents-python/src/agents/run.py#L488-L509) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L488-L509)。
[^o03]: [本地 as_tool 参数及职责](../../openai-agents-python/src/agents/agent.py#L606-L667) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L606-L667)。
[^o04]: [本地响应中交接与函数工具的分类](../../openai-agents-python/src/agents/run_internal/turn_resolution.py#L3780-L3828) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L3780-L3828)。
[^o05]: [本地参数解析、输入、限额、子上下文](../../openai-agents-python/src/agents/agent.py#L721-L789) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L721-L789)。
[^o06]: [本地流式子运行](../../openai-agents-python/src/agents/agent.py#L926-L946) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L926-L946)；[本地普通子运行](../../openai-agents-python/src/agents/agent.py#L1043-L1059) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L1043-L1059)；[本地工具上下文和批准检查](../../openai-agents-python/src/agents/run_internal/tool_execution.py#L1816-L1847) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/tool_execution.py#L1816-L1847)。
[^o07]: [本地子结果提取与包装](../../openai-agents-python/src/agents/agent.py#L1062-L1115) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L1062-L1115)。
[^o08]: [本地交接帮助函数、参数及回调](../../openai-agents-python/src/agents/handoffs/__init__.py#L267-L350) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/handoffs/__init__.py#L267-L350)；[本地交接对象构造](../../openai-agents-python/src/agents/handoffs/__init__.py#L352-L381) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/handoffs/__init__.py#L352-L381)。
[^o09]: [本地交接执行、多个交接处理](../../openai-agents-python/src/agents/run_internal/turn_resolution.py#L580-L650) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L580-L650)。
[^o10]: [本地交接输入数据](../../openai-agents-python/src/agents/handoffs/__init__.py#L70-L99) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/handoffs/__init__.py#L70-L99)。
[^o11]: [本地 Session 协议](../../openai-agents-python/src/agents/memory/session.py#L52-L93) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/memory/session.py#L52-L93)。
[^o12]: [本地应用上下文与用量](../../openai-agents-python/src/agents/run_context.py#L175-L200) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_context.py#L175-L200)。
[^o13]: [本地默认工具参数](../../openai-agents-python/src/agents/agent_tool_input.py#L21-L24) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent_tool_input.py#L21-L24)；[本地输入构建](../../openai-agents-python/src/agents/agent_tool_input.py#L79-L107) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent_tool_input.py#L79-L107)。
[^o14]: [本地工具后续行为配置](../../openai-agents-python/src/agents/agent.py#L396-L416) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L396-L416)；[本地工具结果终止判断](../../openai-agents-python/src/agents/run_internal/turn_resolution.py#L776-L805) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L776-L805)。
[^o15]: [本地交接下一步](../../openai-agents-python/src/agents/run_internal/turn_resolution.py#L752-L772) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L752-L772)；[本地循环切换当前 Agent](../../openai-agents-python/src/agents/run.py#L2386-L2408) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L2386-L2408)。
[^o16]: [本地交接历史过滤和会话视图](../../openai-agents-python/src/agents/run_internal/turn_resolution.py#L652-L751) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L652-L751)。
[^o17]: [本地默认历史与关闭跟踪配置](../../openai-agents-python/src/agents/run_config.py#L377-L416) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_config.py#L377-L416)。
[^o18]: [本地服务端历史的交接限制](../../openai-agents-python/src/agents/run_internal/turn_resolution.py#L512-L541) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/turn_resolution.py#L512-L541)。
[^o19]: [本地最终运行结果构造](../../openai-agents-python/src/agents/run.py#L2241-L2272) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L2241-L2272)。
[^o20]: [本地新运行计数起点](../../openai-agents-python/src/agents/run.py#L834-L848) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L834-L848)；[本地计轮与超限处理](../../openai-agents-python/src/agents/run.py#L1597-L1622) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L1597-L1622)；[本地默认轮数](../../openai-agents-python/src/agents/run_config.py#L45) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_config.py#L45)。
[^o21]: [本地恢复运行使用保存的轮数限制](../../openai-agents-python/src/agents/run.py#L678-L697) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L678-L697)。
[^o22]: [本地函数工具异常包装器](../../openai-agents-python/src/agents/tool.py#L697-L711) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/tool.py#L697-L711)；[本地默认失败文本](../../openai-agents-python/src/agents/tool.py#L1997-L2002) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/tool.py#L1997-L2002)；[本地失败格式化选择](../../openai-agents-python/src/agents/tool.py#L2094-L2108) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/tool.py#L2094-L2108)。
[^o23]: [本地上游测试：重新抛出与自定义失败处理](../../openai-agents-python/tests/test_agent_as_tool.py#L3343-L3435) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/tests/test_agent_as_tool.py#L3343-L3435)。测试定义，非本轮执行结果。
[^o24]: [本地工具执行层异常出口](../../openai-agents-python/src/agents/run_internal/tool_execution.py#L1848-L1864) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/tool_execution.py#L1848-L1864)。
[^o25]: [本地交接错误包装仍重新抛出](../../openai-agents-python/src/agents/handoffs/__init__.py#L49-L67) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/handoffs/__init__.py#L49-L67)。
[^o26]: [本地流式循环计轮](../../openai-agents-python/src/agents/run_internal/run_loop.py#L1773-L1789) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/run_loop.py#L1773-L1789)；[本地流式交接切换执行者](../../openai-agents-python/src/agents/run_internal/run_loop.py#L2184-L2203) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/run_loop.py#L2184-L2203)。
[^o27]: [本地轮数异常继承关系](../../openai-agents-python/src/agents/exceptions.py#L344-L355) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/exceptions.py#L344-L355)。
[^d01]: [本地唯一 task 工具构造](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L898-L911) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L898-L911)；[本地 middleware 安装工具](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L1001-L1022) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L1001-L1022)。
[^d02]: [本地 task 参数与注入参数](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L450-L489) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L450-L489)。
[^d03]: [本地状态准备、同步与异步调用](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L804-L896) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L804-L896)。
[^d04]: [本地输入与返回排除规则](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L404-L434) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L404-L434)。
[^d05]: [本地模式定义和实验性标记](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L84-L101) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L84-L101)；[本地 fork 排除规则和递归标记](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L52-L80) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L52-L80)。
[^d06]: [本地结果提取与 Command 更新](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L747-L787) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L747-L787)。
[^d07]: [本地测试：子工具收到绑定的递归限额及元数据](../../deepagents/libs/deepagents/tests/unit_tests/test_subagents.py#L949-L1037) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/tests/unit_tests/test_subagents.py#L949-L1037)。测试定义，非本轮执行结果。
[^d08]: [本地主图的默认图步数配置](../../deepagents/libs/deepagents/deepagents/graph.py#L995-L1017) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L995-L1017)。
[^t01]: [本地公开测试辅助接口](../../openai-agents-python/src/agents/testing/__init__.py#L1-L14) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/testing/__init__.py#L1-L14)。
[^t02]: [本地 ScriptedModel 的调用记录与消费检查](../../openai-agents-python/src/agents/testing/model.py#L249-L319) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/testing/model.py#L249-L319)；[本地规范化文本与函数调用辅助](../../openai-agents-python/src/agents/testing/model.py#L588-L638) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/testing/model.py#L588-L638)。
[^t03]: [本地 SDK 版本与运行依赖](../../openai-agents-python/pyproject.toml#L1-L23) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/pyproject.toml#L1-L23)。
[^t04]: [本地 Deep Agents 假模型及调用记录](../../deepagents/libs/deepagents/tests/unit_tests/chat_model.py#L20-L104) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/tests/unit_tests/chat_model.py#L20-L104)；[本地父子委派单测定义](../../deepagents/libs/deepagents/tests/unit_tests/test_subagents.py#L132-L201) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/tests/unit_tests/test_subagents.py#L132-L201)。
[^t05]: [本地 Deep Agents 版本与运行依赖](../../deepagents/libs/deepagents/pyproject.toml#L1-L30) · [固定提交](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/pyproject.toml#L1-L30)。
