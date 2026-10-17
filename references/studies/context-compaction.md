# 上下文压缩：原文还在，哪些事实已经离开了模型

> 研究日期：2026-10-17\
> 固定版本：Pi `8efd314fa3d3232ce197d8d7a6a5660530b9d83e`；Hermes `e31c674f7c523070f48f3baad0650c2fdd7ef6e5`，已核对本地 HEAD 与主仓库 `SOURCES.json`。\
> 方法：追踪固定快照的一手源码，阅读相关上游测试但未运行上游测试；另用 Node v26.4.0 实际调用了 Pi 的 `serializeConversation`，没有调用模型，也没有安装上游依赖。具体隔离方法与结果见后文。\
> 在未初始化子模块的书稿工作树中，可从已下载的主仓库读取对应快照；正式复现命令支持指定源码根目录。

## 研究边界与读者情境

前面的 [Pi 执行研究](pi-deepagents-execution.md) 已解释会话原文、运行投影与模型请求的区别；[Hermes 记忆研究](openclaw-hermes-memory.md) 已追踪写盘、冻结记忆块和重建。本记录继续追问：**是谁挑出被压缩的材料，摘要模型真正读到了多少，原本的最新指令会不会变成一句转述，压缩失败发生在提交之前还是之后？**

可以从这样的情境进入正文：Agent 调查一个失败任务，读取了很长的日志。用户补充“只改测试环境，不要动生产配置”。几轮之后，界面提示上下文已压缩。Agent 仍能复述问题背景，却忘了日志末尾的关键报错，或者把旧计划当作当前指令。此时要分别检查材料选择、摘要输入、摘要产物和最终请求，不能只问“摘要模型够不够聪明”。这是用于分析机制的情境，未运行对应任务评测。

本记录深入 Pi 编程会话的内置压缩路径，对照 Hermes 的本地压缩预算及前缀刷新边界。没有穷尽 Hermes 的全部压缩引擎、原生提供商压缩、网关并发提交与多媒体恢复分支。

## 一、Pi：先保留执行结构，再让模型缩写过去

### 1. 入口、参与者与完整调用顺序

本节统计 **一个供宿主主动调用的会话压缩入口：`AgentSession.compact(customInstructions?)`**。CLI 的 `/compact`、RPC 与扩展均可进入它。自动压缩由会话生命周期内部的阈值检查与溢出恢复进入，不是另一个要求用户直接调用的公共方法。底层同名 `compact` 是摘要工作函数；准备对象与结果对象传递数据，会话管理器负责条目和持久化，模型流函数负责生成摘要，它们都不另算入口。[本地：手动入口及其范围](../../pi/packages/coding-agent/src/core/agent-session.ts#L2779) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2779-L2810) [本地：共享摘要调用](../../pi/packages/coding-agent/src/core/agent-session.ts#L2748) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2748-L2771)

```text
用户 / 宿主明确要求压缩                会话即将请求下一次回答 / 结束后检查
→ 手动入口，先取消当前执行              → 判断阈值或溢出，决定是否需要恢复
                  ↘                  ↙
会话管理器提供当前分支
→ 准备函数读取当前有效投影，选切点
→ 区分旧历史、被切开回合的前半段、保留的近期消息
→ 扩展可取消或提供自定义压缩结果
→ 默认路径把待总结消息序列化，调用摘要模型
→ 检查失败状态、工具调用与取消信号
→ 会话管理器追加一条 compaction
→ 按新边界重建上下文
→ 发出压缩完成事件；自动路径再决定是否继续
```

这里的职责先后可直接从手动入口和自动执行器看到：准备先于扩展，默认摘要先于追加，刷新上下文先于完成事件。扩展可以替换结果，所以以下默认摘要行为不能无条件套用到所有第三方压缩扩展。[本地：手动准备、扩展与追加](../../pi/packages/coding-agent/src/core/agent-session.ts#L2807) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2807-L2880) [本地：自动路径](../../pi/packages/coding-agent/src/core/agent-session.ts#L3140) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L3140-L3241)

### 2. 触发预算与保留预算解决不同问题

**实现事实 P1：** 内置默认值为开启自动压缩、预留 16,384 tokens、近期保留目标 20,000 tokens。普通阈值条件是当前上下文估计值 **大于** `contextWindow - reserveTokens`。估计优先利用有效的提供商 usage，再估计后来追加的消息；若使用量来自后续压缩或上下文编辑之前，投影估计器会放弃这份旧锚点，重新按当前内容估算。以上是该快照的默认与算法，不是任意模型、用户配置下的固定实耗。[本地：默认值](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L120) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L120-L130) [本地：估计与触发](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L192) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L192-L270)

会话在下一次助手回答前检查阈值；结束后的检查还区分成功回答超窗与需要重试的溢出。后者至多进行一次压缩后重试，已经正常结束的回答不会仅因压缩而重答。手动压缩先取消当前操作，完成后也不会自动重试被打断的回合。[本地：回答前检查](../../pi/packages/coding-agent/src/core/agent-session.ts#L767) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L767-L785) [本地：溢出分支与重试上限](../../pi/packages/coding-agent/src/core/agent-session.ts#L3040) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L3040-L3076) [本地：手动取消](../../pi/packages/coding-agent/src/core/agent-session.ts#L2789) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2789-L2797)

**设计推断：** 预留预算决定“何时应当整理”，保留预算决定“哪些近事尽量保持原样”。两者都不证明整理后一定低于模型上限；单条消息、完整工具组与摘要自身仍占空间。

### 3. 工具请求和结果不能被随意从中间剪开

**实现事实 P2：** 准备函数从当前有效投影倒着累计消息估计长度，选择接近保留目标的切点。可见的用户消息或助手消息可以成为切点，工具结果不能成为切点。这样，在助手发出工具请求之前切开，可以把这次请求及其后续结果一起保留。代码还处理压缩和省略编辑形成的不可见尾部，并非简单截取“最后 N 条”。[本地：切点资格](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L351) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L351-L364) [本地：实际投影切点算法](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L789) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L789-L856)

超大工具结果会让保留目标成为软目标。上游已有测试专门构造 8,000 字符的工具结果与 1,000 tokens 的保留配置，要求切点落在它前面的助手工具请求处，并标记这是一个被切开的回合。本次只阅读该测试，未执行。[本地：超大工具组用例](../../pi/packages/coding-agent/test/compaction.test.ts#L378) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/test/compaction.test.ts#L378-L406)

**设计推断：** 这是协议结构保护，不是内容保真证明；也不是对任意损坏输入的通用配对修复承诺。完整保留一个工具组，可以避免孤立结果，却可能保留大量低价值文本。

### 4. 保留最新消息，不等于保留本轮最初的用户指令原文

**实现事实 P3：** 如果切点落在同一回合的中间，准备函数把该回合起始输入到切点前的内容单独分成 `turnPrefixMessages`；更早历史进入 `messagesToSummarize`。默认工作函数分别总结两部分，再把“历史摘要”和“当前回合前缀摘要”合成一个摘要。前缀提示词要求记录用户原始请求、已有进展、继续所需信息，并禁止凭空重建后续消息。[本地：材料拆分](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L885) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L885-L922) [本地：前缀摘要要求](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L929) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L929-L942) [本地：分别生成再合并](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L980) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L980-L1018)

**设计推断：** 一个用户请求可以带来上百次工具动作。即使“最近的执行”仍原样保留，开头那句“不要修改生产配置”也可能已经被移到待总结区；之后能否准确遵守它，要看摘要是否保存、最终请求是否包含、执行器是否另有授权检查。不能把近期消息窗口写成“最新用户约束绝不会丢”。

### 5. 一个确定性损失发生在摘要模型读取之前

**实现事实 P4：** Pi 先把待总结消息转换为模型消息，再序列化为一段带角色标签的文字。序列化器保留助手可见正文与工具参数，不把 thinking 作为摘要材料；**每条工具结果的文字只取前 2,000 个字符，余下用截断标记代替**。用户和助手正文不走这条 2,000 字符截断逻辑。这些是摘要输入的选择规则，不是模型生成后才发生的遗漏。[本地：摘要请求组装](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L719) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L719-L740) [本地：序列化与截断](../../pi/packages/coding-agent/src/core/compaction/utils.ts#L93) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/utils.ts#L93-L155) [本地：上游对应用例，未运行](../../pi/packages/coding-agent/test/compaction-serialization.test.ts#L5) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/test/compaction-serialization.test.ts#L5-L77)

**情境推断：** 假如唯一的根因提示在一条旧工具结果的第 3,000 个字符，而且未被后续消息复述，摘要模型拿到的材料里就没有它。换一个更强的摘要模型也不能从这份输入中忠实摘出它。解决办法可能是提前提炼关键信息、按任务挑选工具结果片段，或在摘要中保留可查回的原文定位；这些是设计选项，不是本次对替代策略的效果结论。

### 6. 反复压缩会把“摘要”继续当作历史记录

**实现事实 P5：** 准备函数找到上一份有效压缩摘要，把它单独传给下一次摘要更新；已被之前摘要覆盖的早期原文不会因此全部重新展开。更新提示词要求保留原有信息、吸收新进展、更新下一步，也允许移除不再相关的内容。默认摘要检查结束状态与意外工具调用，但没有在该路径逐条验证用户约束与事实是否被完整复述。[本地：上一摘要与当前材料](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L867) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L867-L899) [本地：更新要求](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L540) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L540-L579) [本地：请求与结果检查](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L713) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L713-L752)

提交之后，压缩条目保存当前 system 消息快照；投影把该快照与摘要恢复为运行消息。发送给模型时，压缩摘要以带“此前历史已压缩”标记的 **user 消息**表达，并不是新的 system 指令。[本地：保存 system 快照](../../pi/packages/coding-agent/src/core/session-manager.ts#L1269) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1269-L1285) [本地：恢复快照和摘要](../../pi/packages/coding-agent/src/core/session-manager.ts#L461) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L461-L464) [本地：模型可见身份](../../pi/packages/coding-agent/src/core/messages.ts#L176) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/messages.ts#L176-L183)

**设计推断：** 保留 system 快照和保留用户任务细节是两种机制；前者由宿主搬运，后者可能依赖摘要。多次压缩也可能把早期错误转述继续传下去。源码能证明存在这些信息路径，不能直接量出累计误差率。

### 7. “压缩失败”要先判断是否越过追加边界

**实现事实 P6：** 默认摘要生成在 `error` 与 `length` 结束时抛错；后者即使已经返回部分文字，也不会作为正常摘要返回。摘要中出现工具调用也会被拒绝。分回合前缀摘要有同样检查。上游现有用例覆盖了截断摘要和意外工具调用，本次没有运行这些用例。[本地：失败状态检查](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L581) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L581-L593) [本地：拒绝工具调用](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L742) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L742-L752) [本地：前缀相同检查](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L1087) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L1087-L1098) [本地：上游拒绝用例](../../pi/packages/coding-agent/test/compaction-summary-reasoning.test.ts#L154) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/test/compaction-summary-reasoning.test.ts#L154-L210)

宿主提供 `abortCompaction()` 取消手动或自动压缩。两个入口均在摘要结束后、追加 compaction 之前检查各自的取消信号；扩展明确取消也会在追加前抛错。因此，可以把“摘要模型已经输出了一些文字”和“新的压缩边界已经生效”分开观察。[本地：手动提交前检查](../../pi/packages/coding-agent/src/core/agent-session.ts#L2873) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2873-L2879) [本地：取消入口](../../pi/packages/coding-agent/src/core/agent-session.ts#L2941) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2941-L2947) [本地：自动提交前检查](../../pi/packages/coding-agent/src/core/agent-session.ts#L3205) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L3205-L3209)

但不能扩大为“报告失败必定没有任何状态变化”：溢出恢复会先追加省略失败尝试的 `context_edit`，再做压缩；而 `session_compact` 扩展通知发生在压缩条目已经追加、上下文已经刷新之后。若这个后置处理抛错，会进入同一个错误捕获分支，代码没有在那里撤回已追加的 compaction。底层追加也先更新内存树再调用文件持久化，不能据此声称它是内存与磁盘的完整事务。[本地：恢复前先省略](../../pi/packages/coding-agent/src/core/agent-session.ts#L3071) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L3071-L3076) [本地：省略实际追加编辑](../../pi/packages/coding-agent/src/core/agent-session.ts#L1241) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L1241-L1256) [本地：追加后的扩展及捕获](../../pi/packages/coding-agent/src/core/agent-session.ts#L3207) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L3207-L3267) [本地：内存追加与持久化顺序](../../pi/packages/coding-agent/src/core/session-manager.ts#L1172) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1172-L1195)

**设计推断：** 排查失败时应记录“生成失败、取消、追加成功、后置通知失败、写盘失败”等实际阶段。单一的成功/失败 UI 提示不足以还原有效上下文。

### 8. 怎样真正找回压缩前的工具结果

**实现事实 P7：** SessionManager 维护带 id/parentId 的追加式会话树，持久模式把条目写入 JSONL。压缩另加一条带摘要与 `firstKeptEntryId` 的记录；当前上下文只选择摘要、保留区和后续条目。`getEntries()` 返回所有原条目，而不是当前投影。[本地：会话树职责](../../pi/packages/coding-agent/src/core/session-manager.ts#L976) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L976-L985) [本地：投影选择范围](../../pi/packages/coding-agent/src/core/session-manager.ts#L476) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L476-L511) [本地：原条目读取](../../pi/packages/coding-agent/src/core/session-manager.ts#L1515) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1515-L1522)

真正的回查顺序是：

```text
宿主取得当前 AgentSession.sessionFile / SessionManager.getSessionFile()
→ 读取该 JSONL，或在同一宿主进程调用 getEntries()
→ 结合当前分支与条目 id / toolCallId，找到原始 toolResult
→ 提取任务需要的片段
→ 宿主或工具把片段交给后续模型请求
```

`getSessionFile()` 是文件路径的实际来源，可能返回 undefined；默认会话目录按工作目录编码，调用者也能指定其他路径。另一个实际入口 `AgentSession.exportToJsonl(path)` 经导出器读取 **当前分支的原条目**，而非 `buildSessionProjection().messages`，所以也能导出压缩前仍在该分支上的记录。导出当前分支不等于导出会话树的所有旁支。[本地：路径 getter](../../pi/packages/coding-agent/src/core/session-manager.ts#L1156) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1156-L1158) [本地：默认目录](../../pi/packages/coding-agent/src/core/session-manager.ts#L589) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L589-L601) [本地：导出入口](../../pi/packages/coding-agent/src/core/agent-session.ts#L4338) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L4338-L4346) [本地：导出读取 getBranch](../../pi/packages/coding-agent/src/core/session-export.ts#L8) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-export.ts#L8-L44)

**边界：** 这只能恢复“工具原先已经返回并被记录的内容”。例如 read 工具本身有行数/字节截断，原文件中的其余内容需要重新读取；JSONL 不会保存从未返回的部分。持久模式也不能套用于纯内存会话。原条目可读取，不代表摘要器会自动回查，更不代表模型在需要时一定发起回查；上述默认摘要生成只使用准备好的消息与旧摘要。[本地：read 输出限制](../../pi/packages/coding-agent/src/core/tools/read.ts#L86) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/read.ts#L86-L96) [本地：持久化开关](../../pi/packages/coding-agent/src/core/session-manager.ts#L1172) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1172-L1188) [本地：摘要仅组装传入材料](../../pi/packages/coding-agent/src/core/compaction/compaction.ts#L713) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/compaction.ts#L713-L740)

## 二、Hermes 对照：预算控制之外，压缩也是前缀刷新边界

这里追踪 **一个本地压缩协调入口 `compress_context(...)`**，统计的是运行中协调摘要与提交的函数。`ContextCompressor.compress(...)` 是其调用的可替换内容处理引擎，不再算同一层的第二个协调入口；消息列表与预算是数据，SQLite 会话设施承担持久状态。CLI、网关及原生提供商压缩的全部入口不在本节统计范围。[本地：协调入口](../../hermes-agent/agent/conversation_compression.py#L4045) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4045-L4079) [本地：选定引擎与参数](../../hermes-agent/agent/conversation_compression.py#L2927) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L2927-L2945)

```text
主模型请求前 / 工具结果之后检查上下文压力
→ 阈值、冷却期、重试预算等门槛
→ 本地压缩协调入口
→ 内容引擎裁剪旧工具输出、选择中间区、生成或回退摘要
→ 组装受保护头部、摘要与近期尾部，处理工具配对
→ 协调器补充当前任务等材料，重建系统前缀
→ 尝试提交会话压缩结果
→ 后续请求使用返回的消息与系统前缀
```

### 1. “超过百分比”不是完整触发规则

**实现事实 H1：** 阈值从可用输入窗口计算，先减去配置的输出预留，再应用比例和下限，并处理小窗口无法触发的情况；之后还可受绝对 token 上限和辅助摘要模型窗口约束。`should_compress` 不只检查 `tokens >= threshold_tokens`，也检查自动压缩阻塞状态。主请求前还受启用开关、尝试预算、估计延迟与冷却期等门槛限制；工具结果后的调用又区别真实 usage 锚点、无 usage 和刚压缩完尚未获得新实测值。[本地：阈值推导与限制](../../hermes-agent/agent/context_compressor.py#L2749) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L2749-L2807) [本地：阈值加阻塞判断](../../hermes-agent/agent/context_compressor.py#L3000) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L3000-L3013) [本地：请求前门槛](../../hermes-agent/agent/turn_preflight.py#L85) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/turn_preflight.py#L85-L102) [本地：工具后压力来源与调用](../../hermes-agent/agent/turn_preflight.py#L280) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/turn_preflight.py#L280-L317)

**设计推断：** 比较 Pi 与 Hermes 的压缩时机，不能只抄两个百分比。必须先确认预算是否扣除了输出、token 数来自提供商还是估计、是否刚被压缩、失败冷却是否阻止本轮处理。

### 2. 保护近期并不意味着近期工具正文永远不变

**实现事实 H2：** 本地引擎先在副本中裁剪旧工具结果，再按裁剪后的内容选择压缩区；lean 路径还可把近期尾部内的陈旧工具正文降为简短恢复提示。组装由头部、摘要、尾部构成，最后处理孤立工具配对并重述未完成用户任务。这不等于“保留尾部中的所有原字节”。[本地：裁剪、选区和生成顺序](../../hermes-agent/agent/context_compressor.py#L5561) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L5561-L5636) [本地：组装](../../hermes-agent/agent/context_compressor.py#L5638) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L5638-L5667) [本地：工具配对与任务重述](../../hermes-agent/agent/context_compressor.py#L5468) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L5468-L5479)

引擎通常把最新真实用户输入作为尾部锚点；但当一个仍在进行的纯文字回合本身超出软预算、并满足源码中的其他条件时，可以在完整工具组边界切开它，以便继续回收空间。另有确定性历史任务快照从实际用户消息提取，并明确标注“更新的尾部消息优先”；它仍有长度限制，不能当作所有旧约束的无损副本。[本地：用户锚点及超大回合例外](../../hermes-agent/agent/context_compressor.py#L5101) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L5101-L5143) [本地：历史任务快照](../../hermes-agent/agent/context_compressor.py#L4439) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L4439-L4464) [本地：摘要调用后应用该快照](../../hermes-agent/agent/context_compressor.py#L4001) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/context_compressor.py#L4001-L4013)

**设计推断：** 这提供了一个不同于“全交给摘要模型”的方向：宿主可以确定性搬运当前任务、明确新旧优先级，同时把庞大工具观察交给有损整理。它提高的是指定信息路径的可检查程度，不能由此直接推导实际指令遵循率。

### 3. 普通在线压缩会刷新系统前缀，后台代理有例外

**实现事实 H3：** 普通在线路径在候选结果准备提交时，重建系统前缀：先清缓存、重读记忆文件，再尝试刷新工具定义，重新构造提示词。新旧字节一致时复用原对象；发生变化时采用新前缀。随后协调器把新前缀交给压缩提交。这一调用顺序说明压缩不只是减少消息条数，也可能让长期会话读到此前未刷新的记忆与工具说明。[本地：提交前调用刷新](../../hermes-agent/agent/conversation_compression.py#L4252) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4252-L4265) [本地：实际重建](../../hermes-agent/agent/conversation_compression.py#L3094) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L3094-L3125) [本地：重读记忆](../../hermes-agent/agent/system_prompt.py#L808) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/system_prompt.py#L808-L826)

但 `_retain_seeded_system_prompt=True` 的后台压缩代理保留已注入的前缀，跳过这次工具定义刷新，避免后台缩减工具集覆盖在线会话。因此这里只能说普通在线路径在明确边界重建，不能说每次压缩必定重载所有记忆。这个例外已在前面的 Hermes 记忆研究确认，此处只用于解释压缩边界。[本地：保留已注入前缀的例外](../../hermes-agent/agent/conversation_compression.py#L3081) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L3081-L3093)

## 三、一个已经执行的无模型检查：截断发生在哪里

本次实际执行了下列最小探针。它调用 **固定快照中的真实 `serializeConversation`**，没有手写同等逻辑冒充 Pi。该文件只有一个运行时包导入：`contentText`；Pi 的包入口本身也从 `packages/ai/src/utils/text.ts` 导出该函数。探针仅把该包导入转向其真实源文件，使用 Node 的 TypeScript 类型剥离，避免加载整个模型 SDK。没有模拟函数，也没有安装第三方依赖。[本地：序列化器导入](../../pi/packages/coding-agent/src/core/compaction/utils.ts#L5) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/compaction/utils.ts#L5-L6) [本地：SDK 原导出](../../pi/packages/ai/src/index.ts#L43) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/ai/src/index.ts#L43) [本地：真实文字提取函数](../../pi/packages/ai/src/utils/text.ts#L1) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/ai/src/utils/text.ts#L1-L12)

最初的本地探针使用 Node v26.4.0，把唯一标记放在工具结果的 2,200 个填充字符之后：输入包含标记，实际序列化输出不包含。

正式实验进一步保存为 [Pi 摘要输入脚本](../../experiments/pi_summary_input.mjs)，运行四个场景，对照工具结果头部、工具结果尾部、用户消息尾部，以及两条各自较短的工具结果。完整输入输出、导入方式、脚本与两个源文件的 SHA-256 保存在 [四场景记录](../../experiments/results/pi-summary-input.json)；[实验目录](../../experiments/README.md#摘要模型读取前的裁剪) 提供复现命令。

尾部标记只在超出单条工具结果裁剪范围时消失；放在头部、用户消息尾部，或两条各自较短结果的尾部，都能进入序列化材料。这与逐条工具结果裁剪的实现一致，不能概括为所有消息共用 2,000 字符上限。

实验没有运行完整 AgentSession、生成摘要或测量实际任务完成情况，因此只能说明信息在摘要之前的这一条丢失路径，不能证明真实任务一定遗忘该事实。

## 四、下一步怎样检验“压缩后还能继续”

除已运行的四个序列化输入场景外，下列完整会话与模型观察仍待执行。

1. **材料覆盖。** 在已运行的头尾标记检查基础上，继续比较原条目、待总结消息与完整摘要请求，定位切点、序列化和请求组装各自移除了什么。
2. **调用配对。** 构造助手并发工具调用及对应结果，让预算落在工具组内部；调用真实准备函数和投影函数，检查保留区内每个结果仍能找到请求。另把损坏输入作为单独用例，避免把切点规则误当修复器。
3. **关键约束的路径。** 同一条“不要修改生产”分别放在 system、近期 user、被切开回合的起点及旧历史。用固定摘要响应记录最终请求中出现的是原文、模拟摘要还是完全缺失。这能测搬运边界，不能测真实摘要模型有没有正确记住约束。
4. **失败阶段。** 模拟摘要 `length`、意外工具调用、取消信号、追加后的扩展抛错；同时记录 compaction 数量、context_edit 数量、有效投影与 JSONL，区分提交前拒绝和提交后报错。
5. **原文回查。** 在临时会话中记录长工具结果，压缩后分别从有效上下文、`getEntries()` 和真实 JSONL 查找尾部标记；最后显式读取所需片段并注入下一轮。这检验可恢复路径，不能证明 Agent 会主动知道何时回查。
6. **Hermes 前缀。** 分别走普通在线代理与保留已注入前缀的后台代理，用假记忆存储与固定内容引擎记录重载次数、前缀字节和返回消息。把“减少多少消息”与“是否刷新工具/记忆”作为两组断言。

确定性检查能核对结构、搬运、提交与可追溯性。要评价摘要质量，仍需固定任务和模型，分别测事实保留、最新指令优先级、对否定约束的遵守、错误摘要的纠正及多次压缩后的漂移；只测压缩率无法回答这些问题。

## 从信息路径理解设计取舍

- **核心问题：** 摘要变短之后，Agent 是保住了继续工作的依据，还是只保住了一个听起来连贯的故事？
- **最有解释力的分界：** 原始记录还在、摘要模型看到过、摘要产物保存了、下一轮模型能看到、执行器据此行动，是五个不同判断。
- **两个可落地的对照：** Pi 尽量维护工具组与近期窗口，但允许把当前回合的起始请求转成摘要；Hermes 在本地引擎中再增加任务锚点和尾部正文降级，并把普通在线压缩用作前缀刷新边界。这里比较信息路径与责任，不比较产品总体效果。
- **应保留的反例：** 长工具结果尾部的事实可能在摘要前已经被截掉；报告压缩失败可能发生在条目追加之后；原文留盘不会自动触发回查。
- **未覆盖：** 未做真实模型保真评测、未跑上游测试、未验证全部扩展策略与各模型协议组合；Hermes 的 durable lock、commit fence、归档事务和原生压缩仅定位相关代码，未完成端到端故障审计，不能写成已验证的事务保证。
