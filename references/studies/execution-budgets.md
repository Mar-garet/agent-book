# 执行预算：明明设置了步数限制，为什么还能花掉更多资源？

> 核对日期：2026-10-17。静态源码对象：OpenAI Agents SDK Python `9abc9182d06dbd28330af888306031269d57a175`、LangGraph `41c9c22fdc83d68a2859d0c9a2b627c8615a792f`；为核对同步线程池上限，另追踪 LangChain Core 的固定源码 `bd5b134d876ef47858beef27bd29c81eeda03293`。三者均与 [SOURCES.json](../../SOURCES.json) 一致。本书已运行两组相关受控实验，本记录对照结果、脚本摘要与源码解释计数范围。下文分别标明源码事实、实验记录和应用设计推断。

## 范围与实际入口

OpenAI Agents SDK 本记录涉及的应用运行入口有 **3 个**：异步 `Runner.run`、同步 `Runner.run_sync`、流式 `Runner.run_streamed`。计数范围是应用启动 Agent 运行的方法；不把 `RunConfig`、`RunState`、输出对象或组装方法 `as_tool` 另计为运行入口。相关受控实验只调用其中 **1 个入口 `Runner.run`**，因此不能声称实验覆盖了三个入口的所有细节。[^s01][^s02]

LangGraph 本记录的实验只经由 **1 个调用入口：已编译图的 `invoke`**。这里统计实验实际调用的方法，并不是说 LangGraph 只有一个运行入口；源码还提供 `ainvoke`、`stream`、`astream` 等调用形式。`invoke` 内部消费 `stream`，由运行循环调度节点、执行任务并汇总状态，内部调用不重复算作本实验的第二个应用入口。本文核对同步路径及相关异步计数实现，但不概括所有嵌套子图、功能式任务和远程运行的额度继承规则。[^g01][^g02]

设想一个协调者在一轮中调用研究者，研究者又查两次资料。外层写了“最多两轮”，并不直接回答“所有参与者总共能发起多少次请求”。同样，一个图节点可以执行三个工具调用；把图的上限设为一步，也不等于只允许第一个工具发生。解释上限，必须同时说清**谁在计数、计的是什么、何时检查、在哪些调用之间共享**。

## 先看一条限制真正生效的位置

应用向 SDK 提供 Agent、输入和 `max_turns`。SDK 的 `Runner` 持有当前 Agent 与轮数，在准备下一次模型轮次时检查上限；工具适配器执行模型提出的动作。若工具恰好是另一个 Agent，`as_tool` 包装器还会启动一个子 Runner。输入和结果对象承载数据，业务工具和 Agent 工具包装器适配实际工作，Runner 循环与会话持久化负责基础设施。[^s01][^s03][^s04]

应用向已编译 LangGraph 提供状态和配置。图循环确定本次调度批次，任务执行器运行节点；`ToolNode` 是把节点输入中的工具请求分派给业务函数的适配器。`RetryPolicy` 是重试配置，`RunnableConfig` 是本次调用的配置数据，均不是独立执行入口。图循环、后台执行器、检查点存储和重试执行器负责支撑调度。[^g01][^g03][^g04][^g05]

两条调用链可分别概括为：

```text
应用 → Runner.run
     → 当前 Runner 的轮数检查 → 模型轮次 → 工具执行
       → 若工具为 Agent：子 Runner 自己的轮数检查 → 子模型/工具
     → 当前 Runner 下一轮或最终结果

应用 → compiled.invoke → stream → 图循环的一次 superstep
     → 本步节点任务 → 每个任务的重试循环 → 节点内部的工具批次
     → 更新图状态 → 下一 superstep 或结束
```

`superstep` 在这里指一批节点任务共享同一轮状态、执行完再统一更新的调度阶段，可称“图的调度步”。同一步里可以选出多个节点；并发度限制可以使其中一部分先后执行，但不会因此把它们重新定义成多个调度步。[^g03][^g04]

## SDK：`max_turns` 限制当前 Runner 的模型轮次

### 新运行、交接、子运行分别怎么算

**事实。** `Runner.run` 将一轮说明为一次模型调用及其工具执行。新运行从 `current_turn=0` 开始；准备下一轮时先加一，超过 `max_turns` 则产生 `MaxTurnsExceeded`，除非配置的对应错误处理器接管。默认值为 10；直接调用 Runner 时传 `None` 可关闭该轮数限制。它没有在这处检查中把工具调用数、token 数、运行秒数或金额拿来与轮数比较。[^s01][^s03][^s05]

**事实。** `handoff` 让同一个运行循环替换当前 Agent；该分支没有将轮数清零。所以一次 Runner 内的交接共同消耗该运行的轮数。流式运行也在自己的循环累加轮数并切换当前 Agent。[^s06][^s07]

**事实。** `as_tool` 另行解析子 `max_turns` 并调用子 `Runner.run`，提供流回调时调用子 `run_streamed`。未设置子限制或传 `None` 时，该包装器解析为默认 10，不能把它理解为自动领取父运行的剩余轮数。父 `run_config` 可以继承，但这不等于父轮数余额也被继承。[^s04]

**事实。** 使用 `RunState` 恢复 SDK 运行时，Runner 从状态取回 `_max_turns` 与 `_current_turn`；新运行才采用从零开始的分支。由此应区分“恢复同一次运行”与“拿着类似消息另开一次运行”。对已暂停子 Runner 的恢复，也不能无条件套用“每次调用都从零开始”。[^s08]

### 一轮也不应直接等同所有网络尝试

**事实。** SDK 实际请求路径会把模型的 `get_response` 放入 `get_response_with_retry`。后者有自己的请求尝试循环，依据重试条件决定是否再次调用，并将已处理的失败尝试加入用量记录。因而 Runner 的轮数、脚本替身的模型调用数、模型提供方实际收到的请求尝试数是需要区分的统计量。不能由 `max_turns=N` 无条件推出网络最多尝试 N 次，也不能反过来把所有失败都说成会自动重试。现有五场景实验没有测试这条模型请求重试分支。[^s09][^s10]

**事实。** 正常的 Agent 工具路径可以共享应用上下文和 `usage`；`Usage` 记录请求与 token，并提供累加方法。被核对的 `max_turns` 检查仍然只比较当前 Runner 的轮数，没有拿共享 `usage` 与某个全树硬额度作原子扣减。这里确认的是这条调用链，不能据此宣称 SDK 的其他扩展或应用自建适配器不可能实现额度控制。[^s03][^s04][^s11]

**设计推断。** 记录消费与批准消费是两个职责。报表能在结束后累计出花了多少资源，并不说明应用在每次动作之前已阻止超支。要把“整项任务最多允许四次昂贵请求”变成约束，需要所有子任务、恢复与重试都经过同一份受约束额度，而不只是在父 Runner 上填 4。

## LangGraph：`recursion_limit` 限制调度步，不数节点内部动作

### 一步里可以发生多少事

**事实。** Pregel 运行模型将一步分为规划、执行和状态更新：选出的节点在执行阶段工作，写入到下一步才可见。同步主循环先 `loop.tick()`，把本步未完成任务交给 `runner.tick()`，等待任务阶段结束，再 `after_tick()`。任务执行器在这一步内部运行一个或多个节点任务。[^g03][^g04]

**事实。** 同步 `ToolNode` 从输入解析出一批工具调用，为每个调用创建工具运行数据，再通过执行器的 `map` 运行这一整批调用。图循环不因节点内部调用三个工具就自动增加三次 `step`。因此“一步图工作”和“一次外部操作”没有固定的一对一关系。[^g05]

**设计推断。** 如果一个节点内部执行的动作数量没有另设上限，仅有图步数上限就不足以推出动作总量上限。一步可以很便宜，也可以包含大批检索、模型调用或写操作；这个差别必须在真正分派这些工作的适配器处处理。

### 超限是在图循环边界发现的

**事实。** 图循环检查 `self.step > self.stop` 后标记 `out_of_steps` 并停止；图运行退出后据此抛 `GraphRecursionError`。计步与检查位置不在业务工具的每次动作之前。返回这个异常不能直接证明节点没有执行，也不能说明已产生的业务效果被撤销。[^g06][^g07]

**事实。** 同步与异步循环进入时，都从检查点元数据计算 `step = checkpoint_step + 1`，再计算 `stop = step + recursion_limit + 1`。检查点会保存步号，后续步骤再递增；这不是“恢复把历史步数删掉”，而是本次打开循环时相对当前起点计算停止阈值。因此这里的 `recursion_limit` 不应写成跨任意多次 `invoke`、恢复与新输入都永久扣减的一份任务生命周期额度。[^g08][^g09]

**边界。** 上述语义来自本次静态阅读；现有九场景工具实验没有对“多次恢复的额度”单设场景。本记录也没有追踪复杂嵌套子图的所有配置传播和步数约束，不能据两个赋值语句概括父子图的全部预算继承。若正文需要讨论某种嵌套布局，必须固定那一条实际调用链，再补运行轨迹。

## 重试次数和并发度为什么也不是总工作量

### `RetryPolicy.max_attempts` 包含第一次尝试

**事实。** `RetryPolicy` 用于节点重试，`max_attempts` 定义包含初次执行，默认 3。同步任务执行器将节点交给 `run_with_retry`：后者清理本任务上一次尝试的图写入，再调用该节点过程；异常命中策略后增加失败计数，达到 `max_attempts` 才放弃，否则退避再试。`GraphBubbleUp` 等控制信号有单独分支，不能统称所有失败都重试。[^g10][^g11]

**事实。** 这段重试循环包住的是 `task.proc.invoke`，发生在当前节点任务内部，没有为每个尝试向外请求一个新的图调度步。对一个 `ToolNode`，重试单位可以是整批工具节点，而非仅重跑那一个失败工具。清理图写入也不是撤销业务服务已接收的请求。[^g04][^g05][^g11]

**设计推断。** “图只走了三步”与“节点过程一共执行了三次”不能直接画等号。若每步可含多个任务、每任务可重试、每尝试又含多个动作，就需要逐层给出计数范围。不要把这些乘在一起写成项目的固定成本公式：分支、缓存、捕获的错误、提早结束和节点内部逻辑都会改变实际数值。

### `max_concurrency` 控制同时运行的范围，不自动减少累计数量

**事实。** 同步图后台执行器使用配置构造线程池；LangChain Core 将 `max_concurrency` 传为线程池的 `max_workers`。同步 `ToolNode` 自己也通过该配置取得执行器。对已运行的同步工具实验，将并发度设为 1 会使工具批次按一个工作线程执行，但批次的其他工具仍会随后执行。[^g05][^g12][^c01]

**事实。** 异步图后台执行器使用自己的信号量约束它提交的任务；异步 `ToolNode._afunc` 则创建工具协程并直接 `asyncio.gather`。这两处属于不同层。本文没有运行异步工具并发实验，也没有核对每种业务工具内部的并发限制，因而不声称“图的一个并发参数会自动串行化任意层内部所有请求”，更不将它当作整树共享总额度。[^g13][^g14]

**设计推断。** 假设必须完成 100 个动作，限制同时执行 1 个，通常表达的是排队节奏；它并没有把累计动作数量改成 1。嵌套执行器还可能各有本地上限，因此将若干本地信号量都设成同一个数字，也不能直接证明它们共享同一组全局槽位。真正的任务总量和全局并发约束应分别设计。

## 已运行的脚本记录

本书已运行 [SDK 委派预算实验](../../experiments/agents_delegation_budgets.py) 与 [LangGraph 工具边界实验](../../experiments/langgraph_tool_boundaries.py)，分别保存 [五场景记录](../../experiments/results/agents-delegation-budgets.json) 和 [九场景记录](../../experiments/results/langgraph-tool-boundaries.json)。两份记录的 `script_sha256` 与相应脚本一致，固定源码提交也与清单一致。实验使用本地预置模型或模拟服务，没有调用远程模型。

SDK 实验采用真实 `Runner.run` 和 `ScriptedModel`，五个场景的全部断言已经通过：

| 场景 | 协调者 / 专员的替身调用数 | 观察到的结果 |
| --- | --- | --- |
| 同一次 Runner 交接，上限 1 | 1 / 0 | `MaxTurnsExceeded`，专员尚未调用 |
| 同一次 Runner 交接，上限 2 | 1 / 1 | 专员生成最终输出 |
| Agent 当工具，外层上限 2、子默认 | 2 / 2 | 总计 4 次替身调用，协调者生成最终输出 |
| Agent 当工具，外层上限 1、子默认 | 1 / 2 | 子任务执行两轮及一次模拟读取后，父运行超限 |
| Agent 当工具，外层上限 2、子上限 1 | 2 / 1 | 子超限被转成工具错误反馈，父仍能生成最终输出 |

最后一组使用观察回调记录子异常类型，再原样调用 SDK 默认错误函数。父模型实际收到的是固定的 `An error occurred while running the tool. Please try again.`，不是 `MaxTurnsExceeded` 的异常详情。父输出为预设的 `coordinator_claims_done`，记录明确写了 `business_result_validated: false`；这只能证明控制流允许继续，不能证明问题已经诊断、报告已经正确或真实模型会作同样选择。默认错误文本与函数包装行为也有固定源码依据。[^s12]

LangGraph 实验采用同步 `invoke`，工具批次设置 `max_concurrency=1`。九个场景全部通过，其中与预算直接相关的观察为：

| 场景 | 实际发生的工作 | 观察到的结果 |
| --- | --- | --- |
| 自循环节点、图上限 3 | 节点访问 3 次，内部共 6 个模拟外部动作 | `GraphRecursionError` |
| 一批 3 个创建调用、图上限 1 | 模拟服务创建 3 条记录 | 随后 `GraphRecursionError`，没有正常结果返回 |
| 同一批调用、图上限 2 | 仍创建 3 条记录 | 正常返回 3 个成功工具结果 |
| 工具节点显式允许 2 次尝试，首次检查失败 | 整个批次重跑，创建与检查各发生 2 次 | 第二次尝试成功 |

这些数字来自本实验的具体图、工具批次与故障注入；不要写成“所有节点固定消耗几步”或“所有重试必定执行两次”。实验也有捕获错误后不触发节点重试的场景，表明必须先问失败是在何处成为异常、还是被转换为一个工具结果。

两份实验都没有测量模型计费、网络请求重试、实际 token 成本、分布式额度一致性或异步工具并发峰值。实验能反驳把某个计数器误当另一个总量的解释，不能证明真实任务的成本、成功率或整套框架优劣。

## 应用层共享额度：把谁能花、花多少、何时扣写清楚

以下是设计推断与建议，不是 SDK 或 LangGraph 已自动提供的全局硬额度功能，也尚未在本书中实现。

如果产品要求一项用户任务跨委派、恢复和重试都遵守同一份预算，应用可以建立一份以 `root_task_id` 关联的额度账本。协调者、子代理和昂贵动作适配器都使用同一个根任务身份；恢复时重新关联同一份账本。账本记录资源上限、已结算消耗、尚未结算的预占和留给验收的额度。模型轮次、工具请求、token、金额估算、截止时间和并发槽位应分开记，不能混成一种“步”。

一条最小责任链可以设计为：

```text
协调者提出下一项工作
→ 动作适配器向共享账本申请预占额度
→ 账本原子地批准或拒绝
→ 适配器在获准后调用模型、工具或子任务
→ 适配器按真实用量结算，释放剩余预占
→ 协调者根据余额和未完成事项继续，或进入验收与交付
```

“原子”指多个工作者同时申请时，账本把检查余额和预占作为一个不可分割的操作，避免每个工作者都看到同一份尚未被扣掉的余额。若仅在各自开始时读取一个数字、结束后才累加，两个子任务可能同时把同一份额度花出去。

**建议：先预占，再结算。** 例如把一般工作的可用额度写成：

```text
一般工作可用额度 = 总额度 − 已结算用量 − 活动预占 − 验收预留
```

这只是单一资源维度上的设计关系。实际用量未知时，预占必须使用可执行的保守上界，或明确额度只是一项估计；不能只凭事后累计承诺绝对不会超支。请求失败或超时也不能直接把预占全部退款：服务可能已经执行，最终用量还可能待核对。此时保留待结算记录，比把未知消耗误当作零更准确。

**建议：重试也经过账本。** 为实际昂贵尝试分配标识，防止一份结算记录被重复入账；同时给逻辑业务动作使用合适的幂等键，防止副作用被重复执行。账本去重与业务幂等承担不同职责。图检查点或运行状态恢复时，必须分清是重放已有结果，还是再次发出了真实请求。

**建议：并发槽位与累计额度分别批准。** 一个动作可能同时需要一个并发槽位和一笔资源预占。释放槽位表示它不再占着同时执行的位置，不代表它没有消耗累计额度。若要求整棵任务树共用并发上限，所有工作者需要使用同一份受约束槽位，而不是每个子 Runner 各建一个大小相同的本地信号量。

**建议：给验收留资源。** 协调者应在一般研究预算耗尽前停止扩张任务，把预留额度用于核对结果、检查输出和说明未完成事项。额度耗尽时，由运行系统转入明确的收尾路径；若已无法再调用模型，应用仍可用确定的模板列出已完成工作、失败和待办。应避免让研究阶段耗尽所有资源，随后因为“还有一句总结没写”而继续无边界工作，也不能为了收尾直接把未验收任务标成成功。

要把这些建议称为“硬约束”，还需证明所有昂贵调用路径、嵌套子任务、恢复、重试和并发分派都经过额度检查，并且预占与结算具有足够的一致性。只有一个共享对象、一个最终用量报表或一个命名为 `budget` 的字段，不足以完成这个证明。

## 第21章可以怎样展开

建议开头直接呈现已有实验里的反直觉现象：“图上限设为 1，为什么服务已经多了 3 条记录？”让读者先看到限制确实存在，动作也确实发生，再沿节点内部批次、节点尝试、图调度步、父子 Runner 和累计任务逐层回答。

这一章的核心不是寻找唯一正确的计数器，而是让读者为每种限制补齐一句完整的话：**哪个组件，在什么作用域内，累计哪种资源，在什么动作之前检查，恢复与委派时如何延续？** 轮数限制适合防止某一循环持续运行；真正的产品成本边界，还需要应用声明并执行自己的资源约定。

## 源码与参考资料

以下实现链接同时给出本地路径与完整 SHA 固定行号；本书新增实验使用上文的本地脚本和结果文件作为执行记录。

[^s01]: [本地 SDK 异步运行入口与轮次约定](../../openai-agents-python/src/agents/run.py#L279-L324) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L279-L324)。
[^s02]: [本地同步运行入口](../../openai-agents-python/src/agents/run.py#L385-L407) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L385-L407)；[本地流式运行入口](../../openai-agents-python/src/agents/run.py#L488-L509) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L488-L509)。
[^s03]: [本地新运行轮数](../../openai-agents-python/src/agents/run.py#L834-L848) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L834-L848)；[本地轮数检查与超限错误处理](../../openai-agents-python/src/agents/run.py#L1597-L1622) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L1597-L1622)。
[^s04]: [本地子运行额度与上下文](../../openai-agents-python/src/agents/agent.py#L746-L773) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L746-L773)；[本地新子 Runner](../../openai-agents-python/src/agents/agent.py#L1043-L1059) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L1043-L1059)；[本地流式子 Runner](../../openai-agents-python/src/agents/agent.py#L928-L946) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L928-L946)。
[^s05]: [本地默认轮数](../../openai-agents-python/src/agents/run_config.py#L45) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_config.py#L45)。
[^s06]: [本地同一 Runner 交接](../../openai-agents-python/src/agents/run.py#L2386-L2408) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L2386-L2408)。
[^s07]: [本地流式计轮](../../openai-agents-python/src/agents/run_internal/run_loop.py#L1773-L1789) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/run_loop.py#L1773-L1789)；[本地流式交接](../../openai-agents-python/src/agents/run_internal/run_loop.py#L2184-L2203) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/run_loop.py#L2184-L2203)。
[^s08]: [本地恢复保存的轮数限制](../../openai-agents-python/src/agents/run.py#L678-L697) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L678-L697)；[本地恢复当前轮数](../../openai-agents-python/src/agents/run.py#L813-L833) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L813-L833)。
[^s09]: [本地模型调用进入重试包装](../../openai-agents-python/src/agents/run_internal/run_loop.py#L3024-L3045) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/run_loop.py#L3024-L3045)。
[^s10]: [本地请求尝试循环、条件与用量补记](../../openai-agents-python/src/agents/run_internal/model_retry.py#L597-L681) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/model_retry.py#L597-L681)。
[^s11]: [本地 Usage 记录内容](../../openai-agents-python/src/agents/usage.py#L195-L220) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/usage.py#L195-L220)；[本地 Usage 累加](../../openai-agents-python/src/agents/usage.py#L257-L268) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/usage.py#L257-L268)。
[^s12]: [本地函数工具失败包装](../../openai-agents-python/src/agents/tool.py#L697-L711) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/tool.py#L697-L711)；[本地固定错误文本](../../openai-agents-python/src/agents/tool.py#L1997-L2002) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/tool.py#L1997-L2002)。
[^g01]: [本地已编译图的 invoke 入口](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L3924-L3968) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L3924-L3968)；[本地 invoke 内部消费 stream](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L3999-L4032) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L3999-L4032)。
[^g02]: [本地 stream 入口](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L2748-L2769) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L2748-L2769)；[本地 astream 入口](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L3154-L3175) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L3154-L3175)；[本地 ainvoke 入口](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L4101-L4122) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L4101-L4122)。
[^g03]: [本地 Pregel 的规划、执行、更新约定](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L464-L487) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L464-L487)。
[^g04]: [本地主循环的调度步与任务批次](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L3050-L3079) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L3050-L3079)；[本地单任务执行与重试](../../langgraph/libs/langgraph/langgraph/pregel/_runner.py#L201-L222) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_runner.py#L201-L222)；[本地批量任务提交](../../langgraph/libs/langgraph/langgraph/pregel/_runner.py#L259-L287) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_runner.py#L259-L287)。
[^g05]: [本地同步工具节点的一批调用](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py#L801-L834) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L801-L834)。
[^g06]: [本地图循环检查步数](../../langgraph/libs/langgraph/langgraph/pregel/_loop.py#L650-L680) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L650-L680)。
[^g07]: [本地图运行超限异常](../../langgraph/libs/langgraph/langgraph/pregel/main.py#L3092-L3108) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L3092-L3108)。
[^g08]: [本地同步循环从检查点与配置计算阈值](../../langgraph/libs/langgraph/langgraph/pregel/_loop.py#L1857-L1888) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L1857-L1888)；[本地异步循环阈值](../../langgraph/libs/langgraph/langgraph/pregel/_loop.py#L2136-L2147) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L2136-L2147)。
[^g09]: [本地保存步号](../../langgraph/libs/langgraph/langgraph/pregel/_loop.py#L1258-L1277) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L1258-L1277)；[本地递增步号](../../langgraph/libs/langgraph/langgraph/pregel/_loop.py#L1376-L1378) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L1376-L1378)。
[^g10]: [本地 RetryPolicy 定义](../../langgraph/libs/langgraph/langgraph/types.py#L427-L446) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/types.py#L427-L446)。
[^g11]: [本地同步任务尝试与重试循环](../../langgraph/libs/langgraph/langgraph/pregel/_retry.py#L573-L682) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_retry.py#L573-L682)。
[^g12]: [本地同步图后台执行器](../../langgraph/libs/langgraph/langgraph/pregel/_executor.py#L40-L72) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_executor.py#L40-L72)。
[^g13]: [本地异步图执行器信号量](../../langgraph/libs/langgraph/langgraph/pregel/_executor.py#L122-L169) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_executor.py#L122-L169)。
[^g14]: [本地异步工具节点批次](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py#L836-L868) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L836-L868)。
[^c01]: [本地线程池工作线程数配置](../../langchain/libs/core/langchain_core/runnables/config.py#L659-L675) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/runnables/config.py#L659-L675)。
