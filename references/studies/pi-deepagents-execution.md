# Pi 与 Deep Agents：执行边界、默认组装和状态隔离

> 研究日期：2026-10-17\
> 方法：阅读固定版本的一手源码与上游测试，未调用模型 API，未安装依赖，未运行上游测试。文中的“上游测试”表示仓库现有测试明确表达了该行为，不表示本次运行通过。\
> 版本：Pi `8efd314fa3d3232ce197d8d7a6a5660530b9d83e`；Deep Agents `e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27`，与主仓库 `SOURCES.json` 一致。\
> 本地链接按本记录最终位于主工作区 `references/studies/` 编写，指向主工作区只读子模块；隔离工作树未初始化子模块时，须在主工作区解析。

## 研究问题

模型说“我要调用工具”，运行系统究竟做了什么？用户在工具执行时补一句“先等等”，这句话能否阻止已经排好的动作？所谓“子 Agent 隔离”，究竟隔离了哪些东西？一个框架写着支持 memory 和 skills，是否意味着默认就有跨会话记忆？

这里比较两个不同层次：Pi 的核心执行循环与它的编程会话包装，Deep Agents 的 Python Agent 组装工厂。以下事实只能描述这两个固定版本及所指出的作用域，不能直接推导模型效果、任务成功率或产品之间的总体优劣。

## 一、Pi：让模型建议的动作经过一条确定的执行管线

### 1. 真正入口、参与者和完整调用过程

在本节考察的有状态核心对象上，**触发一次模型执行有两个入口：`Agent.prompt(...)` 与 `Agent.continue()`**；这里统计开始或恢复执行的方法，不把 `steer`、`followUp` 两个入队方法算成新的执行器。底层另有流式包装 `agentLoop` / `agentLoopContinue`，最终进入同一个 `runLoop`。对象关系是：

- 调用者提交文字或消息；`Agent` 持有会话消息、可用工具、活动执行和两种待处理消息队列。
- 核心循环决定何时请求模型、何时执行工具、何时把结果放回上下文、何时结束。
- 模型流函数负责实际模型请求；它不是工具执行器。
- 工具对象持有参数模式和 `execute`，真正改变外部世界的是工具实现。
- 调用前后钩子属于宿主扩展，可检查调用、阻止执行或改写结果；消息、参数和结果都是数据对象，不是额外入口。 [本地 182–188 行](../../pi/packages/agent/src/agent.ts#L182) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L182-L188) [本地 370–458 行](../../pi/packages/agent/src/agent.ts#L370) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L370-L458) [本地 38–150 行](../../pi/packages/agent/src/agent-loop.ts#L38) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L38-L150)

正常调用的顺序是：

```text
调用者 prompt
→ Agent 复制消息与工具快照，建立本次活动执行
→ runAgentLoop 合并新消息，发送生命周期事件
→ 循环读取已排队的 steering
→ prepareRequest（可更新本轮上下文、模型等）
→ transformContext → convertToLlm → normalizeContext
→ 模型流函数产生完整 assistant 消息
→ 检查停止原因；取出其中的工具调用
→ 工具准备与校验 → 调用前检查 → 执行 → 调用后处理
→ 每个工具结果变成 toolResult 消息，进入下一轮上下文
→ finishTurn → 读取 steering → 必要时继续
→ 本来要停止时再读取 follow-up
→ 无需继续时 agent_end
```

其中 `transformContext` 处理的是应用消息，`convertToLlm` 随后把它们转成模型协议认识的消息；转换并不是在每个工具内部发生。[本地 432–505 行](../../pi/packages/agent/src/agent.ts#L432) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L432-L505) [本地 102–125 行](../../pi/packages/agent/src/agent-loop.ts#L102) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L102-L125) [本地 175–242 行](../../pi/packages/agent/src/agent-loop.ts#L175) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L175-L242) [本地 258–320 行](../../pi/packages/agent/src/agent-loop.ts#L258) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L258-L320) [本地 388–407 行](../../pi/packages/agent/src/agent-loop.ts#L388) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L388-L407)

### 2. “继续”不是无条件让模型再想一次

**事实 P1：** 核心 `continue()` 拒绝空会话、只有 system 消息的会话、以及没有待处理消息的 assistant 尾部。若尾部是 assistant，但有 steering 或 follow-up，`Agent` 优先取 steering，再取 follow-up，转成新 prompt 运行；通常的 user/toolResult 尾部则走 continuation。底层 continuation 本身拒绝 assistant 尾部。[本地 383–411 行](../../pi/packages/agent/src/agent.ts#L383) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L383-L411) [本地 128–150 行](../../pi/packages/agent/src/agent-loop.ts#L128) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L128-L150)

**设计推断：** `continue` 的语义包含“让协议有效的会话再次进入执行”，不是一个可随时调用的“多想一步”按钮。宿主要续跑已完成回答，应提供新的输入或明确的回合继续策略。

### 3. 参数有效、获得授权、执行成功，是三个不同判断

**事实 P2：** 工具准备先按名称查找工具，然后调用可选 `prepareArguments`，再做模式校验，校验通过后才运行 `beforeToolCall`。调用前钩子可以阻止工具，并返回原因；未找到工具、参数处理/校验失败或钩子抛错都会变成错误结果，不直接执行工具。[本地 694–777 行](../../pi/packages/agent/src/agent-loop.ts#L694) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L694-L777)

**事实 P3：** 校验器复制原始参数，处理可选字段的 null、类型转换和 JSON Schema 的兼容转换，然后检查模式；校验失败时错误文本带有路径和收到的原始参数。不能据此声称它证明了命令安全、文件正确或业务上获得授权。[本地 317–352 行](../../pi/packages/ai/src/utils/validation.ts#L317) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/ai/src/utils/validation.ts#L317-L352)

**事实 P4：** `beforeToolCall` 收到的是校验后的参数对象；钩子就地修改它后，核心循环不会重新校验，而是将同一对象交给工具。这不是推测：源码没有第二次校验，上游测试故意把原本要求字符串的值改成数字，并断言工具收到数字。[本地 725–769 行](../../pi/packages/agent/src/agent-loop.ts#L725) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L725-L769) [本地 831–844 行](../../pi/packages/agent/src/agent-loop.ts#L831) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L831-L844) [本地 528–586 行](../../pi/packages/agent/test/agent-loop.test.ts#L528) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/test/agent-loop.test.ts#L528-L586)

**设计推断：** 参数模式保护的是进入扩展钩子之前的边界。宿主钩子属于可信运行代码的一部分；若钩子修改参数，它必须承担修改之后的合法性与授权责任。把“有 JSON Schema”直接写成“工具调用安全”会掩盖这个责任转移。

### 4. 错误怎样进入模型的观察

**事实 P5：** 工具 `execute` 抛出的错误会被核心转换成文本错误结果；工具也可以正常返回并设置 `isError: true`。执行后钩子可以改写内容、错误标记及终止提示；执行后钩子抛错同样转换成错误结果。准备阶段直接拒绝的调用不会进入执行后钩子。[本地 725–777 行](../../pi/packages/agent/src/agent-loop.ts#L725) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L725-L777) [本地 821–909 行](../../pi/packages/agent/src/agent-loop.ts#L821) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L821-L909)

**事实 P6：** 错误最终和成功一样，成为带有 `toolCallId`、工具名称、内容与 `isError` 的 `toolResult` 消息；核心循环把结果追加回上下文，然后通常再次调用模型。这里是运行系统把错误变成模型可读的观察，不是模型自行发现程序抛出了异常。[本地 258–277 行](../../pi/packages/agent/src/agent-loop.ts#L258) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L258-L277) [本地 930–948 行](../../pi/packages/agent/src/agent-loop.ts#L930) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L930-L948)

**事实 P7：** 输出因 token 上限截断时，只要消息中有工具调用，核心会让这一批调用全部失败，明确说明参数可能被截断，**即便某个调用的残缺参数碰巧能够解析和通过模式校验，也不执行它**。错误结果仍交给模型重发。[本地 264–270 行](../../pi/packages/agent/src/agent-loop.ts#L264) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L264-L270) [本地 471–502 行](../../pi/packages/agent/src/agent-loop.ts#L471) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L471-L502)

**事实 P8：** 模型响应本身的 `error` 或 `aborted` 是硬退出：循环先调用 `finishTurn` 并发送结束事件，随后返回；普通工具错误则通常进入下一轮。这两个错误层次不能合并为“所有失败都会自动重试”。[本地 241–255 行](../../pi/packages/agent/src/agent-loop.ts#L241) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L241-L255)

**事实 P9：** 单个结果的 `terminate: true` 不足以结束整个工具批次后的自然续跑；只有该批已完成结果非空且**全部**携带该提示，批次才标记终止。另有 `finishTurn` 回调可明确结束或要求下一轮。[本地 280–314 行](../../pi/packages/agent/src/agent-loop.ts#L280) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L280-L314) [本地 690–692 行](../../pi/packages/agent/src/agent-loop.ts#L690) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L690-L692)

**设计推断：** “错误作为观察”给模型纠错机会，但不证明模型会正确纠错，也不提供补偿事务或幂等性。尤其工具已产生副作用后再失败，运行系统没有在上述通用管线中自动撤销副作用。

### 5. 并发是批次策略，不能只看工具名称

**事实 P10：** 有状态 `Agent` 的工具执行策略默认是 `parallel`。但同一条 assistant 消息里，只要有任一已注册工具标记 `executionMode: "sequential"`，整个批次就改为顺序执行；显式全局 sequential 也会如此。不是只把被标记的那一个工具单独串行。[本地 230–254 行](../../pi/packages/agent/src/agent.ts#L230) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L230-L254) [本地 508–523 行](../../pi/packages/agent/src/agent-loop.ts#L508) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L508-L523)

**事实 P11：** 并行模式中，核心先按工具调用顺序逐个准备参数并等待调用前钩子，之后才用 `Promise.all` 启动已经准备好的执行。工具完成事件可按完成先后出现，但形成的工具结果消息按原调用顺序输出。调用前检查因此不是与工具执行一起无序并发的。[本地 586–659 行](../../pi/packages/agent/src/agent-loop.ts#L586) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L586-L659)

**事实 P12：** Pi 编程工具中的 `write` 与 `edit` 另外使用按规范路径划分的文件修改队列：同一个文件的修改串行，其他文件仍可并发。已有路径用 realpath 作为键，不存在路径退回绝对路径。这是工具层的资源保护，不能推广为所有扩展工具、shell 命令都有同一把锁。[本地 58–77 行](../../pi/packages/coding-agent/src/core/tools/write.ts#L58) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/write.ts#L58-L77) [本地 159–170 行](../../pi/packages/coding-agent/src/core/tools/edit.ts#L159) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/edit.ts#L159-L170) [本地 16–60 行](../../pi/packages/coding-agent/src/core/tools/file-mutation-queue.ts#L16) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/file-mutation-queue.ts#L16-L60)

**设计推断：** “这个系统并行执行工具”和“这个系统保护同一文件的写入”可以同时成立。书中需要分别画出批次调度和资源同步两层，避免把并行/串行写成一个产品级布尔属性。

### 6. 用户的新指令什么时候生效

**事实 P13：** `steer` 只把消息放进队列；`followUp` 也只入队。两个队列默认每次取一条，也可以配置为一次取全部；`abort()` 是另一个明确的取消操作。[本地 143–173 行](../../pi/packages/agent/src/agent.ts#L143) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L143-L173) [本地 247–253 行](../../pi/packages/agent/src/agent.ts#L247) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L247-L253) [本地 298–343 行](../../pi/packages/agent/src/agent.ts#L298) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent.ts#L298-L343)

**事实 P14：** 核心在启动时读取 steering；一次 assistant 响应及其整批工具执行、`finishTurn` 和 `turn_end` 完成后，再读取 steering；下一轮准备可能较长，若之前没读到消息，准备后还会再读一次。**当前实现不在同批的两个顺序工具之间读取 steering**。现有测试明确要求两个工具都执行之后才出现排队的用户消息。[本地 175–217 行](../../pi/packages/agent/src/agent-loop.ts#L175) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L175-L217) [本地 258–299 行](../../pi/packages/agent/src/agent-loop.ts#L258) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L258-L299) [本地 791–863 行](../../pi/packages/agent/test/agent-loop.test.ts#L791) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/test/agent-loop.test.ts#L791-L863)

**事实 P15：** follow-up 只在没有自然工具续跑、也没有 steering 等待的内循环结束后读取。它的产品语义是“做完当前工作之后再做这件事”，steering 则是“在下一个模型决策边界修正方向”；两者都不是撤销已经完成动作的接口。[本地 294–317 行](../../pi/packages/agent/src/agent-loop.ts#L294) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L294-L317)

**事实 P16：** 上层 `AgentSession.prompt` 在运行中需要调用者明确指定 streamingBehavior，随后将内容放入对应队列；但扩展斜杠命令在排队之前会尝试立即执行。这说明“普通用户文字何时进入模型”和“宿主扩展命令何时执行”是两个边界。上层会话还会在下一轮刷新时做压缩和工具/提示词更新，这些属于编程会话包装，不能自动归给裸核心循环。[本地 2058–2115 行](../../pi/packages/coding-agent/src/core/agent-session.ts#L2058) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2058-L2115) [本地 2241–2279 行](../../pi/packages/coding-agent/src/core/agent-session.ts#L2241) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L2241-L2279) [本地 899–932 行](../../pi/packages/coding-agent/src/core/agent-session.ts#L899) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L899-L932)

**情境推演（未运行）：** 模型一次要求先发邮件 A、再发邮件 B；两个工具按 sequential 执行。用户在 A 发送时输入“不要发 B”。若宿主仅调用 `steer`，本版核心会先完成这批工具才注入文字，所以不能保证阻止 B。若产品要提供“停止当前动作”，需要宿主接入显式 abort、工具对取消信号的配合，以及下一批执行前的授权检查。这是从上述调度顺序推出的产品约束，不是本次的邮件实验结果。

### 7. 会话原文、有效上下文与模型请求，是三份不同的东西

**事实 P17：** 上层 SessionManager 以追加条目形成带 id/parentId 的会话树，可持久化为 JSONL；用户/助手/工具的完成消息由会话事件处理器追加进去。buildSessionProjection 沿当前 leaf 的祖先链生成有效上下文，应用最新 compaction 的摘要与保留范围，再应用 context_edit 指定的替换或省略。context_edit 自己也是新追加的条目，不需要覆盖原消息。有效上下文可以不含旧全文，原条目仍存在于会话历史。[本地 390–415 行](../../pi/packages/coding-agent/src/core/session-manager.ts#L390) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L390-L415) [本地 468–582 行](../../pi/packages/coding-agent/src/core/session-manager.ts#L468) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L468-L582) [本地 977–985 行](../../pi/packages/coding-agent/src/core/session-manager.ts#L977) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L977-L985) [本地 1360–1397 行](../../pi/packages/coding-agent/src/core/session-manager.ts#L1360) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/session-manager.ts#L1360-L1397) [本地 1147–1169 行](../../pi/packages/coding-agent/src/core/agent-session.ts#L1147) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L1147-L1169)

**事实 P18：** AgentSession 在请求准备时从 SessionManager 重新构建 canonicalContext，模型前的压缩也返回新投影；刷新公开状态时，agent.state.messages 会被设为投影消息。因此“当前 state.messages”“磁盘上的原始会话树”和“下一次模型实际收到的消息”不能当作同义词。最后一层还要经过 transformContext、convertToLlm 和模型协议规范化。[本地 777–810 行](../../pi/packages/coding-agent/src/core/agent-session.ts#L777) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L777-L810) [本地 939–945 行](../../pi/packages/coding-agent/src/core/agent-session.ts#L939) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/agent-session.ts#L939-L945) [本地 388–407 行](../../pi/packages/agent/src/agent-loop.ts#L388) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L388-L407)

```text
SessionManager 会话条目树（可追溯原文与编辑记录）
→ 选择当前分支
→ 应用压缩摘要、保留范围和 context_edit
→ 得到运行时投影
→ SDK 扩展的请求时上下文变换
→ convertToLlm 转成模型支持的角色和内容
→ normalizeContext
→ 本次模型请求
```

**事实 P19：** 标准 SDK 的扩展上下文变换先 structuredClone 输入，然后运行 context / context_with_system 两阶段处理。前一阶段只让扩展看到对话，随后恢复 system 消息；后一阶段可以处理完整消息。因此扩展对这份克隆的普通改写不直接覆盖原会话条目。这个保证来自上层扩展运行器，**裸核心 transformContext 只把当前消息交给回调，本身没有强制深拷贝**；调用者仍可写出修改输入的回调。[本地 1301–1332 行](../../pi/packages/coding-agent/src/core/extensions/runner.ts#L1301) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/extensions/runner.ts#L1301-L1332) [本地 1336–1365 行](../../pi/packages/coding-agent/src/core/extensions/runner.ts#L1336) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/extensions/runner.ts#L1336-L1365) [本地 388–397 行](../../pi/packages/agent/src/agent-loop.ts#L388) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/agent/src/agent-loop.ts#L388-L397)

**事实 P20：** convertToLlm 还会改变消息的模型可见身份：被标记 excludeFromContext 的 bashExecution 被省略，其他 bashExecution、custom、分支摘要与压缩摘要转换成 user 消息，常规角色则保留。这进一步说明“存下来了”不意味着“以原样、原角色进入每一轮模型上下文”。[本地 148–195 行](../../pi/packages/coding-agent/src/core/messages.ts#L148) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/messages.ts#L148-L195)

**设计推断：** 对话历史更像可追溯账本，有效上下文是按当前任务重建的阅读视图，模型请求则是该视图在协议边界上的表达。压缩与筛选改变的是模型此刻可见的信息；它们不能自动等同于“永久删除原始历史”或“已经形成跨会话长期记忆”。


## 二、Deep Agents：构造器替调用者预先选择了哪些运行机制

### 1. 真正入口、对象职责与组装链

本节统计 **一个 Agent 构造入口：`create_deep_agent(...)`**。它返回可运行的 LangGraph 图；调用者再通过返回对象的 `invoke` / `ainvoke` / 流式接口提交消息。`SubAgent` 声明、消息字典、模型请求对象、backend 和 checkpointer 都不计为额外的 Agent 构造入口。本记录追踪的是这个工厂的默认组装，不声称这是项目所有对外 API。[本地 278–298 行](../../deepagents/libs/deepagents/deepagents/graph.py#L278) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L278-L298) [本地 995–1017 行](../../deepagents/libs/deepagents/deepagents/graph.py#L995) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L995-L1017)

调用者选择模型、附加工具、可选 memory/skills 路径和 backend。工厂先解析模型与 harness profile（针对模型的运行配置），创建默认 backend，构建子 Agent 规格，组装主 Agent middleware（介入模型或工具执行前后的中间层），再把它们交给 LangChain 的 `create_agent`。LangChain/LangGraph 承担后续图执行；Deep Agents 在这里主要规定默认能力组合。[本地 615–678 行](../../deepagents/libs/deepagents/deepagents/graph.py#L615) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L615-L678) [本地 686–731 行](../../deepagents/libs/deepagents/deepagents/graph.py#L686) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L686-L731) [本地 893–1017 行](../../deepagents/libs/deepagents/deepagents/graph.py#L893) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L893-L1017)

backend 是文件操作的业务适配接口：运行机制调用它读写文件，具体实现决定文件落在图状态、磁盘或其他存储中。checkpointer 是图状态检查点的支持设施，store 是另一个显式传入的存储设施；它们不是 memory 文件列表的别名。状态和消息是数据，middleware 是运行策略，backend 才把文件操作接到实际存储。[本地 278–298 行](../../deepagents/libs/deepagents/deepagents/graph.py#L278) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L278-L298) [本地 658–658 行](../../deepagents/libs/deepagents/deepagents/graph.py#L658) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L658-L658) [本地 995–1007 行](../../deepagents/libs/deepagents/deepagents/graph.py#L995) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L995-L1007) [本地 38–119 行](../../deepagents/libs/deepagents/deepagents/backends/state.py#L38) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/backends/state.py#L38-L119)

最小关系示意如下；示意没有运行，也没有为它配置持久化：

```python
agent = create_deep_agent(
    model=chosen_model,          # 调用者提供的模型实例
    tools=[business_tool],       # 在内置工具之外追加业务能力
    memory=["/AGENTS.md"],       # 明确指定才装配 memory 中间层
    skills=["/skills/"],         # 明确指定才装配 skills 中间层
)
result = agent.invoke({"messages": [{"role": "user", "content": "分析问题"}]})
```

这里的路径由 backend 解释，默认不是读取当前机器任意同名路径的承诺。默认 `StateBackend` 从图执行上下文中的 `files` 状态通道读取数据，图外直接读写会报错；要预填文件，可以把 `files` 与消息一起作为调用输入。[本地 57–119 行](../../deepagents/libs/deepagents/deepagents/backends/state.py#L57) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/backends/state.py#L57-L119)

### 2. 默认能力不等于宣传功能全集

**事实 D1：** 未指定 backend 时，工厂使用 `StateBackend()`。它读取本次图上下文的 `files` 通道，写入通过图通道排队；同一 backend 对象会根据当前执行上下文找到相应状态。不能把“主子 Agent 用同一个 backend 对象”直接解释成“共用一个可变消息列表”。[本地 658–658 行](../../deepagents/libs/deepagents/deepagents/graph.py#L658) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L658-L658) [本地 57–119 行](../../deepagents/libs/deepagents/deepagents/backends/state.py#L57) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/backends/state.py#L57-L119)

**事实 D2：** 在没有额外 profile 覆盖、没有用户中间层替换的基线下，主 Agent 的核心装配顺序为文件系统、子 Agent（存在时）、父任务通知、摘要、悬空工具调用修补；之后追加模型 profile 中间层、可选 skills、提示词缓存、可选 memory、按需人工中断、内容兼容处理。这个列表说明装配顺序，不等于每种钩子的执行顺序都从左到右；不同 before/after/wrap 钩子的实际调用次序属于 LangChain 的执行语义。[本地 893–975 行](../../deepagents/libs/deepagents/deepagents/graph.py#L893) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L893-L975)

**事实 D3：** memory 参数默认 None，只有非 None 时才追加 `MemoryMiddleware`；skills 同理。但调用者自己传入的、名称为 SkillsMiddleware 的实例，其 sources 可以被工厂提升到 skills 参数，让它占默认位置并传给通用子 Agent。空列表与 None 在本层判断中也不完全相同，不能简单写成“truthy 才启用”。[本地 278–289 行](../../deepagents/libs/deepagents/deepagents/graph.py#L278) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L278-L289) [本地 680–684 行](../../deepagents/libs/deepagents/deepagents/graph.py#L680) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L680-L684) [本地 935–951 行](../../deepagents/libs/deepagents/deepagents/graph.py#L935) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L935-L951)

**事实 D4：** 本版通用默认栈没有 `TodoListMiddleware`。`write_todos` 可以由模型 profile 的额外中间层加入，例如 OpenAI Codex profile 明确注释 SDK 不再默认提供它，并为每个栈创建新实例。因此“Deep Agents 默认就是一个带 TODO 规划器的 Agent”不符合这一版本的通用构造事实；特定 profile 仍可有规划工具。[本地 893–958 行](../../deepagents/libs/deepagents/deepagents/graph.py#L893) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L893-L958) [本地 69–88 行](../../deepagents/libs/deepagents/deepagents/profiles/harness/_openai_codex.py#L69) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/profiles/harness/_openai_codex.py#L69-L88)

**事实 D5：** 文件系统中间层内部创建 ls/read_file/write_file/edit_file/delete/glob/grep/execute 工具，但在模型请求前按 backend 能力过滤 execute/delete。默认 StateBackend 有 delete 实现而没有 shell 执行能力，因此不能根据工厂文档中的旧工具清单写成“开箱即可执行系统命令”，也不能遗漏本版的 delete 能力。即使调用绕过模型可见工具过滤，execute 工具自身还有能力检查并返回错误。[本地 2020–2033 行](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L2020) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L2020-L2033) [本地 3027–3051 行](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3027) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3027-L3051) [本地 3140–3184 行](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3140) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3140-L3184) [本地 3348–3352 行](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3348) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3348-L3352) [本地 251–275 行](../../deepagents/libs/deepagents/deepagents/backends/state.py#L251) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/backends/state.py#L251-L275)

**事实 D6：** 附加 `tools=` 不会替换默认工具；自定义中间层按名称替换默认同名位置，新增中间层插在核心栈之后、profile/缓存/memory 尾部之前；profile 另可过滤工具和部分中间层。默认与可配置不是同一个判断维度。[本地 211–245 行](../../deepagents/libs/deepagents/deepagents/graph.py#L211) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L211-L245) [本地 341–351 行](../../deepagents/libs/deepagents/deepagents/graph.py#L341) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L341-L351) [本地 959–975 行](../../deepagents/libs/deepagents/deepagents/graph.py#L959) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L959-L975)

**事实 D7：** 主工厂把 `checkpointer` 和 `store` 原样交给底层，两者的默认参数均是 None。默认文件位于图状态，不等于默认配置了跨进程恢复或跨线程共享记忆。StateBackend 的持久化范围仍取决于调用者怎样运行和保存图状态。[本地 278–298 行](../../deepagents/libs/deepagents/deepagents/graph.py#L278) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L278-L298) [本地 995–1007 行](../../deepagents/libs/deepagents/deepagents/graph.py#L995) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L995-L1007) [本地 38–47 行](../../deepagents/libs/deepagents/deepagents/backends/state.py#L38) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/backends/state.py#L38-L47)

### 3. Memory 与 Skills 分别把什么放进上下文

**事实 D8：** memory 中间层在 before_agent 时读取指定文件，解码并写入 `memory_contents`；状态已有这个键就不重新读取。不存在的文件跳过，其他下载错误会抛出。每次模型请求再把这些已加载内容拼到 system message。这个路径不是检索器，也没有在该读取管线中自动生成“学到的新知识”；模板对模型提出如何用文件工具更新记忆的指示，与运行程序自动抽取记忆是两回事。[本地 279–383 行](../../deepagents/libs/deepagents/deepagents/middleware/memory.py#L279) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/memory.py#L279-L383)

**事实 D9：** skills 中间层先读取和缓存技能元数据，按 source 顺序合并，同名后者覆盖前者；已有列表（即使空列表）则跳过加载，None 表示请求重新加载。随后向系统提示词展示索引；常规按需路径由模型用 `read_file` 读取完整 SKILL.md。它也支持 pinned_skills 在模型前把完整正文作为消息加入，所以不能把“渐进披露”误写成“程序永远不会主动装载全文”。[本地 879–909 行](../../deepagents/libs/deepagents/deepagents/middleware/skills.py#L879) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/skills.py#L879-L909) [本地 1150–1212 行](../../deepagents/libs/deepagents/deepagents/middleware/skills.py#L1150) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/skills.py#L1150-L1212) [本地 1260–1280 行](../../deepagents/libs/deepagents/deepagents/middleware/skills.py#L1260) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/skills.py#L1260-L1280)

**设计推断：** memory 这里更接近“事先指定、持续放入系统上下文的文件内容”，skills 更接近“先展示索引，再按任务获取详细操作说明”。两者都依赖 backend，但名称本身不承诺长期保存、内容正确或授权边界。

### 4. 子 Agent：默认隔离的是对话，不是所有工作产物

**事实 D10：** 未被 profile 禁用、也没有同名自定义覆盖时，工厂自动加入 general-purpose 子 Agent。它使用主模型和附加工具、同一 backend、自己的文件系统/摘要/修补中间层，继承显式 skills 路径和适用的权限/中断设置。它只继承主中间层中恰好覆盖通用子 Agent 默认位置的同名实例，不把所有主中间层无条件复制过去；默认通用子 Agent 栈也不自动追加主 memory。[本地 822–891 行](../../deepagents/libs/deepagents/deepagents/graph.py#L822) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L822-L891)

**事实 D11：** 普通声明式自定义子 Agent 默认继承主模型，未声明 tools 时继承主附加工具；显式声明自己的 tools 时用自己的。它使用同一 backend 并默认继承权限，但 skills 默认来自自己的配置，不能直接声称所有子 Agent 都继承主 skills。其基线也不是主 Agent 的完整栈；例如没有自动再加入一个 SubAgentMiddleware。预编译的子 Agent runnable 则原样使用，不被套上这些默认 middleware。[本地 692–803 行](../../deepagents/libs/deepagents/deepagents/graph.py#L692) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L692-L803) [本地 697–699 行](../../deepagents/libs/deepagents/deepagents/graph.py#L697) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L697-L699) [本地 710–741 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L710) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L710-L741)

**事实 D12：** 默认 isolated 模式建立子调用时，先从父状态滤掉 messages、todos、structured_response、技能相关字段、rubric 和私有字段等，再把消息替换成仅含任务描述的 HumanMessage。**其他未排除状态仍传入子调用**，包括以状态承载的文件数据。子调用完成后，过滤不该返回和未变化的键，将剩余状态更新回传，并把结构化响应或最后一个有文本的 AI 消息转成父 Agent 的一条 ToolMessage。中间推理/工具消息不会整份并回父消息。[本地 404–448 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L404) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L404-L448) [本地 747–787 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L747) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L747-L787) [本地 804–866 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L804) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L804-L866)

**设计推断：** “isolated”在这个执行路径中不是独立安全沙箱，也不是全量状态隔离。它主要收窄消息上下文，同时保留可交换的工作数据；若调用者需要阻止子 Agent 访问某些资料，需要另行设计 backend、工具范围、状态 schema 或权限。反过来，子 Agent 写文件可以成为向父 Agent 交付产物的渠道，不能只追踪它最后一句自然语言。

### 5. Fork 与异步委派是另外的选择

**事实 D13：** 显式 `mode="fork"` 的声明式子 Agent 会继承父 system prompt，再追加自己的补充指令；继承父 skills 与相应 memory，并镜像父自定义中间层。运行时继承更完整的状态，包括私有通道，但排除旧 structured response、待 pin skills、摘要事件等不能直接续用的字段。它会先应用父摘要事件，移除末尾仍带工具调用的 AI 消息，再追加当前任务的人类消息。fork 是实验能力，不是默认子 Agent 语义。[本地 712–743 行](../../deepagents/libs/deepagents/deepagents/graph.py#L712) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L712-L743) [本地 758–812 行](../../deepagents/libs/deepagents/deepagents/graph.py#L758) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L758-L812) [本地 52–76 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L52) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L52-L76) [本地 380–396 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L380) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L380-L396) [本地 813–832 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L813) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L813-L832) [本地 995–996 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L995) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L995-L996)

**事实 D14：** fork 的 task 工具在 schema 上保留，但实际执行看到 fork 上下文标记时会拒绝递归委派。保持相同工具结构与允许无限创建后代是两回事。[本地 688–707 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L688) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L688-L707) [本地 838–844 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L838) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L838-L844) [本地 868–874 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L868) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L868-L874)

**事实 D15：** 常规 `task` / `atask` 内部等待子图 invoke/ainvoke 返回，因此父工具调用的结果在子任务完成后才交付。这不等于多个 task 工具调用之间必定串行；本记录没有追踪底层 ToolNode 调度。显式带 `graph_id` 的配置被分到另一类 async subagent，中间层支持非阻塞的远程 LangSmith 部署；“async 函数调用”和“业务任务非阻塞委派”需要区分。[本地 690–696 行](../../deepagents/libs/deepagents/deepagents/graph.py#L690) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L690-L696) [本地 923–926 行](../../deepagents/libs/deepagents/deepagents/graph.py#L923) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/graph.py#L923-L926) [本地 838–896 行](../../deepagents/libs/deepagents/deepagents/middleware/subagents.py#L838) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/subagents.py#L838-L896)

### 6. 并发冲突与恢复：多一层机制，多一种选择

**事实 D16：** 本版文件系统中间层检查同一条模型响应里的文件修改调用。如果后出现的调用与前面修改命中同一个规范化 file_path，就直接返回 status=error 的工具消息。Pi 对同一文件修改采取排队，Deep Agents 这里采取拒绝后续冲突调用；两种设计都不等于允许有依赖的写操作无序并发。这个检查只覆盖其识别的文件修改工具，不是普遍事务锁。[本地 194–225 行](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L194) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L194-L225) [本地 3821–3873 行](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3821) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3821-L3873) [本地 28–60 行](../../pi/packages/coding-agent/src/core/tools/file-mutation-queue.ts#L28) · [固定源码](https://github.com/earendil-works/pi/blob/8efd314fa3d3232ce197d8d7a6a5660530b9d83e/packages/coding-agent/src/core/tools/file-mutation-queue.ts#L28-L60)

**事实 D17：** 悬空工具修补中间层在下一次 Agent 执行前寻找没有对应 ToolMessage 的调用，为它们补错误结果：有效调用提示“未完成/可能被取消”，参数损坏的调用提示“参数不完整”。**它没有重放工具，也没有证明工具副作用是否发生**；它恢复的是会话协议的一致性。[本地 17–52 行](../../deepagents/libs/deepagents/deepagents/middleware/patch_tool_calls.py#L17) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/patch_tool_calls.py#L17-L52)

**事实 D18：** 默认摘要工厂根据模型 profile 选择阈值：有 max_input_tokens 时使用占比 0.85 触发、保留 0.10；没有该信息时回退到固定 token/消息阈值。它不是单纯调用一个默认空触发器的底层摘要类。工厂还接收 backend 用于对话历史处理；关于摘要的恢复效果与长任务质量，仍需运行实验。[本地 265–300 行](../../deepagents/libs/deepagents/deepagents/middleware/summarization.py#L265) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/summarization.py#L265-L300) [本地 1883–1900 行](../../deepagents/libs/deepagents/deepagents/middleware/summarization.py#L1883) · [固定源码](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/summarization.py#L1883-L1900)

## 三、可直接转化为书中追问的判断

| 读者应该追问什么 | Pi 所见机制 | Deep Agents 所见机制 |
|---|---|---|
| 谁让动作有资格执行？ | 核心参数校验后进入宿主 beforeToolCall，工具自己执行 | 工厂装配工具和中间层，backend 与权限配置影响实际能力 |
| “同时调用”是否等于“同时修改同一资源”？ | 批次可并行，write/edit 有按文件排队 | 文件中间层拒绝同批后续同路径修改 |
| 一句“等等”是否能撤回已排动作？ | steering 在批次结束边界生效；abort 是独立控制 | 本记录未研究运行中输入调度，不能从图可恢复性推导实时取消 |
| 子 Agent 能看到什么？ | 本记录未研究 Pi 扩展子 Agent | isolated 丢弃父消息历史，但仍可传递其他状态；fork 显式继承更多上下文 |
| 支持 memory 是否意味着永久记住？ | 本记录未研究 Pi 长期记忆扩展 | memory 路径显式启用；backend/checkpointer/store 决定不同的保存与共享范围 |

此表是以上事实的整理，不是功能评分。Pi 小核心把策略留在钩子和上层会话里；Deep Agents 工厂预先装配较多运行策略。**设计推断：** 这影响的是“默认由谁承担哪些决策”，不能据此断言哪一个在所有任务中更强、更轻或更可靠。

## 四、待实测事项与建议实验

以下全部是待执行设计，不是已经观察到的结果。可使用 fake model、内存工具、临时文件与模拟时钟，不必调用真实模型 API。

1. **批次内插话：** fake model 一次返回两个有记录副作用的工具；在第一个开始后排入 steering。核对第二个是否执行、下一模型请求何时看到新指令；再分别加入 abort 与全局 sequential，对照“插话”和“停止”。
2. **错误转观察：** 覆盖工具名错误、参数无效、before 拒绝、execute 抛错、after 抛错、length 截断；保存下一轮模型收到的完整消息，观察相同 toolCallId 是否闭合，是否发生意外副作用。
3. **并发与资源：** 在 Pi 同时修改同一路径和不同路径；在 Deep Agents 对同一模型消息发起同路径修改。核对是排队还是返回错误，另测 shell 写文件是否绕过上述文件工具层保护。
4. **对话隔离与文件交付：** 给父状态放一段只在 messages 的秘密、一份 files 文件和一个私有字段，分别使用 isolated / fork / compiled subagent。检查子输入、父返回更新和 checkpoint，不把“只看不到聊天记录”误认为“看不到文件”。
5. **长期保存：** 分别不给 checkpointer、给可持久化 checkpointer、为特定路径路由到持久 backend；跨进程、跨 thread_id、跨用户重启后读取同一 memory 路径，核对保存与隔离边界。
6. **模型 profile 对默认能力的影响：** 使用可控模型 profile，记录最后发给模型的 tools 与 system message，对照默认、Codex profile、自定义同名 middleware、skills=None/[] 与 memory=None/[]。不要仅检查构造参数。

本次验证范围是源码追踪、固定 SHA 核对和引用路径核对；没有运行以上实验，没有运行上游测试，也没有据此作出效果排名。
