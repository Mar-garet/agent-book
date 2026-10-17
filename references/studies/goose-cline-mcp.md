# Goose 与 Cline：MCP 服务怎样变成模型可以使用的工具

> 研究日期：2026-10-17。一手材料：本地 Goose `59e588dfd941ae129f2938deb7acf9f80b6edd02`，Cline `b549ceb4bb4247284c975f6d6ca0979decec097c`。使用 research 技能的方法，静态追踪实现；未连接真实 MCP 服务，未运行模型，未安装依赖。事实均限定于这些提交及下述执行路径；推断、尚未核对与实验方案另行标明。本地证据链接按记录最终位于主仓库 `references/studies/` 时解析。

## 分析范围与入口计数

这里按“模型能点名调用的具体工具”统计实际入口。Goose 常规直调路径有 N₍G₎ 个已暴露的扩展工具入口；Cline SDK 路径有 N₍C₎ 个已注册且未被策略过滤的工具入口，数量随服务发现结果和配置变化。不能把“接入 MCP”计为一个固定万能工具，也不能把发现方法、请求对象、管理器各算一个模型入口。本文另讨论 Goose 可选 Code Mode 自身的 **3 个**入口：列出函数、取得函数详情、执行 JavaScript；它还会保留部分其他工具，3 不是该模式全部工具的总数。[^g01][^g02][^g08][^g09][^c02][^c03][^c06]

**Cline 的边界特别需要说明。** 这份仓库含 SDK 与 VSCode 宿主；本记录的发现、命名、审批和调用主线以 `sdk/packages/core` 与 `sdk/packages/agents` 为准。VSCode 的 `McpHub` 仅作为“另有目录变化通知实现”的独立旁证，不把它自动合并成 SDK 的默认行为。两者在同一仓库，不等于所有执行路径已经共用同一实现。[^c01][^c02][^c25]

场景是：用户接入几个 MCP 服务，每个服务发布几十个工具。**服务**负责声明工具名称、用途和参数结构，实际执行业务动作；**宿主运行系统**负责把目录变成模型工具、决定是否暴露、是否审批、如何发起协议调用；**模型**在看见的工具中提出下一步。宿主把回复整理成新的观察，模型才能继续。这个角色关系由下面两条源码链共同支持。[^g01][^g14][^g17][^c03][^c09][^c13][^c16]

```text
Goose：配置中的扩展 → 分页发现 → 带归属的工具目录快照
     → 选择模型可见工具 → 权限检查 → 按目录映射找到 MCP 服务
     → 服务结果或错误 → 对话中的工具回复

Cline SDK：服务注册 → 连接并列出工具 → 每个工具包装成 AgentTool
         → 合并工具与过滤策略 → 模型提出调用 → 宿主审批
         → 服务管理器、客户端发送 tools/call → tool-result 消息
```

以下 12 项是可引用的关键事实；链条中的业务适配器承担“解释和转交”，连接与缓存属于基础设施，数据对象均不是额外入口。

## 1. Goose 先筛选和改名，再把目录交给模型

**事实。** Goose 的扩展管理器逐页执行 `tools/list`，直到游标为空。每个工具先通过扩展配置的 `available_tools` 筛选；普通扩展工具改名为 `扩展键__原始工具名`，保留归属元数据，并规范化参数结构。构造目录时，宿主同时记住模型名称与服务原名的对应关系；若模型名称重复，保留较早扩展的条目并记录告警。因此名称空间不仅用于展示，还承担后续路由。[^g01][^g02]

## 2. Goose 的目录变化先使缓存失效，不会改写正在使用的目录快照

**事实。** MCP 客户端收到工具列表变化通知时增加工具版本号。扩展工具缓存同时匹配版本号与会话作用域，版本变化后，后续读取不能直接复用旧缓存；抓取期间版本再次变化时，抓到的结果也不会存成该版本的有效缓存。另一方面，一份扩展租约内部的工具目录由一次初始化单元保存；推理准备会捕获所用租约。这里的“租约”指一份持有扩展连接和目录的调用快照，便于后续调用继续使用同一归属映射。不能把通知处理写成“所有正在等待审批的调用立即换用新目录”。[^g03][^g04][^g05][^g06][^g07]

**设计推断。** 动态更新与单次调用的一致性是两个问题：更新新目录不应让旧调用悄悄转到另一个执行者。此处能证明的是版本失效和租约内目录固定；本轮没有用并发通知实验测量新目录在具体 UI 回合的生效时刻。

## 3. Goose 可选 Code Mode 用逐步发现减少直接暴露的参数结构

**事实。** 启用编译特性且当前租约包含 Code Mode 扩展时，推理准备切换工具暴露方式。宿主保留特定一等平台扩展和带界面资源的工具，再按模型可见性过滤，并稳定排序。Code Mode 的 3 个入口让模型先取得工具名和简短说明，再按需取得指定工具的完整输入、输出结构，最后通过 JavaScript 调用确切工具名称；列表中的说明只取首行并限制为 240 字符。这是可选路径，不能写成 Goose 所有配置都默认把 MCP 目录压成 3 个工具。[^g07][^g08][^g09]

**设计推断。** 这种方式把“每次请求都携带所有详细参数结构”改为“先列目录、需要时再看详情”。它可能减少初次上下文占用，但增加发现步骤；本记录没有测量 token、延迟或任务成功率。普通直调分支在这段准备逻辑中主要做可见性过滤和排序，不能因为存在 Code Mode 就宣称任意工具数量均无上下文代价。[^g08][^g09]

## 4. Goose 的只读注解会影响审批，但不证明服务实际只读

**事实。** 在 `SmartApprove` 模式，Goose 将服务工具的 `read_only_hint: true` 放入当前 Agent 的只读工具集合；显式用户权限优先于该集合。没有显式用户权限时，标成只读的工具可以得到允许；`read_only_hint: false` 则被写入智能审批的“先询问”权限。`Auto` 模式在这份权限检查器中直接允许，`Approve` 和 `SmartApprove` 另有分支，未知候选还可能交给模型判断。审批结果随后决定请求是否可执行，需要用户决定时发布工具确认消息。[^g10][^g11][^g12][^g13]

**边界。** 这里读取的是服务提供的元数据，而非对服务动作副作用的验证。可以说“只读注解参与宿主审批”，不能说“只读注解建立了只读沙箱”。本轮没有完整核对破坏性注解在所有检查器中的消费位置，也不把未发现写成全项目忽略。[^g10][^g11]

## 5. Goose 按目录找服务，错误仍作为这次工具调用的观察返回

**事实。** 工具执行前，Goose 运行调用前 hook，再按租约目录解析模型工具名。解析结果携带服务原名与对应客户端；客户端把原名及参数交给 MCP 服务。服务级协议错误保留为错误数据，其他传输错误转为内部错误；服务返回 `is_error` 的业务错误仍是一份返回结果。运行系统将二者都按调用 ID 加入工具回复，再把工具批次的回复加入对话；调用后事件也将业务错误标记与传输错误区分为失败。因而“服务已返回”不等于“业务动作成功”，但失败有机会成为模型的新观察。[^g18][^g14][^g15][^g16][^g17]

**事实。** Goose 还会处理过大的返回文本：默认阈值为 200,000 字符，可由配置改变；超过阈值的单个文本块写入临时文件，模型改为收到文件位置。如果写文件失败，代码返回警告与原始内容。这控制的是工具**结果**体积，与第 3 项控制工具**定义**体积是不同环节。[^g19]

## 6. Cline SDK 为每个服务工具建立一个独立模型入口

**事实。** Cline 运行时构建器从设置和插件声明中注册服务，跳过禁用服务，尝试为每个启用服务创建模型工具；一个服务加载失败不会阻止其他成功工具被收集。转换器逐个把服务工具包装成 `AgentTool`：模型看到包装后的名称、说明、输入结构；包装器内部闭包保留服务名与原始工具名，执行时转给 provider。管理器和客户端是这个 provider 的具体适配实现，`McpToolDescriptor`、调用请求是数据，不是额外模型入口。[^c01][^c02][^c03][^c10][^c13]

**事实。** 默认模型名为 `服务名__工具名`；若含不兼容字符或超过 64 字符，转换器清理字符、截短并加原始名称的哈希片段。调用闭包仍使用服务原名，不靠把模型名称重新拆成两段来执行。名称规范化服务于模型接口兼容和身份区分，不代表工具业务权限已被检查。[^c04][^c03]

## 7. Cline SDK 的工具目录先显式过滤，再构造模型请求

**事实。** 会话运行系统合并扩展工具和显式配置工具，并依据通配策略、具体工具策略以及全局禁用列表过滤；策略 `enabled: false` 的工具不进入这一可用集合。Agent 构造请求时，将当前工具集合逐一映射成名称、说明和输入结构；模型前 hook 还可以替换本次请求的工具列表。[^c05][^c06][^c07]

**设计推断与待核对。** 这条已核对的 SDK 主线是显式过滤后的逐工具暴露，不能把它描述成已实现了与 Goose Code Mode 相同的按需参数发现。工具多时，先关闭无关服务或工具能缩小该集合；其他检索扩展、模型适配器或宿主 hook 是否另有选择机制，本轮未全面核对。这里没有得出“Cline 不支持工具检索”的结论。[^c02][^c03][^c05][^c07]

## 8. Cline SDK 的自动批准由宿主策略决定

**事实。** 执行前，Agent 先运行工具 hook；hook 可以改输入、覆盖策略或跳过动作。运行系统再合并通配和具体工具政策，检查是否禁用；只有有效策略中 `autoApprove === false` 时，这段逻辑才请求审批回调。回调拒绝、抛错，或需要审批却没有回调，都会导致不执行并形成错误工具结果。由此不能仅凭 SDK 的默认工具构造器推断 UI 是否会弹窗，必须给出实际宿主传入的政策和回调。[^c08][^c09][^c14]

## 9. Cline SDK 的这一转换链未把 MCP 注解带入工具对象

**事实。** 本轮追踪的 SDK `McpToolDescriptor` 仅含名称、说明、输入结构；stdio 和 HTTP 客户端读取工具目录时也只保留这些字段。包装器用这些字段生成模型工具，没有在这条转换链保留 `readOnlyHint`、`destructiveHint` 等注解。可以据此描述该链如何传递数据，不能把 Goose 的注解审批行为直接移植为 Cline SDK 的事实。[^c10][^c11][^c12][^c03]

**边界。** 这不说明 Cline 所有界面、其他 provider 或扩展都忽略注解，更不说明某个服务被标成只读就得到技术强制。比较应限定“哪条输入链消费了注解、消费后影响哪个决定”。

## 10. Cline SDK 区分抛出的调用错误与结果内容里的业务错误

**事实。** 包装后的工具调用管理器，管理器选择连接客户端；stdio 发送 `tools/call`，HTTP 客户端调用 MCP SDK 的相应方法。Agent 对抛出的异常生成外层 `isError: true` 与错误内容，再创建 `tool-result` 消息；这些消息写入 Agent 历史供后续请求使用。[^c03][^c13][^c11][^c12][^c14][^c15][^c16]

**事实与静态推断。** MCP 服务也可能正常返回含 `isError: true` 的结果对象。在这条包装链中，原始对象直接成为 `output`；Agent 的成功返回分支做的是 `result = { output }`，没有在该处分拆服务对象的 `isError` 到外层。持久化转换可以把对象序列化为 JSON，因此业务错误信息仍在输出内容中，但不能据 Agent 外层错误标记判断它已经识别所有 MCP 业务错误。上面是对这条静态组合的推导，未运行伪服务验证最终各模型适配器的展示；宿主后置 hook 也可以改结果。[^c03][^c14][^c15][^c17]

## 11. Cline SDK 的过大结果处理使用会话缓存，与缩小工具目录分开

**事实。** MCP 工具被设置为 `cache-oversized` 结果策略。Core 的调用后处理会把超过阈值的结果存入会话文本缓存；模型前消息准备给出截断预览，并附只有 `read_files` 可访问的缓存 URI，允许按行读取遗漏部分。消息构建器的默认单结果文本上限常量为 8,000 字符，并对普通 MCP 与自定义工具结果启用截断。[^c03][^c18][^c19][^c20]

**事实。** 缓存默认容量为 16 MiB，按会话隔离，显式读取可以刷新使用顺序；连续 5 个迭代未读会清理条目。缓存未命中的提示明确禁止为找回输出而重复有副作用的动作。这里的临时结果缓存不等于可跨会话依赖的长期记忆，也不能保证任意时刻都能找回完整内容。[^c21][^c22]

## 12. Cline 的目录缓存刷新与模型工具更新必须分层核对

**事实。** SDK 管理器对 `listTools` 使用默认 5 秒缓存，过期会重新调用客户端刷新。已核对的工具包装器则根据一次列举结果生成一批工具闭包；stdio 客户端接收消息时，会跳过没有数字请求 ID 的消息。本轮没有找到这条默认 SDK 链把目录变化通知自动变为当前 Agent 工具表替换的完整调用链，因而**运行中模型目录怎样更新仍待核对**，不能把缓存 TTL 写成“每 5 秒自动同步模型工具”。[^c23][^c27][^c03][^c24]

**独立旁证。** 同一提交的 VSCode `McpHub` 确实注册了工具、资源和提示列表变化通知，按服务和列表类型安排刷新；刷新流程包含防抖、旧结果代次检查、同类刷新串行化和有限失败重试。这个事实说明不能断言“Cline 没有目录变化通知支持”，但该 Hub 的刷新何时重建 SDK Agent 工具集合，仍需另沿协调器证明。[^c25][^c26]

## 可用于正文的设计追问

**设计推断。** 把服务“接通”只完成协议连接；宿主还要决定模型看见哪些能力、名称怎样对应执行者、工具变更何时生效、授权依据是什么、失败如何成为可用观察。比较 Goose 与 Cline 时，可以围绕“目录一致性、定义预算、结果预算、授权输入、错误语义”提出问题，无须做整体安全性排名。

**尚未运行的实验。** 用自建 MCP 假服务发布同名工具、超长名称、只读与破坏性注解，动态增加删除工具，并分别返回协议错误、业务错误和超长文本。固定 Goose 模式、Code Mode 开关及 Cline SDK 宿主政策，记录模型实际收到的工具定义、审批请求、服务调用参数和后续模型消息。运行记录应分别核对“目录发现”“当前 Agent 注册表”“模型当前请求”三个时点；本记录未执行这些实验。

## 一手证据

以下本地与 GitHub 链接配对；GitHub 均固定在文首提交。

[^g01]: [本地源码](../../goose/crates/goose/src/agents/extension_manager/mod.rs#L300-L341) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/mod.rs#L300-L341)。

[^g02]: [本地源码](../../goose/crates/goose/src/agents/extension_manager/lease.rs#L118-L166) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/lease.rs#L118-L166)。

[^g03]: [本地源码](../../goose/crates/goose/src/agents/mcp_client.rs#L199-L210) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/mcp_client.rs#L199-L210)。

[^g04]: [本地源码](../../goose/crates/goose/src/agents/mcp_client.rs#L358-L360) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/mcp_client.rs#L358-L360)。

[^g05]: [本地源码](../../goose/crates/goose/src/agents/extension_manager/mod.rs#L269-L298) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/mod.rs#L269-L298)。

[^g06]: [本地源码](../../goose/crates/goose/src/agents/extension_manager/lease.rs#L174-L215) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/lease.rs#L174-L215)。

[^g07]: [本地源码](../../goose/crates/goose/src/agents/state_machine/inference_preparation.rs#L24-L63) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/inference_preparation.rs#L24-L63)。

[^g08]: [本地源码](../../goose/crates/goose/src/agents/reply_parts.rs#L184-L219) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/reply_parts.rs#L184-L219)。

[^g09]: [本地源码](../../goose/crates/goose/src/agents/platform_extensions/code_execution.rs#L258-L320) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/platform_extensions/code_execution.rs#L258-L320)。

[^g10]: [本地源码](../../goose/crates/goose/src/permission/permission_inspector.rs#L50-L64) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/permission/permission_inspector.rs#L50-L64)。

[^g11]: [本地源码](../../goose/crates/goose/src/permission/permission_inspector.rs#L159-L194) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/permission/permission_inspector.rs#L159-L194)。

[^g12]: [本地源码](../../goose/crates/goose/src/config/permission.rs#L91-L106) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/config/permission.rs#L91-L106)。

[^g13]: [本地源码](../../goose/crates/goose/src/agents/state_machine/ops_tool_approval.rs#L57-L127) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_tool_approval.rs#L57-L127)。

[^g14]: [本地源码](../../goose/crates/goose/src/agents/extension_manager/lease.rs#L573-L711) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/extension_manager/lease.rs#L573-L711)。

[^g15]: [本地源码](../../goose/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L245-L258) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L245-L258)。

[^g16]: [本地源码](../../goose/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L288-L301) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L288-L301)。

[^g17]: [本地源码](../../goose/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L1071-L1105) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L1071-L1105)。

[^g18]: [本地源码](../../goose/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L418-L466) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/state_machine/ops_toolcalling.rs#L418-L466)。

[^g19]: [本地源码](../../goose/crates/goose/src/agents/large_response_handler.rs#L5-L76) · [GitHub 固定提交](https://github.com/aaif-goose/goose/blob/59e588dfd941ae129f2938deb7acf9f80b6edd02/crates/goose/src/agents/large_response_handler.rs#L5-L76)。

[^c01]: [本地源码](../../cline/sdk/packages/core/src/runtime/orchestration/runtime-builder.ts#L207-L242) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/runtime-builder.ts#L207-L242)。

[^c02]: [本地源码](../../cline/sdk/packages/core/src/runtime/orchestration/runtime-builder.ts#L279-L311) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/runtime-builder.ts#L279-L311)。

[^c03]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/tools.ts#L16-L48) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/tools.ts#L16-L48)。

[^c04]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/name-transform.ts#L4-L35) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/name-transform.ts#L4-L35)。

[^c05]: [本地源码](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L153-L181) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L153-L181)。

[^c06]: [本地源码](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L963-L1016) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L963-L1016)。

[^c07]: [本地源码](../../cline/sdk/packages/agents/src/agent-runtime.ts#L1670-L1712) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L1670-L1712)。

[^c08]: [本地源码](../../cline/sdk/packages/agents/src/agent-runtime.ts#L216-L224) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L216-L224)。

[^c09]: [本地源码](../../cline/sdk/packages/agents/src/agent-runtime.ts#L2436-L2540) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L2436-L2540)。

[^c10]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/types.ts#L3-L20) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/types.ts#L3-L20)。

[^c11]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/client.ts#L359-L400) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/client.ts#L359-L400)。

[^c12]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/client.ts#L814-L855) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/client.ts#L814-L855)。

[^c13]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/manager.ts#L168-L178) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/manager.ts#L168-L178)。

[^c14]: [本地源码](../../cline/sdk/packages/agents/src/agent-runtime.ts#L2554-L2595) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L2554-L2595)。

[^c15]: [本地源码](../../cline/sdk/packages/agents/src/agent-runtime.ts#L2628-L2635) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L2628-L2635)。

[^c16]: [本地源码](../../cline/sdk/packages/agents/src/agent-runtime.ts#L974-L983) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/agents/src/agent-runtime.ts#L974-L983)。

[^c17]: [本地源码](../../cline/sdk/packages/core/src/session/persisted-tool-result-content.ts#L9-L24) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/persisted-tool-result-content.ts#L9-L24)。

[^c18]: [本地源码](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1161-L1190) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1161-L1190)。

[^c19]: [本地源码](../../cline/sdk/packages/core/src/session/services/message-builder.ts#L260-L311) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/message-builder.ts#L260-L311)。

[^c20]: [本地源码](../../cline/sdk/packages/core/src/session/services/message-builder.ts#L29-L45) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/message-builder.ts#L29-L45)。

[^c21]: [本地源码](../../cline/sdk/packages/core/src/session/services/tool-result-cache.ts#L5-L8) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L5-L8)。

[^c22]: [本地源码](../../cline/sdk/packages/core/src/session/services/tool-result-cache.ts#L17-L83) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L17-L83)。

[^c23]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/manager.ts#L144-L165) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/manager.ts#L144-L165)。

[^c24]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/client.ts#L506-L530) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/client.ts#L506-L530)。

[^c25]: [本地源码](../../cline/apps/vscode/src/services/mcp/McpHub.ts#L765-L775) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/apps/vscode/src/services/mcp/McpHub.ts#L765-L775)。

[^c26]: [本地源码](../../cline/apps/vscode/src/services/mcp/McpHub.ts#L1022-L1072) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/apps/vscode/src/services/mcp/McpHub.ts#L1022-L1072)。

[^c27]: [本地源码](../../cline/sdk/packages/core/src/extensions/mcp/manager.ts#L17-L26) · [GitHub 固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/manager.ts#L17-L26)。
