# Codex 工具执行：模型提出动作以后，谁真正允许它发生？

> 研究日期：2026-10-17。对象：本地 `codex` 子模块，提交 `5009a99dfc07830ddf7464c26f310a2b8532b55d`。本记录使用 research 技能的“一手材料、单文件记录、逐项引用”方法，完全基于指定源码快照；未运行 Agent、未调用模型、未安装依赖。下文的行为属于静态源码事实，不是运行实验结论。所有本地链接按研究记录最终位于主仓库 `references/studies/` 时解析。

## 范围与入口怎样计数

本记录按“模型能够点名调用的工具”统计实际入口：**1 个固定入口 `exec_command`，加 N 个已注册的 MCP 工具，共 1 + N 个**；N 随工具目录和配置变化。为了讲清共同机制，后文只分成命令执行、MCP 调用两条执行链，不能据此说 Codex 一共只有两个工具。命令工具在启用 UnifiedExec 时支持保留进程，并另注册 `write_stdin`；否则同名 `exec_command` 可以采用一次性执行方式。本记录不展开 `write_stdin`、补丁工具、资源读取工具或 Code Mode 的 JavaScript 调度入口。MCP 工具按服务、工具身份生成模型可见的命名空间工具规格。[^e01][^e02]

想象模型要运行一条测试命令，再到某个 MCP 服务查询问题单。模型只提出“调用哪个工具、传入什么数据”。Codex 的会话运行系统接收请求，分发器找到已注册处理器；命令适配器把参数变成进程请求，再交给命令策略、审批和沙箱执行基础设施；MCP 适配器则使用已准备的服务绑定和工具审批，把请求交给 MCP 客户端与服务。两条链最终都把结果交回会话记录。这是后文源码链条的角色概括，不是另一套独立 API。[^e04][^e07][^e12][^e30][^e50]

**入口、数据、适配器与基础设施的区别。** 调用者调用 `exec_command` 或具体 MCP 工具；函数调用参数、内部 `ToolInvocation`、执行请求只是数据，不能额外算入口。命令 handler 和 MCP handler 是业务适配器：前者解释执行意图，后者绑定服务与工具。工具注册表、执行协调器、审批服务、沙箱管理器、进程管理器和 MCP 客户端负责支撑执行。`ToolRuntime` 是命令适配器与协调器之间的内部约定；不能把它当成模型另一个可调用工具。[^e05][^e07][^e10][^e12][^e30][^e53]

## 共同前半段：有工具描述，还需要找到执行者

**事实。** 发给模型的请求携带当前工具路由器选出的工具规格。模型返回函数调用后，响应处理器记录调用项、创建工具执行任务，并标记需要后续模型推理。路由器把模型输出中的名称、命名空间、调用编号与参数字符串转换成调用数据，再交给注册表。这里的 JSON Schema（参数结构说明）是“模型能提出怎样的调用”的契约；它并不直接产生操作系统进程。[^e03][^e04][^e05][^e07][^e09]

**事实。** 运行系统先等待工具就绪，依据工具是否允许并行取得相应锁，然后调用路由器。注册表先查找工具；找不到工具会产生可回复模型的错误；请求类型与工具不兼容则产生致命错误。若处理器提供调用前 hook（扩展检查），注册表会运行该 hook；它既可以阻止调用，也可以改写输入。处理器随后看到的可能是改写后的请求。不能把“模型最初传了什么”和“执行系统实际检查了什么”混为一谈。[^e06][^e08]

## 命令链：先解释请求，再决定是否运行

本节实际追踪 **1 个调用入口 `exec_command`**；运行系统内部的请求对象、审批方法和启动方法均不另计入口。

执行链可以读成：

```text
模型调用 exec_command
→ 注册表的调用前检查
→ 命令 handler 解析参数、选择环境、解析工作目录与 shell
→ 进程管理器计算命令策略要求
→ 执行协调器决定审批、首次沙箱与有限重试
→ 命令 runtime 准备进程环境
→ 本地进程或执行服务启动进程
→ 输出成为工具结果，写回会话
```

这是源码调用顺序的摘要。handler 会先检查功能和权限参数；已有回合授权会影响有效附加权限，但命令本身仍进入正常的执行审批流程。不能把“已经获准访问某路径”写成“任何作用于该路径的命令都获准”。模型把补丁写成 shell 命令时，handler 还可能先识别为补丁并转入专门处理路径，本节的进程链仅适用于没有被这种拦截接管的命令。[^e10][^e55][^e54][^e11][^e12][^e53][^e20]

### 命令策略的拒绝发生在沙箱尝试之前

**事实。** 进程管理器先根据命令、审批模式、环境权限和执行策略计算一个要求，再把它装入请求交给协调器。策略会检查解析出的命令片段，得到三种结果：禁止执行、需要审批、无需审批。需要提示时，还要检查当前审批政策是否允许这种提示；不允许提示可以转成禁止执行。协调器遇到禁止执行便返回拒绝，不会先试着运行、再等待沙箱阻止。[^e12][^e13][^e15]

**事实。** “无需审批”不总等于“无沙箱”。只有每个解析出的命令片段都被显式允许规则覆盖，策略才会提出首次绕过沙箱。未命中规则时，普通命令在受限环境和 `OnRequest` 模式下可以不先提示、交由沙箱限制；危险命令的启发式分支则另行处理。由此可见，`Never` 指不提示审批，不应被理解成拒绝一切命令，也不应被理解成无条件允许一切命令。[^e13][^e14]

### 审批者和沙箱分别承担什么职责

**事实。** 对需要审批的命令，协调器先构造动作交给会话审批服务。审批服务的次序是：先运行权限请求 hook；hook 没有给决定时，尝试自动审查器 Guardian；Guardian 分支没有接管时，再走用户审批。启用严格自动审查时，即使策略原本说无需审批，协调器也会发起审查。因此“有审批”不能直接推断“用户看见了弹窗”。[^e15][^e16]

**事实。** 审批通过后，协调器选择首次沙箱。对于存在禁止读取路径的文件系统政策，即便有允许规则，也不能直接拆掉唯一负责禁止读取的沙箱；明确请求提权并得到审批时，可以改为扩大部分权限但保留限制的沙箱形式。实际的沙箱选择还会区分本地执行与执行器自行管理沙箱的情况。控制端显示没有本地包装进程，并不能据此判定远程执行没有沙箱。[^e18][^e17][^e53]

**事实。** 命令 runtime 将选定权限和命令组合为执行请求；本地路径通过沙箱管理器转换命令，再启动受管理进程；远程环境或特定 shell 快照路径会把执行请求交给执行服务的后端启动。执行协调器还会在每次尝试周围建立、结束或延后完成受管网络审批。因此真实链条存在网络约束分支，不能仅用“批准→无沙箱执行”概括所有情况。[^e19][^e20][^e56]

### 沙箱拒绝后的重试有条件，而且取决于拒绝在哪里被发现

**事实。** 对执行协调器所管理的**启动尝试**，只有结构化的沙箱拒绝 `SandboxErr::Denied` 进入提权重试分支；普通错误不会因此得到自动重跑。该分支还会检查工具是否允许升级、审批政策、网络拒绝信息与禁止读取限制。`Never` 和 `OnRequest` 默认不自动重试为无沙箱执行；`OnRequest` 存在一个带有效受管网络审批上下文且默认要求审批的例外。无法提取可审批上下文的网络政策拒绝会直接返回；有禁止读取限制而又没有网络审批上下文时，也不会通过移除沙箱重试。[^e21][^e23]

**事实。** 能进入第二次尝试也不代表原来的批准覆盖新权限。首次来源是用户或权限 hook 的批准，在非严格审查且无网络上下文时可以免去再次审批；首次来自 Guardian 的批准不被这条免审条件视为重试预授权。对允许无沙箱的重试，协调器会把待审动作的权限改成提权、清除较窄的附加权限，要求审批者审阅实际重试的权限范围。代码显式发起一次第二次尝试，失败后返回，没有在此处形成无限重试循环。[^e22]

**事实。** 还必须区分“启动时发现拒绝”和“收集输出时才发现拒绝”。进程构造阶段会在早退观察期检查拒绝，因而可以把拒绝向上送回执行协调器；进程已经交回后，进程管理器在收集退出输出时也会检查拒绝，这一检查发生在协调器完成之后，直接向 handler 返回错误，未重新进入上述重试分支。不能写成“任何沙箱拒绝都会自动走第二次尝试”。[^e24][^e20][^e25]

### 用户会话审批缓存记住什么

**事实。** 命令用户审批分支的缓存键包括：环境 ID、原始命令的首个可执行文件、规范化后的完整命令、工作目录、是否使用终端、沙箱权限、附加权限；外层还组合所选环境强制执行策略的指纹。缓存只在命中所有键且值为“会话内批准”时跳过该用户提示；一次性批准不会被存成这个会话授权。规范化可以抽取简单单命令；复杂脚本保留脚本文本。[^e26][^e27][^e28][^e29]

**设计推断。** 这一缓存比“记住工具名就放行”更细，但它不等于对未来副作用的证明。相同命令与工作目录下的文件内容、外部服务状态仍可能变化；缓存键自身没有编码世界状态。正文可以用它解释“授权复用必须声明匹配范围”，不宜仅凭这些字段就做安全性排名。上面的缓存是用户会话审批机制；Guardian 另有带历史与授权修订的审查证据机制，本轮仅核对其历史失效检查，没有把二者当成同一缓存。[^e26][^e52]

## MCP 链：工具协议与命令沙箱不是同一个执行环节

本节实际追踪 **N 个已注册 MCP 工具入口的共同调用链**，N 是配置和工具发现后的工具数；`PreparedMcpCall` 是被准备的调用绑定，`McpInvocation` 是调用数据，MCP handler 是适配器，客户端和服务连接是执行基础设施，均不应另计为模型入口。[^e02][^e30][^e31][^e37]

```text
模型调用一个具体 MCP 工具
→ 注册表检查和调用前 hook
→ handler 准备该工具的服务绑定与配置快照
→ 解析 JSON，检查可用性与应用配置
→ 决定是否需要 MCP 工具审批
→ 在工具目录快照仍有效的范围内做最终准备
→ MCP 客户端发送 tools/call
→ 服务返回结果，客户端与 handler 整理结果
→ 结果写回会话
```

**事实。** MCP handler 取得准备好的调用绑定，再调用 MCP 专用处理函数。该函数先解析 JSON；不可用的工具、账户元数据错误、被应用配置禁用的工具会在发送请求前成为错误结果。审批模式来自该次准备调用的配置；Codex Apps 与自定义服务有分别取策略的分支。整个调用链不能直接套用前面的命令执行协调器流程。[^e30][^e31][^e36][^e37]

### 哪些 MCP 调用需要审批

**事实。** 非严格审查时，某些配置可以使 MCP 权限提示自动批准，例如工具被明确配置为 `Approve`，或“从不提示”与相应完整权限条件组合成立；这不是 `Never` 一项设置单独决定。其次，审批模式和工具注解会决定是否需要提示：`Prompt` 始终需要，`Writes` 看只读提示，`Approve` 不需要，`Auto` 综合破坏性、只读、开放世界提示。注解是服务提供的能力提示，不能把分支读取某项提示写成 Codex 已验证了工具业务行为。[^e32][^e33][^e34]

**事实。** 严格自动审查会越过这些“不必审批”与会话记忆的短路条件，走共同审批服务。MCP 的审批拒绝、审批超时、取消会被转换成该次调用的失败结果；得到批准或无需审批时才进入最终准备与服务调用。[^e32][^e35]

### MCP 的会话授权与命令缓存不同

**事实。** MCP 会话记忆只为 `Auto` 模式生成键；键含服务名、插件 ID、连接器 ID、账户连接 ID 和工具名，**不含调用参数**。Codex Apps 缺少连接器身份时不能生成这个键。批准记忆以“会话内批准”写入；持久批准可落入配置，失败则退回会话记忆；由所选插件产生的工具策略不允许持久批准。[^e39][^e40][^e41]

**设计推断。** 因此，不能在书里把所有“会话内允许”画成同一种范围。命令分支的授权匹配具体执行条件；MCP 的这条记忆是工具身份范围，同一工具换一组业务参数仍可能复用记忆。这个差异描述的是宿主授权边界，不是在比较工具实际能访问的数据范围；后者还取决于 MCP 服务、账户和业务系统。[^e26][^e39]

### MCP 的最终准备与客户端恢复

**事实。** 审批完成不代表立即发送。准备调用会在捕获的工具目录快照仍有效的范围内执行最终准备；若工具目录已改变，会拒绝此次调用。批准的记忆写入、文件参数改写、调用元数据构建位于这个最终准备过程，随后客户端才发送 `tools/call`。客户端还会要求非空参数是 JSON 对象，并在需要时刷新 OAuth。[^e36][^e37][^e38]

**事实。** MCP 客户端也存在系统级恢复：服务操作遇到指定的 Streamable HTTP 会话过期 404 时，客户端重建连接，再调用同一操作；`tools/call` 使用这条公共方法。普通瞬时传输错误的退避重试则显式只针对 `tools/list`，不能扩展描述成所有 `tools/call` 都会因超时自动重试，也不能说 MCP 一概不重试。这里的恢复是连接/会话恢复，与命令提权重试的条件和权限含义不同。[^e38][^e42][^e43]

**待验证。** 本轮没有启动测试 MCP 服务，未测量连接重建期间服务实际执行了几次业务动作；也未证明某个具体远端写操作具备幂等性。若正文讨论“执行一次”保证，应另设可计数的写操作与故障注入实验，不能由客户端重试代码推导出恰好执行一次。

## 哪些失败能回到模型，哪些不是普通工具失败

**事实。** 命令策略、参数或审批导致的常见失败会被 handler 包装成可回复模型的错误；沙箱拒绝则保留命令输出、退出码和截断信息，并明确不留下可继续操作的进程编号。这里有个容易误读的细节：这份命令输出的外层工具成功标记可以是 `true`，命令实际失败仍需看退出码和输出，不能据外层标记认定测试通过。[^e44][^e45]

**事实。** MCP 的参数解析、可用性、配置和审批失败，以及调用客户端返回的错误，最终可以包装为 `CallToolResult` 中的 `is_error: true` 和文本内容。服务正常返回一个 `is_error: true` 的结果也仍然是一次有返回结果的协议调用。handler 再把 MCP 结果转换成模型函数调用输出，并按模型预算截断，原始业务结果和模型实际看到的结果并非总是同一个字节串。[^e31][^e35][^e36][^e46][^e47]

**事实。** 对模型直接发出的工具调用，普通 `RespondToModel` 错误会被执行层转换成失败工具输出，保留调用编号；`Fatal` 则作为会话错误向上传递，不能描述成普通工具结果。最终工具结果按调用顺序被收集并写入会话记录；响应处理器已标记需要后续推理。这说明回路中的关键不是“工具永远成功”，而是模型能得到可区分的观察并继续决策。[^e48][^e49][^e50][^e04]

**事实。** 结果还有调用后 hook。该 hook 可以阻止结果进入模型，或用反馈替换模型可见结果，但动作已经执行；源码明确区分“拦住结果”和“撤销动作”。因此后置检查不能被表述为副作用回滚。[^e51]

## 可用于正文的两个设计问题

1. **批准的是一段文字，还是某个权限范围下的动作？** 命令从受限执行升级时，Codex 重建待审权限；MCP 则允许在特定模式下记住工具身份。读者应比较授权的匹配单位、失效条件和业务风险，而不是只数“有没有审批”。这是基于上述实现的设计提问，不是安全性结论。[^e22][^e26][^e39]
2. **恢复执行，与重新取得观察，什么时候会变成重复副作用？** 命令启动阶段的沙箱重试、稍后输出收集阶段的失败、MCP 的会话重连处在不同层；一次调用看见错误也不能仅凭结果字样推断远端从未执行。后半句属于通用设计推断，本记录没有完成具体副作用实验。[^e21][^e24][^e25][^e42]

## 本轮边界与后续核验

已完成静态调用链、关键条件、错误出口和引用行号检查。没有执行 Rust 测试或端到端任务；没有核对所有平台沙箱实现、全部 Guardian 扩展的决策细节、MCP 服务内部授权、所有工具以及 Code Mode 的结果呈现语义。不要从本记录推出“Codex 所有工具都走同一条权限链”或“某项目整体更安全”。

下一步可用本地无副作用命令与自建 MCP 假服务各制作最小轨迹：固定审批模式和权限配置，记录首次审批来源、请求参数、目录版本、进程退出、服务调用次数和模型收到的结果。重点让拒绝分别发生于进程启动早期、退出收集期和 MCP 会话恢复期，再核对本文静态条件。以上是实验方案，尚未运行。

## 一手证据

以下 GitHub 链接均固定为同一提交；本地路径保留主工作区的相对布局。

[^e01]: [本地源码](../../codex/codex-rs/core/src/tools/spec_plan.rs#L1244-L1264) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/spec_plan.rs#L1244-L1264)。

[^e02]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/mcp.rs#L502-L532) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/mcp.rs#L502-L532)。

[^e03]: [本地源码](../../codex/codex-rs/core/src/session/turn.rs#L1665-L1694) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/turn.rs#L1665-L1694)。

[^e04]: [本地源码](../../codex/codex-rs/core/src/stream_events_utils.rs#L314-L358) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/stream_events_utils.rs#L314-L358)。

[^e05]: [本地源码](../../codex/codex-rs/core/src/tools/router.rs#L256-L308) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/router.rs#L256-L308)。

[^e06]: [本地源码](../../codex/codex-rs/core/src/tools/parallel.rs#L202-L253) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/parallel.rs#L202-L253)。

[^e07]: [本地源码](../../codex/codex-rs/core/src/tools/router.rs#L359-L392) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/router.rs#L359-L392)。

[^e08]: [本地源码](../../codex/codex-rs/core/src/tools/registry.rs#L649-L752) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/registry.rs#L649-L752)。

[^e09]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/shell_spec.rs#L32-L107) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/shell_spec.rs#L32-L107)。

[^e10]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L163-L193) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L163-L193)。

[^e11]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L303-L385) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L303-L385)。

[^e12]: [本地源码](../../codex/codex-rs/core/src/unified_exec/process_manager.rs#L1493-L1563) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/unified_exec/process_manager.rs#L1493-L1563)。

[^e13]: [本地源码](../../codex/codex-rs/core/src/exec_policy.rs#L339-L463) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/exec_policy.rs#L339-L463)。

[^e14]: [本地源码](../../codex/codex-rs/core/src/exec_policy.rs#L777-L861) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/exec_policy.rs#L777-L861)。

[^e15]: [本地源码](../../codex/codex-rs/core/src/tools/orchestrator.rs#L164-L235) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/orchestrator.rs#L164-L235)。

[^e16]: [本地源码](../../codex/codex-rs/core/src/tools/approvals.rs#L483-L566) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/approvals.rs#L483-L566)。

[^e17]: [本地源码](../../codex/codex-rs/core/src/tools/orchestrator.rs#L326-L384) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/orchestrator.rs#L326-L384)。

[^e18]: [本地源码](../../codex/codex-rs/core/src/tools/sandboxing.rs#L249-L294) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/sandboxing.rs#L249-L294)。

[^e19]: [本地源码](../../codex/codex-rs/core/src/tools/sandboxing.rs#L490-L520) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/sandboxing.rs#L490-L520)。

[^e20]: [本地源码](../../codex/codex-rs/core/src/unified_exec/process_manager.rs#L1284-L1384) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/unified_exec/process_manager.rs#L1284-L1384)。

[^e21]: [本地源码](../../codex/codex-rs/core/src/tools/orchestrator.rs#L386-L473) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/orchestrator.rs#L386-L473)。

[^e22]: [本地源码](../../codex/codex-rs/core/src/tools/orchestrator.rs#L484-L625) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/orchestrator.rs#L484-L625)。

[^e23]: [本地源码](../../codex/codex-rs/core/src/tools/sandboxing.rs#L330-L360) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/sandboxing.rs#L330-L360)。

[^e24]: [本地源码](../../codex/codex-rs/core/src/unified_exec/process.rs#L319-L448) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/unified_exec/process.rs#L319-L448)。

[^e25]: [本地源码](../../codex/codex-rs/core/src/unified_exec/process_manager.rs#L728-L862) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/unified_exec/process_manager.rs#L728-L862)。

[^e26]: [本地源码](../../codex/codex-rs/core/src/tools/approvals.rs#L224-L246) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/approvals.rs#L224-L246)。

[^e27]: [本地源码](../../codex/codex-rs/core/src/tools/approvals.rs#L676-L728) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/approvals.rs#L676-L728)。

[^e28]: [本地源码](../../codex/codex-rs/core/src/tools/sandboxing.rs#L41-L118) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/sandboxing.rs#L41-L118)。

[^e29]: [本地源码](../../codex/codex-rs/core/src/command_canonicalization.rs#L8-L38) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/command_canonicalization.rs#L8-L38)。

[^e30]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/mcp.rs#L186-L266) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/mcp.rs#L186-L266)。

[^e31]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L147-L295) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L147-L295)。

[^e32]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L1507-L1615) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1507-L1615)。

[^e33]: [本地源码](../../codex/codex-rs/codex-mcp/src/mcp/mod.rs#L89-L110) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/mcp/mod.rs#L89-L110)。

[^e34]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L2535-L2565) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L2535-L2565)。

[^e35]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L299-L409) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L299-L409)。

[^e36]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L491-L574) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L491-L574)。

[^e37]: [本地源码](../../codex/codex-rs/codex-mcp/src/binding.rs#L377-L439) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/binding.rs#L377-L439)。

[^e38]: [本地源码](../../codex/codex-rs/rmcp-client/src/rmcp_client.rs#L832-L909) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/rmcp-client/src/rmcp_client.rs#L832-L909)。

[^e39]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L1804-L1833) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1804-L1833)。

[^e40]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L2317-L2391) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L2317-L2391)。

[^e41]: [本地源码](../../codex/codex-rs/core/src/mcp_tool_call.rs#L1180-L1193) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1180-L1193)。

[^e42]: [本地源码](../../codex/codex-rs/rmcp-client/src/rmcp_client.rs#L1419-L1507) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/rmcp-client/src/rmcp_client.rs#L1419-L1507)。

[^e43]: [本地源码](../../codex/codex-rs/rmcp-client/src/rmcp_client.rs#L1538-L1571) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/rmcp-client/src/rmcp_client.rs#L1538-L1571)。

[^e44]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L425-L458) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L425-L458)。

[^e45]: [本地源码](../../codex/codex-rs/core/src/tools/context.rs#L396-L421) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/context.rs#L396-L421)。

[^e46]: [本地源码](../../codex/codex-rs/protocol/src/models.rs#L2412-L2434) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/protocol/src/models.rs#L2412-L2434)。

[^e47]: [本地源码](../../codex/codex-rs/core/src/tools/context.rs#L157-L213) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/context.rs#L157-L213)。

[^e48]: [本地源码](../../codex/codex-rs/core/src/tools/parallel.rs#L96-L121) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/parallel.rs#L96-L121)。

[^e49]: [本地源码](../../codex/codex-rs/core/src/tools/parallel.rs#L338-L361) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/parallel.rs#L338-L361)。

[^e50]: [本地源码](../../codex/codex-rs/core/src/session/turn.rs#L2564-L2592) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/turn.rs#L2564-L2592)。

[^e51]: [本地源码](../../codex/codex-rs/core/src/tools/registry.rs#L846-L894) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/registry.rs#L846-L894)。

[^e52]: [本地源码](../../codex/codex-rs/core/src/guardian/review_request.rs#L228-L306) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/guardian/review_request.rs#L228-L306)。

[^e53]: [本地源码](../../codex/codex-rs/core/src/tools/runtimes/unified_exec.rs#L169-L211) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/runtimes/unified_exec.rs#L169-L211)。

[^e54]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L235-L281) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/unified_exec/exec_command.rs#L235-L281)。

[^e55]: [本地源码](../../codex/codex-rs/core/src/tools/handlers/mod.rs#L86-L105) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/mod.rs#L86-L105)。

[^e56]: [本地源码](../../codex/codex-rs/core/src/tools/orchestrator.rs#L54-L122) · [GitHub 固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/orchestrator.rs#L54-L122)。
