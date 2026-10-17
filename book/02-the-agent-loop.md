# 第二章：从一次回答，到一个行动循环

运行系统把第一次查询发给日志工具，收到的却是“没有找到 run-807”。助手先核对查询范围，发现日期过滤条件错了一天；修正后，它才取得日志 artifact:log-17。

这次调整让任务向前走了一步。工具带回的结果改变了下一次行动，原先那句“先查看日志”开始变成一个循环。

## 从目标走到下一次观察

运行系统先收集任务目标、已知约束、已知信息与可用工具，组成模型能够看到的输入。模型据此提出动作。系统验证并执行获准动作，再把结果带回下一轮。

```mermaid
flowchart TD
    G[目标、约束与任务状态] --> C[准备本轮上下文]
    C --> D[模型或既定流程选择下一步]
    D --> Q{需要行动吗}
    Q -->|需要| P[检查动作范围与参数]
    P --> A[工具执行]
    A --> O[记录结果与新观察]
    O --> S[更新任务状态]
    S --> C
    Q -->|结束、等待或交接| R[说明依据与未完成部分]
```

这个循环强调的是外部可观察的过程。模型是否展示长篇解释，不能替代工具结果和状态变化。

## 任务状态与聊天记录有不同用途

聊天记录按时间保存发生过的对话。任务状态表达“此刻哪些事情成立”。

例如，历史里出现过两次修复方案，其中一次已经被否决。后续执行需要知道当前采用哪一个方案，而不能仅依靠“最近提到过什么”来猜。

一个朴素的状态记录就可以包含：目标报表、环境、受影响日期、已核实的现象、待验证假设、已完成动作、当前阻碍、剩余预算，以及验收条件。它不一定必须是某种数据库，也不一定必须全部暴露给模型。

开发者要决定状态如何更新：工具结果直接改变事实字段，还是先由模型提出解释，再经过验证？“日志服务返回空结果”和“当天没有异常”应当保存为不同的信息。

## 观察有强弱，动作也有结果不明的时候

读到一条错误日志，可以支持某个假设。重新运行一次成功，只能说明某次运行返回成功。检查输出日期和行数，则回答了更接近任务目标的问题。

如果查询超时，系统获得的观察是“未能确认结果”。如果写操作超时，系统还需要考虑动作是否已经发生。直接把两者都记成“失败”会丢失重要信息。

循环的质量取决于它怎样理解反馈。持续行动本身不能保证持续接近目标。

## 谁来决定继续和停止

模型可以提出“任务完成”，但运行系统还可以检查验收条件、预算和权限。必要时，使用者作出最终判断。

一个任务至少可能以几种方式离开循环：达到验收条件；需要补充输入；需要授权；遇到当前无法排除的阻碍；达到时间或成本限制。这些状态对接手的人有不同意义，应当分别说明。

例如，“已定位为权限不足，尚未重新运行”比“处理结束”更能帮助使用者继续工作。

## 循环和工作流可以一起存在

工作流是预先约定的执行结构。它可以规定先核对环境，再允许诊断；诊断部分交给模型循环；修改后又进入固定的验收步骤。

Agent 的决策可以嵌入工作流，工作流也可以成为 Agent 可选择的一个动作。两者的组合方式，决定哪些地方允许探索、哪些地方必须遵守顺序。

LangGraph 的材料将长期、有状态的执行、人工介入和持久化作为重要能力，适合帮助我们研究循环之外的执行结构。

## 把循环写成一个可观察的程序

先用一个很小的程序把责任放到一起。它演示两个读取以及核对成功的分支：取得 E42，确认映射不匹配，最后报告“具备提交方案的依据”。这里用确定的函数代替模型和服务，R42 的正文进度仍停在待核对线索；`ready` 也不代表报表已经修好。

选择函数只能提出动作。运行程序先检查动作和环境，工具返回观察，程序再更新已确认状态。即使选择函数提出结束，程序也要检查证据是否齐全；轮数耗尽则返回另一种结果。下面两份代码行为相同、无需外部依赖，输出均为 `ready:E42,mapping-mismatch`。

```typescript
// model 和工具的确定性替身；没有调用真实模型或生产服务。
type State = { observations: string[]; confirmed: boolean };
type Action = [string, string];

function choose(state: State): Action {
  if (state.observations.length === 0) return ["read_log", "production"];
  if (!state.confirmed) return ["check_mapping", "production"];
  return ["finish", "production"];
}

function execute(kind: string): string {
  if (kind === "read_log") return "E42";
  if (kind === "check_mapping") return "mapping-mismatch";
  throw new Error("unknown tool");
}

function run(maxSteps = 3): string {
  const state: State = { observations: [], confirmed: false };
  for (let step = 0; step < maxSteps; step++) {
    const [kind, environment] = choose(state);
    if (kind === "finish") {
      return state.confirmed
        ? `ready:${state.observations.join(",")}`
        : "needs-evidence";
    }
    // 这个最小调查只准读取生产资料，没有注册任何写操作。
    if (environment !== "production" ||
        !["read_log", "check_mapping"].includes(kind)) return "denied";
    const observation = execute(kind);
    state.observations.push(observation);
    if (kind === "check_mapping") state.confirmed = true;
  }
  return "budget-exhausted";
}

console.log(run());
```

```python
# model 和工具的确定性替身；没有调用真实模型或生产服务。
from dataclasses import dataclass, field

@dataclass
class State:
    observations: list[str] = field(default_factory=list)
    confirmed: bool = False

def choose(state: State) -> tuple[str, str]:
    if not state.observations:
        return "read_log", "production"
    if not state.confirmed:
        return "check_mapping", "production"
    return "finish", "production"

def execute(kind: str) -> str:
    if kind == "read_log":
        return "E42"
    if kind == "check_mapping":
        return "mapping-mismatch"
    raise ValueError("unknown tool")

def run(max_steps: int = 3) -> str:
    state = State()
    for _ in range(max_steps):
        kind, environment = choose(state)
        if kind == "finish":
            return ("ready:" + ",".join(state.observations)
                    if state.confirmed else "needs-evidence")
        # 这个最小调查只准读取生产资料，没有注册任何写操作。
        if environment != "production" or kind not in {"read_log", "check_mapping"}:
            return "denied"
        observation = execute(kind)
        state.observations.append(observation)
        if kind == "check_mapping":
            state.confirmed = True
    return "budget-exhausted"

print(run())
```

换成真实模型时，选择函数要接收当前输入、解析模型返回的请求；换成真实服务时，工具必须返回实际证据。参数解析、异常、取消和持久化还需补齐。这个骨架刻意先展示一件事：提出结束、允许行动、形成事实和返回结果，分别发生在程序的明确位置。

不同系统在这个骨架上选择不同的执行单位。OpenAI Agents SDK 的一次轮数对应一次模型调用；AutoGen 的一次工具迭代可以并行执行多项工具；Aider 的修正循环则由补丁和检查反馈驱动。比较“最多三步”之前，应先确认这三步到底数的是什么。

## 中断暴露了循环的空隙

这个循环还有一个容易被忽视的空隙。假设后续验证已发起测试重跑 job-42，系统却在收到结果前退出。重启后的助手如果只看见“尚未验证”，就可能再发起一次重跑。

保存了动作请求，才知道自己尝试过什么；保留了外部任务编号，才有机会查询上次结果。上一次运行是否已经成功、重复运行会产生什么影响，都应先核对，再决定恢复动作。因此，保存动作身份和查询上次结果，应当成为恢复设计的一部分。

眼下，助手已经找到正确日志，能够依据观察调整行动。下一步要让“读取生产日志”和“重新运行测试报表”的差别进入工具约定，否则循环只会更快地放大含糊的动作。

## 延伸阅读

[相关实现与研究资料](../references/chapter-notes.md#02-the-agent-loop)

[上一章](01-model-agent-and-harness.md) · [下一章：工具调用](03-tool-calling.md)
