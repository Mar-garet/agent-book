# 机制实验与复现

本书用可重复的局部场景检查实现边界。这里收录五组、共 31 个确定性场景，没有调用外网模型、付费 API 或真实业务服务。

LangGraph 与 SDK 实验运行已下载的固定源码；Pi 实验调用真实的摘要输入序列化函数；离线验收检查本书自己编写的应用规则。预设输入、模型替身与模拟服务让局部差异可见，不能据此推导模型完成率或项目排名。

[实验清单](manifest.json) 将每组脚本、结果与依赖锁关联起来。结果文件记录运行时间、环境、源码提交和脚本摘要；书稿校验会检查这些记录与当前文件是否一致。

## 中断与恢复

这一组包含四个场景。模拟审查服务保存在图状态之外，用来观察业务效果与节点状态的交付差异。

| 场景 | 创建请求次数 | 新建记录数 | 观察 |
| --- | --- | --- | --- |
| 同一节点先创建，再中断 | 2 | 2 | 恢复重新进入创建逻辑 |
| 创建节点完成后，另一个节点中断 | 1 | 1 | 恢复重新进入等待节点 |
| 同一节点，服务按稳定标识识别重复 | 2 | 1 | 重新请求，复用既有记录 |
| 拆分节点，创建后、节点返回前注入异常 | 2 | 2 | 没有交付结果的创建节点重新执行 |

检查点采用 `InMemorySaver`，恢复发生在同一进程中。业务去重是模拟服务的显式约定；实验没有模拟真实网络、数据库事务或进程崩溃。

[脚本](langgraph_interrupt_replay.py) · [原始结果](results/langgraph-interrupt-replay.json) · [第十四章](../book/14-resume-and-side-effects.md)

## 工具错误、批次重试与图步数

这一组运行九个同步场景：缺失参数、业务异常、异常转消息、节点重试、错误转换后的重试、未知工具名，以及三种图步数配置。

同步工具派发的 `max_concurrency` 设为 1，以固定模拟服务事件的顺序。业务写入不放进图状态；重试策略明确匹配 `RuntimeError`，不能把它当作该版本默认会重试的异常。

| 比较 | 实际观察 |
| --- | --- |
| 默认处理与普通异常转消息 | 前者抛出业务异常，后者可以返回成功消息与错误消息 |
| 重试整节点 | 成功的相邻创建动作也再次执行，新建记录从 1 变成 2 |
| 已转成消息的异常 | 没有再因该异常触发节点重试 |
| 未知工具名，节点异常处理关闭 | 仍通过专门校验返回错误消息 |
| 一个节点含三次工具调用 | 步数上限 1 时三次写入已发生，然后报超限；上限 2 时完成 |
| 循环节点，每次发出两个模拟动作 | 步数上限 3 时观察到三次节点执行、六个动作，然后超限 |

这组结果没有覆盖异步并发、真实网络故障、取消传播或模型怎样利用错误信息。

[脚本](langgraph_tool_boundaries.py) · [原始结果](results/langgraph-tool-boundaries.json) · [第十七章](../book/17-tool-results-and-retries.md) · [第二十一章](../book/21-execution-budgets.md)

## 委派、交接与轮数边界

这一组用真实 OpenAI Agents SDK 的 `ScriptedModel` 运行五个场景。模型替身返回事先编排的动作与文本，计数表示实际进入替身的次数，不是外网请求或计费 token。

| 场景 | 协调者调用 | 专员调用 | 观察 |
| --- | --- | --- | --- |
| 交接，外层上限 1 | 1 | 0 | 接收者运行前超限 |
| 交接，外层上限 2 | 1 | 1 | 专员返回最终输出 |
| Agent 工具，外层上限 2，子运行默认 | 2 | 2 | 总计四次，协调者返回最终输出 |
| Agent 工具，外层上限 1，子运行默认 | 1 | 2 | 子运行结束后，外层超限 |
| Agent 工具，外层上限 2，子运行上限 1 | 2 | 1 | 子运行超限被转换为工具错误，父运行仍能返回预设完成文本 |

最后一项采用的错误回调先记录异常类型，再委托给 SDK 默认错误处理器。默认处理器返回通用错误文字，不会直接暴露异常名称。协调者的最终文本也是预设响应；它说明运行正常返回与业务验收不同，不能说明真实模型必然错误宣布完成。

[脚本](agents_delegation_budgets.py) · [原始结果](results/agents-delegation-budgets.json) · [第十九章](../book/19-delegation-and-handoffs.md) · [第二十一章](../book/21-execution-budgets.md)

## 摘要模型读取前的裁剪

这一组直接调用固定 Pi 源码的 `serializeConversation`，运行四个输入场景，不调用摘要模型。

| 标记所在位置 | 进入序列化后的摘要材料 |
| --- | --- |
| 单条工具结果的 2,200 个填充字符之后 | 没有 |
| 同类工具结果的头部 | 有 |
| 用户消息的同等长度尾部 | 有 |
| 两条各自较短的工具结果尾部 | 两条都有 |

观察到的是每条工具结果的前 2,000 个 JavaScript 字符串单位裁剪，不是总输入上限。对于本实验使用的 ASCII 字符，这个单位与字符数一致。

运行环境为 Node 26.4.0。脚本使用 Node 的 TypeScript 类型剥离与 `registerHooks`，将序列化模块唯一的运行时包导入定位到 Pi 包内实际导出的 `contentText` 源文件；没有替换函数或伪造返回值。导入方式、两个源文件摘要与完整输入输出都保存在结果中。

它能说明部分信息在摘要前已经丢失，不能测量真实摘要质量、长任务表现或替代策略的效果。

[脚本](pi_summary_input.mjs) · [原始结果](results/pi-summary-input.json) · [第十八章](../book/18-context-compaction.md)

## 产物与过程的离线验收

这一组使用 Python 标准库，检查本书的应用验收程序。任务编号、测试环境、两天的示例合计值和只读要求共同构成任务约定。

九个样例分别包含：排队回执、缺少日期、错误环境、未获准写入、旧任务产物、产物缺失、错误数值、完整合格产物，以及本地预算耗尽但远端仍运行。输入、完成声明和产物均为人工构造；没有让 Agent 实际执行这些任务。

程序读取服务状态、产物与动作记录，分别给出等待、不通过或通过。它假定这些输入记录可信，且只覆盖写下的有限条件；通过这组检查不意味着验收规则已经完备。

[脚本](task_acceptance.py) · [原始结果](results/task-acceptance.json) · [第二十二章](../book/22-evaluation-and-completion.md)

## 准备与复现

Python 记录使用 3.12.13、macOS arm64。源码版本见 [SOURCES.json](../SOURCES.json)，不同实验环境的第三方依赖分别保存在锁文件中。锁文件不覆盖构建工具与所有平台的二进制分发。

下面命令均在本书根目录执行。脚本默认从本书根目录查找源码；若在未初始化子模块的独立书稿工作树中运行，可为源码实验增加 `--source-root /path/to/agent_book`。脚本检查源码提交与实际导入位置，不接受任意安装版本冒充固定快照。

### LangGraph 的两个实验

```bash
git submodule update --init --depth 1 langgraph langchain
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r experiments/dependencies.lock
uv pip install --python .venv/bin/python --no-deps \
  -e ./langgraph/libs/langgraph \
  -e ./langgraph/libs/checkpoint \
  -e ./langgraph/libs/prebuilt \
  -e ./langgraph/libs/sdk-py \
  -e ./langchain/libs/core
.venv/bin/python experiments/langgraph_interrupt_replay.py \
  --output experiments/results/langgraph-interrupt-replay.json
.venv/bin/python experiments/langgraph_tool_boundaries.py \
  --output experiments/results/langgraph-tool-boundaries.json
```

第三方版本见 [dependencies.lock](dependencies.lock)，五个本地源码包的版本另记在结果文件中。脚本关闭继承的远程追踪开关。

### SDK 委派预算

为 SDK 使用另一个环境，以保留各组实际依赖：

```bash
git submodule update --init --depth 1 openai-agents-python
uv venv --python 3.12 .downloads/agents-venv
uv pip install --python .downloads/agents-venv/bin/python \
  -r experiments/agents-sdk-dependencies.lock
uv pip install --python .downloads/agents-venv/bin/python --no-deps \
  -e ./openai-agents-python
.downloads/agents-venv/bin/python experiments/agents_delegation_budgets.py \
  --output experiments/results/agents-delegation-budgets.json
```

第三方版本见 [agents-sdk-dependencies.lock](agents-sdk-dependencies.lock)。脚本关闭 SDK 追踪，不需要模型密钥。

### Pi 序列化与应用验收

Pi 实验使用上述 Node 运行能力，不需安装 Pi 的第三方依赖。离线验收只需 Python 标准库。

```bash
git submodule update --init --depth 1 pi
node experiments/pi_summary_input.mjs \
  --output experiments/results/pi-summary-input.json
python3 experiments/task_acceptance.py \
  --output experiments/results/task-acceptance.json
```

## 怎样理解这些结果

每份脚本都检查与本组问题有关的输出，观察不符时会报错。修改脚本后应重新运行并保存结果；只修改解释文字且不改变实验前提时，不需要制造重复记录。

局部机制观察、应用验收规则检查和有模型参与的任务评测，各有不同用途与样本范围。真实业务服务、跨进程恢复、网络故障和模型决策仍需另行研究。

[返回全书目录](../book/README.md) · [源码研究](../references/studies/README.md)
