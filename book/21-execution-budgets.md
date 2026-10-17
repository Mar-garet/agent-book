# 明明限制了步数，为什么还能花掉更多资源？

交通助手查车次，住宿助手查房间，协调者还要把材料合起来检查。若每个助手都能再开一个子任务、失败后又能多试几次，整份行程可能还没核对完，程序的调用额度已经耗尽。

这里先分清两种预算。1500 元是用户这次旅行能花的钱，用来计算往返高铁、一晚住宿、餐饮和市内交通估算；模型或 API 调用费用，是运行助手的成本。下面讨论的是后者。给最后检查留几次模型调用，不是从旅行预算里扣钱。

一次程序运行被设成“最多两轮”，也未必代表所有助手加起来只调用两次模型。要控制整项工作的开销，先要知道程序到底在数什么。

## 一步、一轮、一次请求，不一定是一回事

模型一次回答可能提出多个查询；一个查询工具可能调用子助手；一个程序步骤也可能运行几段代码。网络失败后，同一轮里还可能重发请求。

因此，限制同时运行几项、最多推进几步、最多请求几次模型，解决的是不同问题。

| 想限制什么 | 应该数什么 | 不能用什么简单代替 |
| --- | --- | --- |
| 同时发出太多查询 | 并发请求数 | 最终请求总数 |
| 模型反复想而不结束 | 相应运行中的模型轮数 | 全部子助手的调用次数 |
| 一段流程不停推进 | 流程步骤数 | 每一步内部的工具次数 |
| 总请求或总费用 | 各消费处的实际尝试与用量 | 聊天消息条数 |

结束后准确显示花了多少，只完成了记账。要阻止下一次超额调用，程序还得在发出请求之前检查并分配额度。

## 父助手两轮，为什么父子加起来有四次

OpenAI Agents SDK 的交接继续使用当前 Runner；把另一个 Agent 当工具时，可以启动新的子 Runner。Runner 是组织一次模型与工具循环的运行器，各自可以持有自己的轮数。

本书用真实 Runner 和预先安排响应的模型替身，运行了几种情况，没有访问真实模型或旅行服务：

| 运行安排 | 父方模型替身调用 | 子方模型替身调用 | 结果 |
| --- | --- | --- | --- |
| 交接，外层上限 1 | 1 | 0 | 接收者尚未调用就超限 |
| 交接，外层上限 2 | 1 | 1 | 接收者返回 |
| 子 Agent 当工具，父上限 2，子默认 | 2 | 2 | 共四次调用，父返回 |
| 子 Agent 当工具，父上限 1，子默认 | 1 | 2 | 子完成后，父超限 |

上限没有失效。它阻止的是父运行的下一轮，不能取消子运行已经做过的工作。

Hermes 创建子 Agent 时也可以建立新的迭代预算；Cline SDK 的一次 execute 会初始化本次迭代计数。若应用不断开启新运行，局部上限可能一直遵守，整体却不断领取新额度。

Pydantic AI 的一个示例则显式把父方的 usage 传给子 Agent，让子请求进入同一份用量统计。这能帮助看清合计，但统计与阻止超额仍是两回事；不能只因为父子共享一个对象，就认为所有请求已经受到同一上限保护。

## 流程走一步，内部可能做很多事

LangGraph 的调度步骤安排节点执行，节点内部又能调用多个工具。开发者把它设为一步，不代表这一步只能查一次车票。

本书另一组独立实验，在一个工具节点里放入三次模拟创建。图上限为 1 时，三次写入已经发生，图随后报步数超限；设为 2，同一批次可以结束。还有一个图在三步里每步做两个模拟动作，一共六次。

这些不是旅行操作实测，而是检查计数位置。它说明图步数不会自然限制节点内的写入数，超限报错也不会撤销已经发生的动作。

Agent Framework 将模型往返、函数调用总数和持续时长分开配置；CrewAI 也分别限制 Agent 的迭代和内部流程函数的调用：一轮处理可能调用多个函数，不能当作同一个数量。Deep Agents 工厂设置的图推进上限同样不能直接解释成费用额度。

设计旅行助手时，可以同时设置这些限制：避免一个助手想太久，避免一次并发太多查询，再单独限制整项工作的调用总量。它们应该互相补充，而不是争用同一个“最大步数”。

## 到达上限之后，程序可能还要请求一次模型

系统通常还想给用户一个可读的结束说明。Semantic Kernel 的自动函数调用达到上限后，可以关闭函数调用，再请求最终回答；Smolagents 达到动作步数上限后，也会尝试生成最终答复。Smolagents 另外插入的规划步骤同样可能消耗模型请求。

AgentScope 在普通迭代之外，还可以为生成符合要求的结构化结果留出几轮。这些安排有用途，却意味着界面不能把迭代上限简单写成“总共最多调用模型这么多次”。

摘要、检查模型、后台记忆整理也可能另外消费。Qwen Code 把用户会话轮数与 Goal 自动任务预算分开，统一监控时还要把不同来源合起来。OpenCode 达到步骤限制后，既提示收尾，也在执行层禁止继续使用工具；只加一句“请结束”则没有同样作用。

## 暂停后继续，不能自动领一份新预算

用户说“先等等”，旅行计划保存下来。稍后继续时，如果程序只恢复聊天，又重新给每名助手一整份额度，总消费就会不断增加。

应用需要保留“这还是同一次旅行规划”以及已经用掉多少。SDK 可以把原来的运行信息保存为 RunState，包括已经用了几轮。用这份记录继续，与拿着相似消息新开一次运行不同；单次图执行的步数上限，也不是跨天的总额度。

时间同样要管。Gemini CLI 子运行检查轮数和截止时间；OpenClaw 对执行与结果结算分别设置期限。查询结束后，还要有时间读取结果、保存记录、解释未完成事项。

停止本地等待不代表远端服务立刻停止消费。如果请求还在运行，就保留它的编号和未结算用量，不能直接把额度全部退回再发一个新的。

## 先分配，再调用；不确定的消费先留着

要约束父子合计，可以让所有昂贵请求经过同一份记录。它列出三项：已经消费、已经分给正在工作的助手、还能分配多少。这里把这份记录称为共享账本。

子助手开始前先申请，结束后按实际用量结算。多个助手同时申请时，检查和分配要连在一起完成，不能让它们各自读到“还有一次”后都开始。

下面的设计示例用模型调用次数表示额度。总共 10 次，其中 2 次保留给最后核对。交通助手先领 3 次，住宿助手领 4 次；额外研究申请被拒绝。交通实际用了 2 次，归还剩余 1 次；住宿还没报结果，4 次仍保留，最后核对依然能申请。

示例只演示分配和结算，不调用模型，也不计算旅游费用。两种语言打印相同结果。

```typescript
class CallBudget {
  used = 0;
  held = new Map<string, number>();
  constructor(limit: number, protectedCalls: number) {
    this.limit = limit; this.protectedCalls = protectedCalls;
  }
  readonly limit: number;
  readonly protectedCalls: number;
  get reserved(): number { return [...this.held.values()].reduce((a, b) => a + b, 0); }
  reserve(task: string, calls: number, finalCheck = false): void {
    const ceiling = this.limit - (finalCheck ? 0 : this.protectedCalls);
    if (!Number.isInteger(calls) || calls <= 0 || this.held.has(task))
      throw new Error("invalid request");
    if (this.used + this.reserved + calls > ceiling) throw new Error("budget");
    this.held.set(task, calls);
  }
  settle(task: string, actual: number): void {
    const held = this.held.get(task);
    if (held === undefined || !Number.isInteger(actual) || actual < 0 || actual > held)
      throw new Error("invalid usage");
    this.held.delete(task); this.used += actual;
  }
}
const budget = new CallBudget(10, 2);
budget.reserve("traffic", 3);
budget.reserve("hotel-running", 4);
try { budget.reserve("extra-research", 2); }
catch { console.log("research stopped"); }
budget.settle("traffic", 2);
budget.reserve("final-check", 2, true);
console.log("final check reserved");
console.log(`used=${budget.used} held=${budget.reserved}`);
```
```python
class CallBudget:
    def __init__(self, limit: int, protected_calls: int):
        self.limit, self.protected_calls = limit, protected_calls
        self.used = 0
        self.held: dict[str, int] = {}

    @property
    def reserved(self) -> int:
        return sum(self.held.values())

    def reserve(self, task: str, calls: int, final_check: bool = False):
        ceiling = self.limit - (0 if final_check else self.protected_calls)
        if type(calls) is not int or calls <= 0 or task in self.held:
            raise ValueError("invalid request")
        if self.used + self.reserved + calls > ceiling:
            raise ValueError("budget")
        self.held[task] = calls

    def settle(self, task: str, actual: int):
        held = self.held.get(task)
        if (held is None or type(actual) is not int
                or actual < 0 or actual > held):
            raise ValueError("invalid usage")
        del self.held[task]
        self.used += actual

budget = CallBudget(10, 2)
budget.reserve("traffic", 3)
budget.reserve("hotel-running", 4)
try:
    budget.reserve("extra-research", 2)
except ValueError:
    print("research stopped")
budget.settle("traffic", 2)
budget.reserve("final-check", 2, True)
print("final check reserved")
print(f"used={budget.used} held={budget.reserved}")
```

真正执行时，助手还要在每次调用前扣自己的份额，不能申请三次却直接调用五次。保护额度的使用权也由运行程序控制，模型不能把普通研究改名“最后核对”就越过限制。多进程服务需要用数据库等方式一起完成检查与分配，重启后记录仍要存在。

金额比次数更难预先确定。输出长度、提供方计价和请求重试都会影响实际费用。Pydantic AI 在请求前、响应后分别检查用量，缺价格资料时金额限制无法可靠强制。应用可以保守估算并限制最大输出，但应该说明哪些是估算，不能把事后发现超支称为事前阻止。

同一次业务动作重试，也可能多花一次请求成本。日历服务即使识别重复而只保留一条日程，请求本身仍可能产生开销。防重复效果和计算消费，需要两份关联记录。

## 最后几次调用，留给真正有用的检查

这份旅行草稿至少要检查：周六去、周日回，交通时间与住宿衔接，一晚住宿，加上餐饮和市内交通估算后是否在 1500 元以内，以及没有订票订房。日历还要等用户确认，暂停过就重新确认，创建后再核对一次。

这些步骤不能等探索花光额度后再决定要不要做。查询候选很多时，可以停止继续找“也许更便宜”的选择，先把已有方案核对清楚。

小型只读助手可以先用局部轮数和请求次数限制，接线少。允许并行、自动重试和跨天继续以后，共享记录更有价值，也增加保存、结算和处理未知消费的工作。

资源不足就交代还缺什么，保存已查到的车次、房间和未决条件，不把未核对的草稿说成完成。最后一章将补齐返程、核算费用，并把用户确认后的日历操作与最终交付放在一起检查。

## 延伸阅读

[实现、版本与实验资料](../references/chapter-notes.md#21-execution-budgets)

[上一章：文档里的一句话，为什么变成了行动指令？](20-trust-boundaries.md) · [下一章：评测系统：让任务完成成为可复核的结论](22-evaluation-and-completion.md)
