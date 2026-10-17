# Hermes 与 OpenClaw：记忆写入成功之后，模型何时真正看见它

> 研究日期：2026-10-17\
> Hermes 固定版本：`e31c674f7c523070f48f3baad0650c2fdd7ef6e5`；OpenClaw 固定版本：`ec38f535d3d5de9e087d834fe58e6190852fcb2a`，与 SOURCES.json 一致。\
> 方法：只静态追踪本地一手源码；未调用模型 API、未安装依赖、未运行上游测试。本文只提炼 12 项实现事实，明确区分程序行为、面向模型的指令和设计推断。\
> 本地链接按最终主目录 `references/studies/` 的位置解析，指向 `../../hermes-agent/` 与 `../../openclaw/`。

## 先认清演员与两条不同的链

用户提供新事实或偏好；模型决定是否调用保存工具、保存哪段内容；存储程序检查参数、长度和写入条件，并把内容写到文件；提示词组装程序或检索程序再决定哪些内容进入下一次模型输入。**写入、检索、注入、采纳是四个不同动作。**

Hermes 的本次研究范围有两个模型可见入口：`memory` 负责修改精选记忆，`session_search` 负责找回会话材料。前者持有的 MemoryStore 是文件适配与状态管理对象，不是另一个模型。模型选择 target 和操作，MemoryStore 执行写盘；系统提示词构造器读取一份冻结快照，会话循环决定何时重建该前缀。具体实现见事实 1–5。

```text
用户事实/偏好
→ 模型调用 memory(target, action / operations)
→ 工具入口检查 → MemoryStore 上锁、重读、校验、写入
→ memories/MEMORY.md 或 USER.md 的持久文件
                     ↓ 普通写入不会改冻结块
AIAgent 的加载时快照 → 缓存系统提示词 → active_system_prompt → 模型请求
                     ↑ live-agent 压缩提交边界会重载并重建
```

OpenClaw 在这里没有一个统一的“读写记忆 API”统管所有动作。日常 Agent 可用文件工具写工作区；bootstrap（运行前加载的基础上下文）挑选可注入文件，memory-core 插件提供 `memory_search` / `memory_get` 与索引，dreaming 则由维护调度触发候选整理及受约束的写回。下文将这几条链分开核对；不把模型被提示“应当记住”当成程序已经写入。具体实现见事实 6–12。

```text
文件写入 → 工作区 USER / MEMORY / 每日日记
             ├→ 下次 bootstrap 解析 → 来源与会话过滤 → 注入预算 → 模型上下文
             └→ 文件观察/同步 → 数据库索引 → memory_search → 工具结果 → 模型上下文

召回/其他合格信号 → 候选排序 → dreaming 维护触发
→ 可选模型选择合并操作 → 宿主验证 → 锁与前像检查 → MEMORY.md
→ 以后再经 bootstrap / 检索进入模型
```

## 事实 1：Hermes 的冻结不是“整个会话永不刷新”

**实现事实：** MemoryStore 初始化从 MEMORY.md / USER.md 读入 live entries，并额外生成 `_system_prompt_snapshot`；之后 `format_for_system_prompt` 只返回这份快照。普通 `_mutate` 修改 live entries 和磁盘，不改快照。系统提示词构造器再把快照拼成记忆块。初始化默认路径来自 profile 对应的 Hermes home。[本地 1322–1340 行](../../hermes-agent/agent/agent_init.py#L1322) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/agent_init.py#L1322-L1340) [本地 221–253 行](../../hermes-agent/tools/memory_tool_store.py#L221) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L221-L253) [本地 338–367 行](../../hermes-agent/tools/memory_tool_store.py#L338) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L338-L367) [本地 618–621 行](../../hermes-agent/tools/memory_tool_store.py#L618) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L618-L621) [本地 516–525 行](../../hermes-agent/agent/system_prompt.py#L516) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/system_prompt.py#L516-L525) [本地 38–40 行](../../hermes-agent/tools/memory_tool.py#L38) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L38-L40)

**调用方实现：** 普通 live-agent 压缩流程在准备提交时调用 `_rebuild_system_prompt_at_boundary`；该函数调用 `agent._invalidate_system_prompt()`，后者清掉缓存并重新 `load_from_disk()`，随后边界函数重建系统提示词并保存新的缓存。不是只靠“注释声称会重载”。[本地 4252–4258 行](../../hermes-agent/agent/conversation_compression.py#L4252) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L4252-L4258) [本地 3094–3125 行](../../hermes-agent/agent/conversation_compression.py#L3094) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L3094-L3125) [本地 808–826 行](../../hermes-agent/agent/system_prompt.py#L808) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/system_prompt.py#L808-L826)

**模型输入路径：** 普通下一轮先使用缓存系统提示词；开始时的压缩可替换 active_system_prompt，模型请求构造器再将 active_system_prompt 作为 system 消息放到 api_messages 开头。继续已有会话时，即使创建了新的运行对象，也可以从数据库恢复旧的系统提示词原字节，所以“重启进程”等于“新建逻辑会话”是不成立的。[本地 1139–1142 行](../../hermes-agent/agent/turn_context.py#L1139) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/turn_context.py#L1139-L1142) [本地 1166–1173 行](../../hermes-agent/agent/turn_context.py#L1166) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/turn_context.py#L1166-L1173) [本地 1346–1354 行](../../hermes-agent/agent/turn_context.py#L1346) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/turn_context.py#L1346-L1354) [本地 803–805 行](../../hermes-agent/agent/conversation_loop.py#L803) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_loop.py#L803-L805)

**注释差异与例外：** memory_tool.py 顶部仍用“会话中写盘不改变 prompt”的概括，不能把它扩展成“只能新会话才生效”。普通 live-agent 压缩边界会重建；但 `_retain_seeded_system_prompt=True` 的 detached gateway 压缩代理直接返回旧前缀，避免缩减工具集的后台代理覆盖在线会话。故也不能写成“任何压缩都会刷新记忆”。[本地 1–5 行](../../hermes-agent/tools/memory_tool.py#L1) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L1-L5) [本地 3081–3095 行](../../hermes-agent/agent/conversation_compression.py#L3081) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/conversation_compression.py#L3081-L3095)

**设计推断：** “持久文件已更新”“精选记忆块已刷新”“模型这轮知道新事实”是三个判断。新用户消息或工具结果本身仍可能让模型当下知道新偏好；冻结的是指定的记忆注入路径，不是阻止模型阅读当前对话。准确写法是：**普通写入不保证立即改变缓存前缀，后续明确重建边界才重载该记忆块。**

## 事实 2：Hermes 的实际编辑表面是 add / patch / remove，不能照内部类方法推断 API

**实现事实：** 模型可见 schema 只列 add、patch、remove；入口对单条和 batch 中的 replace 明确拒绝。MemoryStore 仍有整条替换方法，`_STORE_ACTIONS` 保留 replace 以重放较早已暂存的操作；它的存在不表示模型仍可直接调用该动作。[本地 258–289 行](../../hermes-agent/tools/memory_tool.py#L258) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L258-L289) [本地 373–405 行](../../hermes-agent/tools/memory_tool.py#L373) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L373-L405) [本地 104–115 行](../../hermes-agent/tools/memory_tool.py#L104) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L104-L115)

patch 修改匹配条目中的一个跨度并保留其余内容；相同跨度在条目中出现多次会被拒绝，条目选择不唯一或未匹配时返回错误。它与历史 replace 的“old_text 只定位、再覆盖整条”语义不同。不能把“用户纠正一个词”实现为默默重写整段资料。[本地 392–439 行](../../hermes-agent/tools/memory_tool_store.py#L392) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L392-L439) [本地 447–462 行](../../hermes-agent/tools/memory_tool_store.py#L447) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L447-L462)

普通修改的执行链是：文件锁 → 从磁盘重读 → 处理漂移/不可读文件 → 在副本上计算更新 → 写回 → 返回完成信息。底层使用临时文件与原子替换；batch 只在全批合法、最终总量满足限额后提交，任何操作失败都不应用整批。[本地 338–367 行](../../hermes-agent/tools/memory_tool_store.py#L338) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L338-L367) [本地 553–616 行](../../hermes-agent/tools/memory_tool_store.py#L553) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L553-L616) [本地 675–683 行](../../hermes-agent/tools/memory_tool_store.py#L675) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L675-L683)

**设计推断：** “会改文件”只是最低层能力；一个精选记忆编辑器还必须定义改哪一条、如何防止歧义、什么时候算整批失败，以及并发编辑时是否覆盖别人的更新。这里上锁与批次原子性不等于业务事实已经正确。

## 事实 3：Hermes 的长度与内容检查，约束可写性而不证明内容真实

**实现事实：** 内置 MemoryStore 默认上限为 MEMORY 2,200 字符、USER 1,375 字符，可被配置覆盖。add 超限返回当前条目和占用信息，请求模型合并/缩短后重试；batch 在最终状态计量，因此可在一次操作中腾出空间再加入新条目。每轮连续合并失败超过 3 次后返回 done，让模型停止记忆重试，继续回答用户。[本地 1328–1340 行](../../hermes-agent/agent/agent_init.py#L1328) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/agent/agent_init.py#L1328-L1340) [本地 180–219 行](../../hermes-agent/tools/memory_tool_store.py#L180) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L180-L219) [本地 369–390 行](../../hermes-agent/tools/memory_tool_store.py#L369) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L369-L390) [本地 593–615 行](../../hermes-agent/tools/memory_tool_store.py#L593) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L593-L615)

写入内容经过严格范围的威胁模式扫描；加载时被扫描命中的条目只在注入快照里替换成 BLOCKED 占位，live entries 保留原文以便查看和删除。外部手工写入超过限额时，加载路径警告但不自动截断原文件；所以配置限额不等于磁盘文件绝不可能超限。[本地 28–31 行](../../hermes-agent/tools/memory_tool_store.py#L28) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L28-L31) [本地 221–253 行](../../hermes-agent/tools/memory_tool_store.py#L221) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool_store.py#L221-L253)

工具描述把长期通用事实、用户身份/偏好与任务临时状态分开，并将“应该保存什么”的选择交给模型；程序中的字符串匹配、限额和威胁扫描没有验证用户偏好是否仍有效、事实是否被错误归纳。[本地 373–397 行](../../hermes-agent/tools/memory_tool.py#L373) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L373-L397)

**设计推断：** 这些检查分别解决载荷大小、明显注入模式和编辑安全；“通过检查”只能证明它满足这些条件。冲突偏好更新、来源可信与旧条目失效仍需要模型判断、宿主策略和可追溯的来源。

## 事实 4：Hermes 的精选 Markdown 与会话数据库并存

**实现事实：** `session_search` 的发现路径调用 SessionDB 的全文搜索，默认查 user/assistant，排除隐藏来源，对 cron 结果降权，随后再组织适合模型阅读的会话窗口。它不是在 2,200 字符的 MEMORY.md 里检索；读取路径可打开 profile 的 state.db，底层实现有 SQLite FTS5 索引。[本地 354–378 行](../../hermes-agent/tools/session_search_tool.py#L354) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/session_search_tool.py#L354-L378) [本地 603–636 行](../../hermes-agent/tools/session_search_tool.py#L603) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/session_search_tool.py#L603-L636) [本地 41–55 行](../../hermes-agent/hermes_state_fts.py#L41) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/hermes_state_fts.py#L41-L55)

搜索还区分已压缩归档（active=0, compacted=1）和撤销隐藏（active=0, compacted=0），只有前者按该归档识别路径可找回；不能把“当前上下文里没有了”一律解释为“所有历史都仍可无条件检索”。[本地 206–234 行](../../hermes-agent/tools/session_search_tool.py#L206) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/session_search_tool.py#L206-L234)

**设计推断：** 文件精选记忆提供小而常驻的说明，会话数据库提供按需历史查找，两者可以是同一个 Agent 的不同记忆层。以“用了 Markdown”判断“没有检索、没有数据库”会误读这个架构。

## 事实 5：Hermes profile 是默认范围，但不是禁止一切跨 profile 读取的安全声明

**实现事实：** get_hermes_home 优先使用上下文局部 override，再走进程环境和默认目录；memory 文件目录每次调用动态解析为该 home 下的 memories。命名 profile 的 home 由 profiles 目录下的名称解析，并检查名称能否作为合法路径分量。[本地 161–168 行](../../hermes-agent/hermes_constants.py#L161) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/hermes_constants.py#L161-L168) [本地 38–40 行](../../hermes-agent/tools/memory_tool.py#L38) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/memory_tool.py#L38-L40) [本地 433–445 行](../../hermes-agent/hermes_cli/profiles.py#L433) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/hermes_cli/profiles.py#L433-L445)

session_search 默认打开当前 home 的 state.db；指定 profile 或带 profile 的 session 链接时，改为只读打开相应 profile 的数据库。裸 session_id 在当前 profile 未命中不会自动扫描所有其他 profile，必须明确指定。[本地 434–477 行](../../hermes-agent/tools/session_search_tool.py#L434) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/session_search_tool.py#L434-L477) [本地 611–636 行](../../hermes-agent/tools/session_search_tool.py#L611) · [固定源码](https://github.com/NousResearch/hermes-agent/blob/e31c674f7c523070f48f3baad0650c2fdd7ef6e5/tools/session_search_tool.py#L611-L636)

**设计推断：** 应写成“默认按 profile 选择目录与数据库，跨 profile 读取需要显式指向”，而不是“profile 是无条件的保密沙箱”。显式跨 profile 能力本身是产品允许的路径；工具范围与调用者授权仍是另一个层次。

## 事实 6：OpenClaw 区分 USER、MEMORY 与日记，也区分谁把它们读进来

**实现事实（指令层）：** 随仓库分发的 AGENTS 模板将 USER.md 定义为稳定偏好/用户资料的有效指令，将 MEMORY.md 定义为持久非画像事实与决策，将 memory/YYYY-MM-DD.md 定义为原始日志。模板要求偏好改变时标记旧项失效并更新有效指令，要求写前先读。这些是给模型的工作规范，**不等于程序自动检测和解决每一处矛盾**。[本地 43–75 行](../../openclaw/docs/reference/templates/AGENTS.md#L43) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/docs/reference/templates/AGENTS.md#L43-L75)

**实现事实（注入层）：** 常规 bootstrap 文件列表包括 USER.md 和 MEMORY.md；每次 bootstrap cache 访问重新读取文件并比较内容/来源身份，因此长会话之后的解析可以看见编辑。但这发生在后续运行的解析边界，不会改写已发出的模型请求。个人 USER 单独刷新，不塞回共享会话快照；实际注入仍要经过会话和来源过滤。[本地 29–36 行](../../openclaw/src/agents/workspace-bootstrap-policy.ts#L29) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/workspace-bootstrap-policy.ts#L29-L36) [本地 44–66 行](../../openclaw/src/agents/bootstrap-cache.ts#L44) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-cache.ts#L44-L66) [本地 321–365 行](../../openclaw/src/agents/bootstrap-files.ts#L321) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-files.ts#L321-L365)

每日日记不是这份根目录 bootstrap 清单中的固定项目。运行时在 bare /new、/reset 的对应路径上可生成独立 startup prelude，默认选最近 2 个日历日，按配置时区，并受自己的单文件/总量预算约束。不能把模板说“可能已提供最近日记”改写成“每个模型轮次都完整读取所有日记”。[本地 303–327 行](../../openclaw/src/auto-reply/reply/get-reply-run-context.ts#L303) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/auto-reply/reply/get-reply-run-context.ts#L303-L327) [本地 12–21 行](../../openclaw/src/auto-reply/reply/startup-context.ts#L12) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/auto-reply/reply/startup-context.ts#L12-L21) [本地 169–245 行](../../openclaw/src/auto-reply/reply/startup-context.ts#L169) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/auto-reply/reply/startup-context.ts#L169-L245)

**设计推断：** 保存责任与加载责任分属模型、文件工具和运行系统。评估一次偏好纠正是否有效，必须检查写入了哪个文件、当前运行是否重新加载、有效上下文中实际出现了什么。

## 事实 7：OpenClaw 写盘长度与注入长度是不同预算

**实现事实：** bootstrap 默认单文件 20,000 字符、总量 60,000 字符，USER.md 另有最高 4,000 字符的固定上限。组装器按剩余预算处理每个文件，对普通文件生成截断内容并发警告；这些操作只改变 injected context，不截断源文件。个人 USER 超出可用预算时整份跳过，退回共享默认值，避免把半条个人指令变成新策略。[本地 87–92 行](../../openclaw/src/agents/embedded-agent-helpers/bootstrap.ts#L87) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/embedded-agent-helpers/bootstrap.ts#L87-L92) [本地 383–464 行](../../openclaw/src/agents/embedded-agent-helpers/bootstrap.ts#L383) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/embedded-agent-helpers/bootstrap.ts#L383-L464)

**设计推断：** 磁盘里正确存下的长篇偏好仍可能不在模型此轮可见范围里。总预算还会让前面的文件挤占后面的文件；解决方法不只是“把内容写进文件”，还包括缩短、分层、选择优先级和在需要时检索原文。

## 事实 8：OpenClaw 自动注入同时检查会话范围与来源分类

**实现事实：** group/channel、cron、subagent 被视为非私人上下文，根 MEMORY.md 会被过滤；subagent bootstrap 仅允许 AGENTS.md，cron 有单独清单。bootstrap hooks 执行后还重新过滤，防止通过改名或别名把已保护的来源放回去。[本地 961–1018 行](../../openclaw/src/agents/workspace.ts#L961) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/workspace.ts#L961-L1018) [本地 177–205 行](../../openclaw/src/agents/bootstrap-files.ts#L177) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-files.ts#L177-L205) [本地 345–389 行](../../openclaw/src/agents/bootstrap-files.ts#L345) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-files.ts#L345-L389)

对 USER/MEMORY 的自动注入，memory origin 分类只有 owner/agent 合格；untrusted/system 不合格。memory-core 分类器会识别工作区根精选文件、个人 USER 与 memory 下 Markdown；dreaming 产物路径按 system 分类，记录的 provenance（来源信息）优先；**没有来源记录的普通工作区记忆默认归 agent**，因此它不是对每一条内容的密码学背书。[本地 64–73 行](../../openclaw/packages/memory-host-sdk/src/host/types.ts#L64) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/packages/memory-host-sdk/src/host/types.ts#L64-L73) [本地 57–83 行](../../openclaw/extensions/memory-core/src/memory/memory-path-provenance.ts#L57) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/memory/memory-path-provenance.ts#L57-L83) [本地 208–272 行](../../openclaw/src/agents/bootstrap-files.ts#L208) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-files.ts#L208-L272)

分类错误或不支持会排除候选，但当前 status=unavailable 路径返回空的不合格列表，保留既有回退；不能概括为任何分类问题都 fail closed。[本地 253–265 行](../../openclaw/src/agents/bootstrap-files.ts#L253) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/agents/bootstrap-files.ts#L253-L265)

**设计推断：** 来源分类是在决定材料是否能自动升级成常驻上下文，不是决定其陈述一定为真。把日志、外部文本或整理报告直接拼进 system，会绕过这层责任区分。

## 事实 9：OpenClaw 的文件、数据库索引与检索结果是不同状态

**实现事实：** memory-core 以插件形式注册文件记忆检索能力；memory_search 获取 search manager，再按 memory/wiki/all/sessions 等请求的 corpus（检索语料范围）发起查询。sessions 必须满足运行配置/可信 recall 路径的条件，模型单凭参数不能把没有启用的会话来源打开。[本地 217–233 行](../../openclaw/extensions/memory-core/index.ts#L217) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/index.ts#L217-L233) [本地 349–352 行](../../openclaw/extensions/memory-core/index.ts#L349) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/index.ts#L349-L352) [本地 213–247 行](../../openclaw/extensions/memory-core/src/tools.ts#L213) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/tools.ts#L213-L247) [本地 291–319 行](../../openclaw/extensions/memory-core/src/tools.ts#L291) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/tools.ts#L291-L319)

检索实现有 agent SQLite 路径捕获与数据库打开流程，并按设置启用 FTS 与向量扩展；所以“文件记忆”不意味着无数据库，也不能把“用了向量”当成所有查询必走唯一向量路线。文件观察器把变化标为 dirty 并触发同步，索引另有执行生命周期；写文件完成不是索引同步完成的同一个返回事件。[本地 1–16 行](../../openclaw/extensions/memory-core/src/memory-agent-database.ts#L1) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/memory-agent-database.ts#L1-L16) [本地 136–161 行](../../openclaw/extensions/memory-core/src/memory/manager.ts#L136) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/memory/manager.ts#L136-L161) [本地 35–80 行](../../openclaw/extensions/memory-core/src/memory/manager-watch-ops.ts#L35) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/memory/manager-watch-ops.ts#L35-L80)

**设计推断：** 一次写入之后，应分别问“bootstrap 何时重读”“索引何时更新”“检索何时命中”“命中结果是否交给模型”。即使检索成功，模型是否采纳仍需要可观察的任务结果；本次没有运行这些时延实验。

## 事实 10：OpenClaw dreaming 的调度触发有明确条件

**实现事实：** 本版 memory-core 的 dreaming 配置解析默认为 enabled=true；插件注册维护逻辑，创建的受管 cron 使用隔离会话、lightContext 和不投递公告。实际 before_agent_reply 钩子只接受 heartbeat/cron，以及准确的 dreaming 系统事件标识；heartbeat 还要检查对应待处理的受管 cron 事件。用户普通消息里提到 dreaming，不等于触发该维护路径。[本地 345–383 行](../../openclaw/src/memory-host-sdk/dreaming.ts#L345) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/src/memory-host-sdk/dreaming.ts#L345-L383) [本地 296–296 行](../../openclaw/extensions/memory-core/index.ts#L296) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/index.ts#L296-L296) [本地 99–123 行](../../openclaw/extensions/memory-core/src/dreaming-cron.ts#L99) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-cron.ts#L99-L123) [本地 584–628 行](../../openclaw/extensions/memory-core/src/dreaming.ts#L584) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming.ts#L584-L628)

调度服务缺失、调度全局禁用或插件未处于相应运行环境时，不能由“配置默认 on”推出维护已经执行。实现会处理 cron 不可用并记录延期/不可协调信息。[本地 407–435 行](../../openclaw/extensions/memory-core/src/dreaming.ts#L407) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming.ts#L407-L435)

**研究范围：** 以下追踪的是 deep promotion 到根 MEMORY.md 的路径。light/rem 的全部候选生成、全部命令与其他插件的记忆能力没有在本次穷尽审计，不能据此写成“dreaming 只有这一条能力”或“所有 dreaming 都会改 USER”。

## 事实 11：OpenClaw deep 整理让模型选操作，宿主限定新事实来自哪里

**实现事实：** 维护程序先运行阶段任务，再按最少信号数、查询多样性、得分、时间等条件排名候选；明确 untrusted/system 来源在排名与应用两处被拦截。用于结构化合并的候选要求 owner/agent；会话来源还要求 interactive。被频繁召回不自动把不可信来源洗成可信长期记忆。[本地 148–230 行](../../openclaw/extensions/memory-core/src/dreaming.ts#L148) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming.ts#L148-L230) [本地 104–137 行](../../openclaw/extensions/memory-core/src/short-term-promotion.ts#L104) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion.ts#L104-L137) [本地 10–24 行](../../openclaw/extensions/memory-core/src/dreaming-consolidation-candidates.ts#L10) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-consolidation-candidates.ts#L10-L24) [本地 236–255 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L236) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L236-L255)

可选模型调用返回 added/merged/superseded 操作及精确的旧条目，不允许自由返回新的记忆正文；解析器自己从候选原文生成 resultEntry，并带来源定位。宿主再检查每个候选恰好一次、旧条目存在且唯一、不跨项目组、合并内容匹配、superseded 有对应 lineage（替代关系）等。模型不存在、输出无效或校验拒绝时，路径可退到只追加而不采用该合并计划。[本地 22–31 行](../../openclaw/extensions/memory-core/src/dreaming-consolidation.ts#L22) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-consolidation.ts#L22-L31) [本地 50–79 行](../../openclaw/extensions/memory-core/src/dreaming-consolidation.ts#L50) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-consolidation.ts#L50-L79) [本地 92–121 行](../../openclaw/extensions/memory-core/src/dreaming-consolidation.ts#L92) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-consolidation.ts#L92-L121) [本地 201–273 行](../../openclaw/extensions/memory-core/src/dreaming-consolidation.ts#L201) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-consolidation.ts#L201-L273) [本地 413–474 行](../../openclaw/extensions/memory-core/src/dreaming-consolidation.ts#L413) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/dreaming-consolidation.ts#L413-L474) [本地 500–519 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L500) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L500-L519)

**设计推断：** 模型在这里提出“保留/合并/替代”的判断，宿主掌握文本生成和提交权限；这比把整份 MEMORY.md 交给模型自由改写有更窄的损坏面。但候选本身若已包含错误归纳，上述结构校验不构成语义真实性证明。

## 事实 12：OpenClaw deep 写回包含并发前像检查，保存后仍要经过后续加载

**实现事实：** apply 路径的目标是工作区根 MEMORY.md。生成计划前记录文件内容 hash 和候选指纹；提交时取得文件锁与 workspace 锁，重读候选状态、来源和目标文件。若模型整理期间文件已改变，原计划不再直接覆盖；提交合并时再次带 expectedHash，预先保存旧内容和来源关系，处理冲突时回退或拒绝。[本地 190–190 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L190) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L190-L190) [本地 330–365 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L330) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L330-L365) [本地 372–435 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L372) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L372-L435) [本地 438–489 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L438) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L438-L489)

只追加回退也受总文件预算约束，超出则推迟候选；其提交仍传前像，但代码明确保留较宽的旧版 read-modify-replace 回退，接受与外部编辑器的竞态风险，不能把内部写入锁讲成“任何外部编辑都绝不会丢”。[本地 500–541 行](../../openclaw/extensions/memory-core/src/short-term-promotion-apply.ts#L500) · [固定源码](https://github.com/openclaw/openclaw/blob/ec38f535d3d5de9e087d834fe58e6190852fcb2a/extensions/memory-core/src/short-term-promotion-apply.ts#L500-L541)

**设计推断：** deep promotion 成功证明的是这条写回路径已提交合格产物，不证明当前在线会话的 bootstrap 块已重新生成，更不证明每个用户偏好都被自动更新。后续生效仍回到事实 6–9 的加载、预算、来源过滤和检索链；模板要求模型更新 USER 的职责，与此处自动整理 MEMORY 的职责要分别说明。

## 可以直接用于正文的边界表达

| 问题 | 源码支持的表达 | 不能由这些实现直接推出 |
|---|---|---|
| 写盘成功是否等于当前记忆块已更新？ | Hermes 普通写入不刷新冻结块；普通 live-agent 压缩重建会重载。OpenClaw 在后续 bootstrap 解析和索引同步边界加载 | 模型当前绝对不知道新事实；任何下一轮、重启或压缩必定立刻刷新 |
| Markdown 是否意味着没有检索？ | 两个项目都可同时拥有精选 Markdown、会话记录及数据库检索 | 文件方案与数据库方案天然互斥 |
| 谁决定保存事实/偏好？ | 用户提供信息；模型/维护策略选择；宿主校验、限定提交；加载器再选择可见材料 | 只要保存工具可用，所有稳定偏好都会被完整、正确、及时地保存 |
| 校验通过是否等于可信？ | 长度、匹配、来源、并发前像和结构检查分别验证不同条件 | 系统已证明陈述真实、偏好没过期、模型一定按它行动 |

此表为上述 12 项事实的归纳，不增加效果结论。

## 待实测（本次未执行）

- 用 fake memory 内容记录 Hermes 新会话初始 prompt，写入后比较当前 frozen block，再走普通 live 压缩与 retained-seeded 后台压缩两条路径；分开检查磁盘、缓存、最终 api_messages。
- 在 OpenClaw 同一长会话里改 USER，捕获下一次 bootstrap；分别测试 4,000 字符 USER 上限、总预算耗尽、个人 USER 超限、group/cron/subagent 与来源 downgrade。
- 写入可识别标记，记录文件完成、index sync 完成、memory_search 返回和模型请求含该标记的四个时间点，核对索引滞后，避免把未检索到误判为没保存。
- 用固定候选和 fake consolidation 输出测试错误来源、自由生成 resultEntry、缺少原文依据的替代、并发外部修改、预算不足与 append-only 回退，核对源文件与旧内容是否仍可追溯。

本研究没有测量准确率、延迟、压缩后遵循偏好的成功率，也未验证真实多 profile 部署的全部权限边界。
