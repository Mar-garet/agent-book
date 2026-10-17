# 明明限制了步数，为什么还能花掉更多资源？

把父运行设为“最多两轮”，整项任务就只做两轮工作吗？本书的确定性实验出现了另一个结果：父模型替身调用两次，子模型替身也调用两次，共四次。父运行正常结束，限制并没有失效，它约束的是当前那次运行。

R42 协调者面对同样的设计问题。日志与数据研究者各拿一份轮数，补查又能另起子任务，失败后还可重试。最后材料很多，却可能没有资源核对测试产物是否覆盖 15–16 日。

预算要回答四件事：谁计数、计什么、何时检查、哪些执行者共享。它既是成本管理，也是确保任务还能正确收尾的设计。

## 一个数字不能同时代表所有资源

一次模型输出可以包含多个工具，工具可以启动子 Agent，图节点可以提交多项业务动作。一次模型轮次内部还可能重试提供方请求。因此，模型轮、网络尝试、工具数、图步、并发度、token、持续时间与金额不能互换。

| 限制位置 | 实际约束 | 还不能直接保证 |
| --- | --- | --- |
| SDK 当前 Runner 的轮数 | 本运行继续调用模型多少轮 | 子 Runner 的总工作 |
| 图的调度步 | 状态推进多少步 | 每节点内的动作数量 |
| 重试策略 | 一项工作的尝试次数 | 全任务各处重试的合计 |
| 并发度 | 同时运行多少项 | 最终总调用或总费用 |
| 请求 token / 金额检查 | 指定调用链中的相应用量 | 未计入路径的后台消费 |

准确记账也不同于执行前限制。结束后显示总花费，能帮助分析；动作前原子分配额度，才能阻止下一次超额开始。设计时先确定需要哪一种承诺。

## SDK 的轮数属于哪一次运行

OpenAI Agents SDK 的交接继续使用当前 Runner，工具式委派则可以启动新的子 Runner。父上限没有自然变成子运行余额。

本书以真实 Runner 配预编排模型替身得到以下结果，没有调用远程模型：

| 场景 | 父模型替身次数 | 子模型替身次数 | 运行结果 |
| --- | --- | --- | --- |
| 交接，父上限 1 | 1 | 0 | 接收者执行前超限 |
| 交接，父上限 2 | 1 | 1 | 接收者返回 |
| Agent 工具，父上限 2，子默认 | 2 | 2 | 共四次调用，父返回 |
| Agent 工具，父上限 1，子默认 | 1 | 2 | 子完成后，父超限 |

最后一行尤其重要：上限阻止父运行下一轮，不能让子工作变成没有发生。Hermes 也在构造子 Agent 时建立新的迭代预算；Cline SDK 的每次 execute 重新初始化本次迭代计数。局部上限可以完全正确，根任务仍不断领取新额度。

反过来，共享用量也需要显式连接。Pydantic AI 的航班示例在工具内调用子 Agent 时传入父的 usage，让子请求进入同一份统计。共享统计提供总量依据，执行前如何拒绝还需配相应限制。不能从对象叫“context”就推断所有子工作自动共用金额硬上限。

## 图的调度步，数的又是什么

本书的同步图实验把三次模拟创建放进一个工具节点。调度上限为 1 时，三次写入已发生，随后图报步数超限；设为 2，同一批次可正常结束。另一图在三步里每步执行两个模拟动作，合计六次。

节点里做多少事，由节点内部实现决定。LangGraph 的递归上限无法替业务服务限制写入数；LangGraph JavaScript 也把图步、并发与任务重试分别处理。Deep Agents 的工厂绑定较大的图推进上限，不能因此把这个数当生产费用预算。

Agent Framework 把函数循环的模型往返、函数总调用和持续时长分别配置；CrewAI 的 Agent 迭代上限与内部 Flow 方法调用上限也是不同单位。这些实现值得借鉴的地方，是把计数对象说清楚，而不是寻找一个包揽全部资源的“最大步数”。

## 轮数结束以后，系统可能还要做什么

停止主循环不一定立即停止所有模型消费。Semantic Kernel 自动函数调用达到上限后，可以关闭函数调用再请求最终回答；Smolagents 动作步达到上限后也会尝试生成最终答复，规划步骤本身又可能额外调用模型。AgentScope 的普通迭代之外，还可能给结构化收尾保留宽限轮数。

这些安排有合理目的：让用户得到可读的停止说明，或者把部分结果整理成约定格式。代价是产品不能把一个迭代配置直接展示为“最多请求模型这么多次”。收尾、摘要、judge、后台记忆整理，都要归入明确的消费来源。

Qwen Code 把用户会话轮数与 Goal 运行预算分开，避免自动任务挤占交互额度；统一监控却必须再把来源汇合。OpenCode 达到步骤上限后禁止继续用工具并加入收尾提示，提示与执行拒绝在这里配合，仍未把它变成全任务树费用账本。

## 恢复时，额度是否跟着任务走

跨日任务若每次恢复都领一份完整预算，总消费依然可能失控。稳定业务任务身份应跨会话、执行者和恢复入口延续，已经消费的记录也随之保留。

用已保存 RunState 恢复，与拿相似消息新开 Runner 不同；图的单次停止位置，也不能自动解释成跨全部调用的永久总上限。OpenCode 的恢复次数限制能抑制无界重启，但尝试次数与已付费用仍是不同账本。

时间预算也要分层。Gemini CLI 子运行按轮数和截止时间检查停止；OpenClaw 对执行与结算分别设期限。为查询结果和写入记录预留时间，能避免执行刚结束就因总超时丢失收尾。停止本地等待后，远端任务可能仍消耗资源，必须继续保留其编号与待核对费用。

## 共享预算需要在动作前分配

根任务账本应区分已消费、已预留、可再分配。子任务先领额度再行动，结束后按实际用量结算。多个并发申请必须原子处理，否则它们可能同时读到“还有一次”，各自开始一次。

未知结果不能立即释放全部预留。旧请求可能仍在执行，此时把额度交给新任务，会让两份消费同时存在。业务幂等只控制同动作的效果，资源账本还要记录重试确实增加的请求成本。

下面用固定整数单位演示。总额度 10，其中 2 留给验收；探索不能占用保护部分。一次未知尝试仍占 4，日志查询按实际 2 结算，所以额外探索被拒，验收仍能申请。它是单进程设计示例，没有价格估算或持久数据库，两个版本打印同样结果。

```typescript
class Ledger {
  spent = 0;
  holds = new Map<string, number>();
  constructor(limit: number, protectedUnits: number) {
    this.limit = limit; this.protectedUnits = protectedUnits;
  }
  readonly limit: number;
  readonly protectedUnits: number;
  get held(): number { return [...this.holds.values()].reduce((a, b) => a + b, 0); }
  reserve(id: string, units: number, verification = false): void {
    const ceiling = this.limit - (verification ? 0 : this.protectedUnits);
    if (!Number.isInteger(units) || units <= 0 || this.holds.has(id))
      throw new Error("invalid reservation");
    if (this.spent + this.held + units > ceiling) throw new Error("budget");
    this.holds.set(id, units);
  }
  settle(id: string, actual: number): void {
    const reserved = this.holds.get(id);
    if (reserved === undefined || !Number.isInteger(actual) ||
        actual < 0 || actual > reserved) throw new Error("invalid settlement");
    this.holds.delete(id);
    this.spent += actual;
  }
}
const ledger = new Ledger(10, 2);
ledger.reserve("logs", 3);
ledger.reserve("unknown-attempt", 4);
try { ledger.reserve("extra", 2); }
catch { console.log("exploration blocked"); }
ledger.settle("logs", 2);
ledger.reserve("verify", 2, true);
console.log("verification reserved");
console.log(`spent=${ledger.spent} held=${ledger.held}`);
```
```python
class Ledger:
    def __init__(self, limit: int, protected_units: int):
        self.limit, self.protected_units = limit, protected_units
        self.spent = 0
        self.holds: dict[str, int] = {}

    @property
    def held(self) -> int:
        return sum(self.holds.values())

    def reserve(self, key: str, units: int, verification: bool = False):
        ceiling = self.limit - (0 if verification else self.protected_units)
        if type(units) is not int or units <= 0 or key in self.holds:
            raise ValueError("invalid reservation")
        if self.spent + self.held + units > ceiling:
            raise ValueError("budget")
        self.holds[key] = units

    def settle(self, key: str, actual: int):
        reserved = self.holds.get(key)
        if (reserved is None or type(actual) is not int
                or actual < 0 or actual > reserved):
            raise ValueError("invalid settlement")
        del self.holds[key]
        self.spent += actual

ledger = Ledger(10, 2)
ledger.reserve("logs", 3)
ledger.reserve("unknown-attempt", 4)
try:
    ledger.reserve("extra", 2)
except ValueError:
    print("exploration blocked")
ledger.settle("logs", 2)
ledger.reserve("verify", 2, True)
print("verification reserved")
print(f"spent={ledger.spent} held={ledger.held}")
```

真实系统还要防止验收优先权被普通执行者冒用，并把预占/结算持久化。同一进程中无异步间隙的检查，不能替代多进程事务。每次网络尝试也应有自己的记账身份：同一业务动作重试可以复用幂等键，却可能产生新费用。

费用不能确定上界时，绝对不超支的承诺需要额外条件。Pydantic AI 在请求前和响应后分别检查用量；缺少价格资料时，金额限制无法可靠强制。应用可以先保守估算、限制最大输出，再在响应后结算，但必须说明哪些成本只是估算，不能把事后发现超额称为事前阻止。

## 还要给验收与交接留资源

R42 的最终核对必须保留：15–16 日窗口、16 日业务日期、测试环境与方案版本、产物内容、审批和动作记录。不能把探索预算花光，再让协调者根据草稿宣布成功。已有 `job-42` 未通过验收，后续新测试的完成证据仍要由独立检查取得。

小型只读助手可以先用局部轮数和工具计数控制，接线简单。允许并行、重试与跨日恢复之后，根账本才更有价值，代价是预占、结算、未知消费核对与持久化。昂贵写入还应单独限制动作次数，不能折成模型轮数。

资源不足时，系统停止新工作，保存已完成范围、未决问题、仍在运行的动作和接手位置。它可以交付清楚的未完成结果。最后一章将把这些过程记录与真实产物放到一起，判断 R42 何时才有资格称为完成。

## 延伸阅读

[实现、版本与实验资料](../references/chapter-notes.md#21-execution-budgets)

[上一章：文档里的一句话，为什么变成了行动指令？](20-trust-boundaries.md) · [下一章：评测系统：让任务完成成为可复核的结论](22-evaluation-and-completion.md)
