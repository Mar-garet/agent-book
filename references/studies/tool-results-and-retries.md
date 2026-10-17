# 工具返回之后：错误反馈、批次失败与重试边界

核对日期：2026-10-17。本文沿固定源码追踪工具包装、调度与重试，并对照本书已运行的九个同步场景。上游测试与异步实验没有在本轮执行。

固定版本取自 [SOURCES.json](../../SOURCES.json)：LangGraph Python 为 `41c9c22fdc83d68a2859d0c9a2b627c8615a792f`，LangChain Python 为 `bd5b134d876ef47858beef27bd29c81eeda03293`。结论限定为这两个快照中的 Python `ToolNode`、`BaseTool`、`StructuredTool` 和直接相关重试路径；不代表其他版本、JavaScript 实现或所有 `create_agent` 装配。

## 先数入口，再解释谁调用谁

本笔记研究 `ToolNode` 的 **2 个执行入口**：同步 `invoke()` 和异步 `ainvoke()`。它们继承自 `RunnableCallable`，分别进入节点的 `_func()` 与 `_afunc()`。下游工具也有同名的 `BaseTool.invoke()` / `BaseTool.ainvoke()`，这是同一条调用链中的下一层，不应与节点入口混为四个并列能力。批量 API、流式 API、agent 工厂和图的观察接口不在本次统计范围内。源码：[本地节点构造](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [节点绑定同步与异步函数](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L751-L794)；[本地执行基类](../../langgraph/libs/langgraph/langgraph/_internal/_runnable.py) · [同步入口](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/_internal/_runnable.py#L374-L450) · [异步入口](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/_internal/_runnable.py#L452-L525)。

调用者先提交消息或工具调用数据，节点找出要执行的工具。`AIMessage.tool_calls` 是输入数据，`ToolCallRequest` 是节点为一次调用组织的请求对象，都不是能自行执行动作的入口。节点持有工具名称到工具对象的映射，给调用补上运行环境，再调用工具。`BaseTool` 处理参数、回调、错误策略和结果包装；`StructuredTool` 最后才把工作交给应用提供的函数或协程。业务函数在这里承担适配器的角色：访问数据库、发邮件或修改文件的是它接入的业务服务，线程池与协程调度器只安排执行。源码：[本地节点执行](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [注册与请求组织](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L780-L834) · [单工具请求到调用](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L949-L983) · [输入解析](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1258-L1300)；[本地工具包装](../../langchain/libs/core/langchain_core/tools/base.py) · [工具入口](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L756-L774)；[本地业务函数适配](../../langchain/libs/core/langchain_core/tools/structured.py) · [函数与协程执行](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/structured.py#L129-L185)。

同步主路径可以读作：

```text
调用者提交 AIMessage 中的 tool_calls
  → ToolNode.invoke → 解析工具请求 → 调度每个调用
  → 可选的 wrap_tool_call → BaseTool.invoke → 参数校验
  → StructuredTool._run → 应用的业务函数 → 外部服务
  → BaseTool 包装结果 → ToolNode 归一化并合并整批输出
  → 调用者或图拿到返回值，决定后续是否调用模型
```

节点的同步调度使用 `executor.map()`；异步调度使用 `asyncio.gather()`。同步线程池的工作线程数量来自 `max_concurrency`。如果 `StructuredTool` 只有同步函数，调用它的 `ainvoke()` 会把同步 `invoke()` 放到执行器中，并不自动把业务函数改写成可取消的原生异步操作。源码：[本地节点调度](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [同步与异步批次](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L827-L868)；[本地执行器配置](../../langchain/libs/core/langchain_core/runnables/config.py) · [线程数配置](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/runnables/config.py#L660-L675)；[本地异步工具入口](../../langchain/libs/core/langchain_core/tools/structured.py) · [同步函数的异步适配](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/structured.py#L115-L125)。

这条链没有把 `ToolMessage` 直接发送给模型。节点负责返回消息或状态更新，后续模型调用取决于外层程序怎样连接这份返回值。这是对上述执行与输出路径的有限判断，不是对所有 agent 工厂的概括。源码：[本地输出合并](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [普通消息与 Command 的返回路径](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L870-L928)。

## 函数返回了，不等于业务成功已经确认

`BaseTool` 先把执行状态设为 `success`，正常返回的内容进入结果包装。它不会从字符串中的“失败”或对象中的 `ok: false` 自动推断业务失败。带完整工具调用 ID 的输入会获得相应 `ToolMessage`；只用普通参数字典直接调用工具时，结果可以仍是原内容。因此，“返回了一段错误文字”“返回 `status="error"` 的消息”“向调用者抛出异常”是三种需要分别确认的行为。源码：[本地执行收尾](../../langchain/libs/core/langchain_core/tools/base.py) · [默认状态与异常处理](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1084-L1135) · [输入中提取调用 ID](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1352-L1387) · [有无 ID 的输出区别](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1390-L1426)。

`ToolMessage.tool_call_id` 负责把响应对应到某次工具请求；它本身没有在这些路径中被用作外部服务的业务去重键。消息还区分 `content` 与 `artifact`：后者的定义是供程序保留、不打算传给模型的完整产物。本次没有继续核对各模型供应商怎样序列化这些字段，不能据此保证任意上层程序都不会把产物重新塞进上下文。源码：[本地消息定义](../../langchain/libs/core/langchain_core/messages/tool.py) · [请求关联、产物与状态](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/messages/tool.py#L26-L82)；[本地工具调用](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [ID 随请求传入工具](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L949-L979)。

还有一种晚到的失败：业务函数已经返回，但包装器发现返回格式不符合约定。例如配置 `response_format="content_and_artifact"` 却没有返回二元组，`BaseTool` 在业务函数执行后生成 `ValueError`。因此，包装失败不能证明外部动作未发生。前半句是源码事实，后半句是根据执行顺序作出的设计推断。源码：[本地返回格式校验](../../langchain/libs/core/langchain_core/tools/base.py) · [先执行业务函数，后校验响应格式](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1088-L1132)。

## 哪些错误作为消息返回，哪些继续抛出

先限定配置：以下比较使用标准工具、没有 `wrap_tool_call` / `awrap_tool_call`，且工具自己的 `handle_tool_error` 与 `handle_validation_error` 保持默认 `False`。这两个单工具开关与节点的复数开关 `handle_tool_errors` 是不同层的策略。源码：[本地工具默认配置](../../langchain/libs/core/langchain_core/tools/base.py) · [两个单工具开关](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L527-L545)；[本地节点默认配置](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [节点默认处理器](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L751-L785)。

| 发生什么 | 节点默认策略 | `handle_tool_errors=True` | `handle_tool_errors=False` |
| --- | --- | --- | --- |
| Pydantic 参数校验错误经节点包装为 `ToolInvocationError` | 返回错误消息 | 返回错误消息 | 抛出 `ToolInvocationError` |
| 业务函数抛出普通 `RuntimeError` 或 `ToolException` | 继续抛出 | 返回错误消息 | 继续抛出 |
| 请求的工具名未注册 | 返回错误消息 | 返回错误消息 | 仍返回错误消息 |
| 工具中的 `GraphBubbleUp`，包括图中断信号 | 交给外层图处理 | 交给外层图处理 | 交给外层图处理 |
| 被标记为无效中断恢复值的校验错误 | 继续抛出 | 继续抛出 | 继续抛出 |

表中“错误消息”指与原调用 ID 对应、`status="error"` 的 `ToolMessage`。**默认策略不是捕获所有工具执行异常。**默认处理器只返回 `ToolInvocationError` 的说明，其他异常重新抛出。节点在工具调用抛出 Pydantic `ValidationError` 时，过滤注入参数相关错误，再包装成这种异常；这个 `try` 包住的是整个 `tool.invoke()`，所以不能反过来声称捕获到的每个 `ValidationError` 都一定来自执行前的参数校验，业务函数自己抛出的同类异常也需要分辨。源码：[本地错误处理器](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [默认处理器](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L391-L399) · [同步包装、过滤与消息生成](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L964-L1029) · [异步对应路径](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1124-L1189)。

未知工具名走专门校验路径，直接构造错误消息，没有通过“捕获异常后查看 `handle_tool_errors`”的分支。这就是关闭节点异常处理后，未知工具名仍可变成消息的原因。相反，输入没有消息或找不到 `AIMessage`，发生在批次解析阶段，尚未进入每个工具的错误转换。源码：[本地工具名校验](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [调用前的直接返回](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L949-L962) · [消息解析与未知名称处理](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1258-L1313)。

`GraphBubbleUp` 在普通异常处理之前明确重新抛出；中断恢复值与 `response_schema` 不匹配的错误也被特别排除。这些信号表示运行控制或恢复输入的问题，节点不把它们改写成让模型修正工具参数的提示。后一句是对特殊分支目的的解释。源码：[本地特殊错误处理](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [同步排除分支](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L986-L1001) · [异步排除分支](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1146-L1161)；[本地错误标记](../../langgraph/libs/langgraph/langgraph/errors.py) · [无效恢复值的识别](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/errors.py#L252-L260)。

如果工具自己的 `handle_tool_error=True` 先处理了 `ToolException`，`BaseTool` 返回的已经是错误消息，节点即便配置 `handle_tool_errors=False`，也没有这个异常可再抛出。单工具的 `handle_validation_error` 具有类似的提前处理位置；普通 `RuntimeError` 不属于这两个单工具处理分支。源码：[本地工具错误分支](../../langchain/libs/core/langchain_core/tools/base.py) · [同步错误处理与返回](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1115-L1135) · [异步错误处理与返回](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/tools/base.py#L1245-L1266)；[本地节点响应处理](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [已有 ToolMessage 的接收](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1466-L1477)。

节点还允许异常类型、类型元组、固定文字或自定义处理函数。无包装器的正常执行路径会先匹配类型；处理函数可从参数注解推导它负责的异常类型。不要把这个结论直接套到所有扩展路径：本快照的包装器外层捕获分支没有重复同一套类型过滤，而是直接调用错误内容生成器；状态注入又发生在内层 `try` 之前。写到自定义包装器时应逐条核对异常来自哪里，不能仅凭开关名称声称“所有错误都被捕获”或“只捕获某一种错误”。源码：[本地异常类型推导](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [类型注解推导](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L452-L515) · [内层匹配](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1002-L1029) · [包装器外层捕获](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1061-L1088) · [异步包装器对应路径](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1221-L1256)。

## 两个工具，为什么会出现“动作做了，却没拿到整批结果”

同步节点先执行 `outputs = list(executor.map(...))`，完成之后才调用输出合并；异步节点先 `await asyncio.gather(...)`，再合并。两个位置都没有把抛出的单工具异常作为普通批次元素收集。因此，只要异常沿这些路径抛出，这次节点调用就不会正常交付完整的消息集合。普通消息的输出合并则把工具结果放回消息列表或 `messages` 状态更新。源码：[本地调度与合并](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [取得整批结果后才合并](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L827-L895)。

设计推断：假设工具 A 已把订单写入服务，工具 B 随后抛出未处理异常，A 的外部写入可以与“节点没正常返回整批消息”同时成立。这条调度与异常路径没有调用业务服务撤销 A；框架没有因此获得两个外部动作的共同事务。把 B 的异常改写成错误消息，可让上层同时拿到 A 的成功消息与 B 的错误消息；它解决的是反馈交付问题，不会替业务完成撤销、确认或去重。推断依据是上述合并位置与 [错误转消息的位置](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1018-L1029)，[本地对应文件](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py)。

本次没有运行竞态实验，不能根据 `gather()` 这个调用名就声称其他异步工具一定停止、一定完成，或停止时一定没有副作用。第一份可复现实验宜采用同步路径并显式设置 `max_concurrency=1`，按 A、B 的输入次序安排动作，先验证部分成功这个问题，再单独研究真正并发时的取消和清理。

## 重试发生在哪一层，决定哪些动作会再做一次

**单个 Runnable 的重试。**`with_retry()` 创建新的 `RunnableRetry`，按异常类型或判断函数重试被包装的对象；同步与异步入口都再次把原输入交给被包装对象。这里没有检查返回的 `ToolMessage.status`。因此，工具已经把异常改写成普通返回值时，只按异常触发的这一层重试不会因为消息状态是 `error` 就自动重跑；如果包装整个节点，重试范围又变成整个节点。源码：[本地重试构造](../../langchain/libs/core/langchain_core/runnables/base.py) · [with_retry 的配置与绑定](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/runnables/base.py#L2102-L2167)；[本地重试执行](../../langchain/libs/core/langchain_core/runnables/retry.py) · [异常条件与尝试次数](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/runnables/retry.py#L116-L163) · [同步与异步重新调用](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/core/langchain_core/runnables/retry.py#L186-L232)。

**工具调用包装器的重试。**`ToolNode` 把单次请求和一个 `execute(request)` 回调交给可选的包装器；回调可以多次执行。没有包装器时节点直接执行一次，没有这里的自定义重试循环。若应用通过包装器重试同一工具，重试范围可以比整个节点小，但是否匹配异常、是否检查错误消息、是否限制次数，由包装器的实现决定。源码：[本地包装器执行](../../langgraph/libs/prebuilt/langgraph/prebuilt/tool_node.py) · [同步回调与单次直接路径](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1031-L1088) · [异步回调与同步回退](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/tool_node.py#L1191-L1256)。

**图节点的重试。**应用可以给 `StateGraph.add_node()` 配置 `retry_policy`，也可以配置图的默认策略，编译后策略进入节点的执行描述。运行器在下一次尝试之前清空 `task.writes`，重新调用相同任务的处理过程；没有策略、不匹配异常或达到最大尝试次数时继续抛出，`GraphBubbleUp` 也不走普通重试。对一个没有额外子任务拆分的普通 `ToolNode` 而言，节点重新执行意味着再次解析同一批调用并进入工具调度。源码：[本地构图](../../langgraph/libs/langgraph/langgraph/graph/state.py) · [节点重试参数](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/graph/state.py#L675-L699) · [图默认值应用](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/graph/state.py#L1322-L1325) · [策略交给节点](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/graph/state.py#L1531-L1545)；[本地运行器重试](../../langgraph/libs/langgraph/langgraph/pregel/_retry.py) · [同步清缓冲、重入与停止条件](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_retry.py#L573-L682) · [异步清缓冲与执行](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_retry.py#L725-L737) · [异步停止条件](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_retry.py#L788-L810)。

清空框架的写入缓冲不能解释成撤销外部数据库、邮件或支付动作。这是执行边界上的设计推断：已执行的业务适配器不在 `task.writes.clear()` 的撤销范围内；若 A 已写入而 B 引发节点重试，A 可能再次被调用。拆小重试范围可以减少牵连，业务去重键、动作查询与补偿则处理外部效果本身。外部系统的实际语义仍须在相应服务中验证，不能仅从运行器代码推出“一定只执行一次”。相关背景见 [中断与外部效果研究](langgraph-interrupt-resume.md)。

实验还要显式选择异常类型：本快照的 `RetryPolicy.max_attempts` 包括首次尝试；默认异常判断明确排除 `RuntimeError`、`ValueError`、`TypeError` 等异常。不能仅写 `RetryPolicy(max_attempts=2)`，然后把 `RuntimeError` 没有重试解释为节点恢复机制失效。源码：[本地策略定义](../../langgraph/libs/langgraph/langgraph/types.py) · [默认值及尝试次数语义](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/types.py#L427-L446)；[本地默认异常判断](../../langgraph/libs/langgraph/langgraph/_internal/_retry.py) · [默认重试与排除类型](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/_internal/_retry.py#L1-L29)。

## 已运行的同步场景

本书使用固定 LangGraph 与 LangChain Core 源码运行了 [工具边界脚本](../../experiments/langgraph_tool_boundaries.py)，完整配置、模块位置、环境、服务事件与消息保存在 [九场景结果](../../experiments/results/langgraph-tool-boundaries.json)。模型请求由手工构造的消息提供；审查服务是图状态之外的进程内模拟对象。

脚本经由编译图的同步入口运行 `ToolNode`，由图注入实际运行环境；同步派发并发度为 1，以固定业务事件顺序。观察包括：

- 缺失参数会变成默认错误消息，业务创建没有开始；普通业务 `RuntimeError` 默认向外抛出。
- 普通异常转成消息后，同批可以返回成功消息与错误消息；按异常触发的节点重试没有因此启动。
- 显式配置 `RuntimeError` 节点重试时，第一次已成功的相邻创建动作再次执行，新建记录从一条变成两条。
- 节点异常处理关闭时，未知工具名仍经专门校验返回错误消息。
- 三次工具创建可以发生在一个节点里。步数上限 1 时，三次写入后图报超限；上限 2 时，该图完成。另一个循环图在上限 3 时执行三次节点、六个模拟动作，然后超限。

这些是同步、固定输入下的局部观察。模拟对象没有真实数据库事务，图超限也没有撤销业务动作。异步执行需要另建同步屏障，不能把同步的 `max_concurrency=1` 当成异步 `gather()` 的串行保证。

## 设计判断与仍未解决的问题

可以用一个具体情境理解这些边界：“订单已经创建，Agent 却说工具调用失败；点击重试后，又多了一张订单。”需要分别确认：业务是否做过、包装器是否收到合规结果、节点是否交付消息、上层是否决定继续，以及重试会重做哪个范围。这个例子是本书设计情境，不是本轮真实事故记录。

目前的源码研究支持区分错误反馈与异常传播、单工具与节点重试、图写入与外部动作三个边界。它不支持任务成功率比较，也不能证明 `ToolMessage.status="error"` 意味着外部动作没有生效。跨进程崩溃、真实网络响应丢失、并发工具取消、异步外部请求仍在继续时的节点重试、业务去重键跨重试与恢复的稳定性，以及具体模型怎样使用错误反馈，都还需独立实验。
