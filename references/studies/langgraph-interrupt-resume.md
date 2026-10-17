# LangGraph：中断、节点重入与外部效果

核对版本：`langgraph@41c9c22fdc83d68a2859d0c9a2b627c8615a792f`。运行日期：2026-10-17。

本文跟踪两个运行入口：执行/恢复用 `invoke()`，观察用 `get_state()`。`Command` 是恢复请求数据，`InMemorySaver` 是检查点基础设施，实验中的 `ReviewService` 是本书的模拟业务适配器。其他执行方式不在入口统计范围内。

## 节点会重新执行

`interrupt()` 的文档说明，恢复从节点开头重新执行。实现使用当前任务的中断次序寻找已提供的恢复值；找到时返回该值，没有时抛出 `GraphInterrupt`。因此，它没有保存任意 Python 局部变量的程序计数器。

- [本地中断定义](../../langgraph/libs/langgraph/langgraph/types.py) · [固定源码与行号](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/types.py#L903-L1045)

## 执行入口与恢复请求

`invoke()` 收集执行流的输出，内部进入 `stream()`；运行循环区分新输入和继续已有状态，`Command(resume=...)` 被转换为恢复信息写入。没有检查点时不能采用这条恢复路径。

- [本地执行入口](../../langgraph/libs/langgraph/langgraph/pregel/main.py) · [固定源码与行号](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/main.py#L3924-L4010)
- [本地运行循环](../../langgraph/libs/langgraph/langgraph/pregel/_loop.py) · [继续已有状态的判断](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L915-L944) · [恢复值处理](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_loop.py#L1013-L1044)

## 中断、错误与正常返回分别记录

运行器提交任务结果时，分别处理 `GraphInterrupt`、其他错误和正常返回。中断相关记录与正常节点输出具有不同路径。这支持一个有限结论：节点执行过一部分动作，不等于这些动作的结果已经通过正常输出成为任务状态。

- [本地提交逻辑](../../langgraph/libs/langgraph/langgraph/pregel/_runner.py) · [固定源码与行号](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_runner.py#L575-L615)

## 检查点的范围

检查点使用线程标识读取和保存执行状态。构图编译时可注入检查点保存器；本次使用 `InMemorySaver`，其材料明确限定为调试与测试用途，数据不会因此获得跨进程持久化。

- [本地保存器接口](../../langgraph/libs/checkpoint/langgraph/checkpoint/base/__init__.py) · [固定源码与行号](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/checkpoint/base/__init__.py#L198-L225)
- [本地内存保存器](../../langgraph/libs/checkpoint/langgraph/checkpoint/memory/__init__.py) · [固定源码与行号](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/checkpoint/memory/__init__.py#L33-L74)
- [本地编译过程](../../langgraph/libs/langgraph/langgraph/graph/state.py) · [固定源码与行号](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/graph/state.py#L1177-L1208)

## 实验观察

实际运行本书脚本后，观察到四个受控场景：同一节点在中断前写入，恢复后产生两条记录；将写入与等待拆成节点，无额外故障时只产生一条；同一节点配合模拟服务的幂等约定，两次调用只产生一条记录；拆分节点后，在写入完成、节点返回前注入异常，恢复又产生两条记录。

- [实验脚本](../../experiments/langgraph_interrupt_replay.py)
- [原始结果与环境](../../experiments/results/langgraph-interrupt-replay.json)
- [复现与边界](../../experiments/README.md)

上述观察证明该固定环境下的执行过程，不能外推为所有保存器、所有持久化模式或真实分布式业务的表现。涉及实际网络响应丢失、进程崩溃与数据库事务的行为仍待进一步实验。

## 设计推断

节点拆分可以明确一个已完成步骤的交付边界；动作幂等与结果查询处理业务效果的确认。两者解决的部分不同。最终应把恢复、动作身份、批准对象和外部效果放在同一条责任链里设计。

[对应正文](../../book/14-resume-and-side-effects.md)
