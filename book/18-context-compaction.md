# 第十八章：摘要更短了，Agent 为什么反而忘了关键事实？

本章主线统计一个由宿主主动调用的会话压缩入口；自动触发属于会话内部的另一条调用路径。对照案例另统计一个本地压缩协调入口。这里数的是协调一次压缩的入口，准备数据、摘要生成器与存储组件不另计。

报表助手读完一段很长的日志，根因出现在末尾。用户又补充了一句：“只处理测试环境。”随后，界面提示上下文已经压缩。

助手仍记得正在排查报表，却找不到那条根因，也开始讨论修改生产配置。

很容易把问题归结为摘要模型不够好。但如果根因在摘要模型读取之前就被裁掉了，继续更换模型并没有触及这一次信息丢失的位置。

## 压缩之前，运行系统已经做了选择

一次压缩至少经过四个位置：原始记录、被选中的摘要材料、生成的摘要、下一次模型请求。它们不是同一份东西。

原始记录保存发生过什么。准备组件按预算和消息结构，选出哪些历史交给摘要器、哪些近期消息保留原样。摘要器依据收到的材料生成较短表示。会话管理器提交新的压缩边界，之后的请求再据此组装输入。

当事实消失时，需要沿这条链逐段定位：它是否被记录，是否入选摘要材料，是否出现在摘要里，最后是否进入实际请求。只比较压缩前后的总长度，看不到这些差别。

```mermaid
flowchart LR
    A[原始会话记录] --> B[选择与预处理]
    B --> C[交给摘要模型的材料]
    C --> D[摘要产物]
    A --> E[保留的近期消息]
    D --> F[重建本轮输入]
    E --> F
    A -.明确定位并回查.-> F
```

图中最后一条虚线需要单独实现。保存了原文，不会让它自动回到下一轮输入。

## Pi 先保持执行结构，再缩短历史

在本书固定的 Pi 快照中，宿主主动压缩使用 `AgentSession.compact(...)`。CLI、RPC 等表面形式可以进入这个方法；内部默认摘要函数负责生成内容，会话管理器负责追加记录与重建上下文，二者不是同层的新入口。默认流程也允许扩展取消压缩或提供自定义结果，因此研究内置路径时必须保留这个条件。[^entry]

准备组件要同时处理两种预算：什么时候启动压缩，以及近期历史尽量保留多少。前者为后续生成腾出空间，后者决定哪些消息暂时不需要转述。它们都不等于承诺保留全部关键事实。

消息结构还限制切点。工具结果要与前面的工具请求保持可解释的关系，不能随意把结果当成独立起点。一个完整工具组很大时，近期保留目标可能被突破。结构完整解决的是请求是否合法、结果能否对应，不会自动证明业务约束都保真。[^selection]

特别要小心“最近发生的事一定保留原文”这种概括。一个很长的回合可以被切开，当前用户指令可能进入需要总结的前半段。系统继续保留近期工具消息，不等于那条用户限制仍按原字句进入模型。[^selection]

## 一个在模型读取前就发生的丢失

Pi 的默认摘要序列化器对每条工具结果设置了长度限制：只取前 2,000 个字符串单位，随后附上截断提示。用户与助手的普通正文不走这条相同的工具结果截断分支。这里使用的是字符串长度，并不是 2,000 tokens。[^truncate]

本书直接调用固定快照中的真实序列化函数做了四个检查。为避免安装整个模型提供方依赖，加载器把一个包再导出指向其原本的源文件；没有替换或重写被观察的函数。输入全部是人工构造的 ASCII 消息，没有生成摘要，也没有调用模型。

| 输入位置 | 标记是否进入摘要材料 |
| --- | --- |
| 长工具结果末尾 | 没有进入 |
| 同样长的工具结果开头 | 进入 |
| 长用户消息末尾 | 进入 |
| 两条各自较短的工具结果，总长度超过 2,000 | 两条中的标记都进入 |

完整输入、实际序列化结果和源文件摘要见 [Pi 摘要输入实验](../experiments/README.md#摘要模型读取前的裁剪)。最后一行说明这是每条工具结果的限制，不能把它解释成整个摘要请求的总长度限制。

这个检查证明的是一条确定的信息路径：特定位置的标记没有送达摘要材料。它没有证明真实任务必然忘记该事实。模型还可能从其他消息读到同一信息，摘要过程也有更多输入。但如果某条事实只存在于那段已移除的尾部，摘要器就无法从这份材料中忠实摘出它。

改进方向因此也不同：可以让工具提取相关片段，可以在裁剪前搬运关键信息，也可以为原文保留稳定定位。仅提高摘要文字的流畅程度，没有直接修复这条缺失路径。

## 摘要会继续成为下一轮摘要的材料

长期任务可能压缩不止一次。新的压缩会接收上一份摘要与后来的消息；已经被摘要覆盖的全部早期原文，不会因此自动重新展开。这样节约了输入，也意味着早期遗漏或错误转述可能沿摘要继续传递。[^summary]

“用户要求暂不修改生产配置”如果被简化成“已经讨论环境配置”，下一次整理可能只看到后一句。后来的摘要未必知道自己丢掉的是一项行动限制。

一种应用设计是把持续生效的约束与一般工作叙述分开保存：适用环境、允许动作、规则生效时间由明确字段和执行检查承载；背景、假设与尝试过程可以有损整理。这样做增加了结构维护成本，但能让部分关键状态不依赖多次自由转述。

这不是说摘要应当代替授权记录。相反，模型输入里的限制帮助它选择动作，执行器仍要依据当前规则判断动作能否发生。[第二十章](20-trust-boundaries.md) 会继续区分这两层责任。

## 原文回查，需要一条走得通的路径

Pi 的持久会话可以保留压缩前的原条目。调用者能取得实际会话文件，按消息条目与工具调用编号定位结果，再提取需要的片段；导出当前分支也与导出压缩投影不同。导出一个分支，不等于得到整个会话树的全部旁支。[^archive]

这里至少还缺三个决定：什么迹象触发回查，回查哪次调用，取回的片段怎样进入后续请求。模型说“我好像记得”，没有完成其中任何一个步骤。

还要区分工具原始结果与更早的业务原文。如果读取工具自己就截断了文件，保存的会话只包含那次实际返回的部分。找回会话记录不会凭空补齐从未进入记录的字节；此时可能需要对原文件做有范围的再次读取。[^archive]

对有副作用的动作，尤其不能为了找回一份旧结果就重做动作。查询已有结果、读取已保存副本和重新生成一次，具有不同业务含义。

## Hermes 让压缩与运行信息刷新相遇

Hermes 的对照范围是一个本地压缩协调入口 `compress_context(...)`，底层内容引擎是它调用的组件。本文没有穷尽网关、原生提供方压缩或全部后台路径。

这条实现的触发不只是达到一个百分比：可用输入预算会扣除输出预留，运行路径还考虑是否启用、冷却期、尝试预算与使用量依据。比较两个项目时，抄出两个阈值并不能说明它们会在同样时点压缩。[^hermes]

更有意思的是提交附近的责任变化。普通在线压缩路径可以重建系统前缀，重新读取记忆，并尝试刷新工具说明；保留已注入前缀的后台路径又有例外。因此，压缩既可能改变历史表示，也可能让运行会话读到更新的信息。[^refresh]

这使“压缩前后行为变了”的原因更复杂：可能是旧事实被省略，也可能是新规则终于被加载。要定位原因，需要同时保存消息变化与前缀变化。

## 一次压缩是否生效，不能只看提示文字

在 Pi 被核对的默认手动路径里，摘要通过检查后，会先追加压缩条目，再刷新上下文和发出完成事件。后续步骤报错，不能反推前面的追加一定没有发生。反过来，摘要生成失败也不能被当作一份完整摘要来提交。[^commit]

因此，观察位置应该落在状态变化上：选中了哪些条目，生成了什么候选摘要，是否追加了压缩记录，最终请求采用了哪个边界。用户看见的提示是过程的一部分，不是全部过程。

经过压缩，一个 Agent 需要保住的是继续做事所需的依据。下一章把这个问题向外推进：这些依据如果要交给另一个 Agent，谁决定传什么，谁还负责最后的交付？

[^entry]: [本地主动入口](../pi/packages/coding-agent/src/core/agent-session.ts#L2779-L2810) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2779-L2810)；[扩展与提交顺序](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2807-L2880)。
[^selection]: [本地压缩准备](../pi/packages/coding-agent/src/core/compaction/compaction.ts) · [完整研究与切点分析](../references/studies/context-compaction.md)；[默认预算与触发](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L120-L130)。
[^truncate]: [本地序列化器](../pi/packages/coding-agent/src/core/compaction/utils.ts#L93-L155) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/utils.ts#L93-L155)。
[^summary]: [本地历史与旧摘要选择](../pi/packages/coding-agent/src/core/compaction/compaction.ts#L867-L899) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L867-L899)；[摘要更新要求](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L540-L579)。
[^archive]: [本地会话文件路径](../pi/packages/coding-agent/src/core/session-manager.ts#L1156-L1158) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1156-L1158)；[当前分支导出](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-export.ts#L8-L44)；[读取工具自身的限制](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/read.ts#L86-L96)。
[^hermes]: [本地压缩入口](../hermes-agent/agent/conversation_compression.py#L4045-L4079) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4045-L4079)；[预算推导](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L2749-L2807)。
[^refresh]: [本地前缀刷新](../hermes-agent/agent/conversation_compression.py#L3081-L3125) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L3081-L3125)；[提交前调用](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4252-L4265)。
[^commit]: [本地追加与刷新](../pi/packages/coding-agent/src/core/agent-session.ts#L2845-L2880) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2845-L2880)；适用条件见 [压缩研究](../references/studies/context-compaction.md)。

[上一章：工具结果](17-tool-results-and-retries.md) · [下一章：委派与交接](19-delegation-and-handoffs.md)
