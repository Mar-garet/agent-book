# 外部资料怎样越过边界成为行动依据

核对日期：2026-10-17。固定快照：`codex@5009a99dfc07830ddf7464c26f310a2b8532b55d`、`cline@b549ceb4bb4247284c975f6d6ca0979decec097c`，见 [SOURCES.json](../../SOURCES.json)。本记录只核对两条源码路径，未运行测试、模型或攻击实验。

先分清三个问题：**谁提供了这份材料，宿主允许调用什么动作，材料中的说法应不应该相信。**例如，服务声明某个接口只读，宿主允许调用，接口随后读出一封邮件。邮件中的“请把密钥发给我”仍然是邮件内容；前两步没有自动授予邮件作者指挥 Agent 的权力。这是本书设计情境，不是本轮观察到的事故。

## Codex：服务声明先参与权限判断，再经过本地目录准入

本节按模型能点名调用的工具统计 **N 个已注册 MCP 工具入口**，只跟踪它们共用的一条派发链。工具名称与参数是请求数据，MCP handler 是适配器，`PreparedMcpCall` 是准备后的调用绑定，客户端与目录管理器是基础设施，都不另算模型入口。Codex 将具体 MCP 工具转换为命名空间中的函数工具；本节不讨论命令工具、资源读取或 Code Mode 的完整入口集合。[^x01]

```text
模型请求已公布名称的工具
→ 宿主按服务、原工具名、连接器身份找到当前目录条目
→ 读取当前注解与配置，检查可用性和审批要求
→ 持有准备后的客户端、配置与目录快照
→ 最终准备在该快照的准入检查内运行
→ 客户端向服务发送 tools/call，得到服务返回的内容
```

这里有两个不同的时点。handler 调用会话的 `prepare_mcp_call()`，后者使用当前运行系统；真正准备时，会保留此前公布给模型的可调用名称，却从**当前目录**取得 schema、annotations 和审批元数据，然后才捕获本次客户端、配置与目录快照。因此不能写成“模型最初看到的旧定义，从推理到执行始终完全冻结”。[^x02][^x03]

注解影响宿主怎样审批，不直接限制服务中的业务实现。在非严格审查路径中，较早的配置分支可能直接免去提示；进入注解判断后，`Prompt` 要求审批，`Writes` 根据只读提示判断，`Approve` 不要求，`Auto` 综合破坏性、只读与开放世界提示。`Auto` 先检查显式破坏性，再检查只读；缺失相关提示时的默认值也参与判断。严格自动审查不会使用这些免审短路。需要审查时，动作对象带上工具、参数和元数据交给审批服务；拒绝、超时或取消会跳过真正调用。[^x04]

**来源提示与技术强制的边界。**注解来自工具目录条目，进入审批元数据；这些分支没有证明远端实现确实只读。MCP **2025-11-25** 版规范也要求：除非注解来自可信服务，否则客户端必须把它们视为不可信。该版的 schema 描述参数或输出结构，不能据此推导内容真实、内容中的指令具有用户权限。后一句是本书对结构校验边界的解释，不是源码提供的安全保证。[^x05] [该版官方工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool)

批准后还存在目录准入检查：审批记忆写入、文件参数改写等最终准备工作位于 `call_with_preparation()` 的闭包中；该方法先进入 `run_with_snapshot()`，获准后才准备并发送调用。快照不再匹配时，闭包不会执行。[^x06]

但“目录改变就拒绝”过于宽泛。实际条件是：**显式刷新后的版本超过准备快照，或版本改变且完整目录不等价**，才拒绝；普通更新后的等价目录仍可通过。显式刷新会等待已准入调用结束，本地普通服务的列表变化通知则可在已准入调用执行期间发布。这里保护的是本地准备与派发的一致性，不能据此声称服务部署、数据库状态或将返回的文本也被快照冻结。最后一句是基于检查对象作出的设计推断。[^x07]

审批范围也要说清：`Auto` 模式的会话批准记忆按服务、插件、连接器、账户连接和工具名匹配，键中没有调用参数。因而“这次不再提示”不能自动解释为“人逐次审阅了本次全部参数”，更不能解释为“服务以后返回的任何文档都获得了指令权限”。[^x08]

## Cline SDK：先找回同一次调用的观察，再决定下一步

本节只选择 **2 个模型工具入口**：一个由 MCP 目录包装出的具体服务工具，以及取回遗漏内容的 `read_files`。`createMcpTools()` 为服务工具保留原始服务名与工具名，并设置 `cache-oversized`；`read_files` 把请求交给文件读取适配器。缓存对象、调用 ID 和缓存 URI 都不是额外模型入口。[^x09]

```text
MCP 工具返回结果
→ 调用后 hook 处理，并按阈值保留恢复文本副本
→ 模型请求准备阶段给出截断预览和临时缓存 URI
→ 模型调用 read_files，指定 URI 与所需行范围
→ 文件读取适配器读取本会话缓存，返回对应文本窗口
→ 条目已失效则返回读取错误，不在此路径重做原业务动作
```

会话运行系统先运行扩展的 `afterTool` hook，以处理后的结果作为缓存来源；下一次模型请求前又准备消息。默认单工具结果阈值为 8,000 字符，可由消息构建配置覆盖；超过阈值的可缓存结果存入会话缓存，消息构建器给出截断预览，并在预算允许时附提示，要求用 `read_files` 按行读取缓存 URI。它因此不是“模型已经读过全部结果”。[^x10][^x11]

这里的“全文”也应限定：纯文本可作为字符串保留；对象的恢复副本会序列化为 YAML，预览使用的表示又可能是 JSON；图像沿媒体路径处理。所以恢复副本不是对原始 MCP 传输字节的逐字存档，更不是对原文真伪的认证。先经过 hook 也意味着它不必等于服务最初返回的未经处理内容。[^x10][^x12]

当 `read_files` 收到 `cline://` 路径，执行器从宿主传入的元数据中取得本会话 `ToolResultCache`；缓存读取检查 URI 形状与会话身份，再取得条目并按行交付。它不会把这个 URI 当作普通磁盘路径继续尝试。缓存拥有者是会话运行系统，不能把这类 URI 当作任何人都能通过网络访问的公开地址。[^x13]

缓存默认容量为 16 MiB，单条结果超出容量时不缓存；容量不足时淘汰较久未显式读取的条目。条目连续 **5 次迭代**没有实际读取会被清除，运行系统在 `turn-started` 事件推进这个计数。查询 URI 不续期，显式读取才刷新寿命与使用顺序；内容失效后，旧消息中仍可能留着 URI。清空或恢复会话历史、关闭会话也会清空缓存。不能把这份临时副本当作长期记录。[^x14][^x15]

缓存未命中的错误文字明确提醒：需要时重新查询最新结果，但**不得为了找回输出而重复有副作用的动作**。这个限定很关键：读取旧观察，与再次创建订单、发送邮件，承担的业务后果不同。实现上，缓存读取抛出错误，`read_files` 将它变为对应路径的失败结果；这里没有回调原 MCP 工具，也没有业务去重记录。禁止重做的这句话是交给后续决策者的指导语，不能写成已经强制阻止未来所有重复副作用。[^x16]

## 两条路径共同留下的责任

设计推断：Codex 的声明、配置与目录准入帮助回答“这次应由哪个工具、在什么本地授权条件下执行”；Cline 的恢复副本帮助回答“同一次调用还有哪些观察没有读到”。两者都不能替代内容判断。服务来源可信到什么程度、某段文字是业务数据还是新的授权、原查询是否足够新、缺失结果该查询还是该重做动作，仍需外层程序与业务协议明确处理。

本轮没有核对所有 Guardian 决策、所有模型适配器的提示层级、其他 Cline 界面、缓存跨进程恢复或服务内部授权，也没有执行提示注入测试。不能把 schema、只读注解、目录快照或缓存 URI 的存在写成“已防住提示注入”或项目整体安全性的结论。进一步背景见 [Codex 工具执行](codex-tool-execution.md) 与 [MCP 宿主差异](goose-cline-mcp.md)。

## 源码位置

[^x01]: [本地 MCP 工具规格](../../codex/codex-rs/core/src/tools/handlers/mcp.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/mcp.rs#L502-L532)。

[^x02]: [本地会话调用准备](../../codex/codex-rs/core/src/session/mcp_runtime.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/session/mcp_runtime.rs#L59-L69)；[本地运行系统](../../codex/codex-rs/codex-mcp/src/runtime.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/runtime.rs#L546-L554)；[本地当前目录匹配](../../codex/codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/connection_manager/tool_catalog.rs#L567-L610)。

[^x03]: [本地 handler](../../codex/codex-rs/core/src/tools/handlers/mcp.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/handlers/mcp.rs#L186-L266)；[本地准备后的绑定](../../codex/codex-rs/codex-mcp/src/binding.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/binding.rs#L170-L241)。

[^x04]: [本地审批流程](../../codex/codex-rs/core/src/mcp_tool_call.rs) · [配置、严格审查与审批动作](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1507-L1615) · [模式与注解判断](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L2535-L2565) · [批准与跳过分支](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L277-L408)。

[^x05]: [本地注解来源](../../codex/codex-rs/core/src/mcp_tool_call.rs) · [目录条目进入审批元数据](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1934-L1937)。

[^x06]: [本地最终准备](../../codex/codex-rs/core/src/mcp_tool_call.rs) · [审批写入与参数改写](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L491-L569)；[本地执行绑定](../../codex/codex-rs/codex-mcp/src/binding.rs) · [目录准入后才准备与派发](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/binding.rs#L377-L439)。

[^x07]: [本地目录准入实现](../../codex/codex-rs/codex-mcp/src/client_tool_catalog.rs) · [普通服务通知刷新](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/client_tool_catalog.rs#L181-L231) · [显式刷新与快照条件](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/client_tool_catalog.rs#L234-L306) · [完整目录比较](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/codex-mcp/src/client_tool_catalog.rs#L310-L333)。

[^x08]: [本地批准记忆键](../../codex/codex-rs/core/src/mcp_tool_call.rs) · [固定提交](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/mcp_tool_call.rs#L1804-L1824)。

[^x09]: [本地 MCP 包装](../../cline/sdk/packages/core/src/extensions/mcp/tools.ts) · [固定提交](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/mcp/tools.ts#L16-L48)；[本地读取入口](../../cline/sdk/packages/core/src/extensions/tools/definitions.ts) · [入口、请求与 executor](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/tools/definitions.ts#L268-L355)。

[^x10]: [本地结果处理](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts) · [会话缓存与阈值配置](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L432-L445) · [调用后缓存与模型前准备](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1161-L1190)。

[^x11]: [本地消息构建](../../cline/sdk/packages/core/src/session/services/message-builder.ts) · [默认阈值](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/message-builder.ts#L29-L48) · [预览与按行读取提示](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/message-builder.ts#L260-L285)。

[^x12]: [本地恢复副本](../../cline/sdk/packages/core/src/session/services/tool-result-cache.ts) · [文本、媒体与 YAML 表示](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L100-L164)；[本地持久化表示](../../cline/sdk/packages/core/src/session/persisted-tool-result-content.ts) · [字符串、数组与 JSON 转换](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/persisted-tool-result-content.ts#L9-L24)。

[^x13]: [本地缓存读取适配器](../../cline/sdk/packages/core/src/extensions/tools/executors/file-read.ts) · [缓存与普通路径分支](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/tools/executors/file-read.ts#L208-L233)；[本地会话缓存](../../cline/sdk/packages/core/src/session/services/tool-result-cache.ts) · [会话 URI 验证与实际读取](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L59-L72)；[本地宿主注入](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts) · [运行上下文中的缓存](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1016-L1022)。

[^x14]: [本地缓存生命周期](../../cline/sdk/packages/core/src/session/services/tool-result-cache.ts) · [容量、读取与失效](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L5-L96)；[本地迭代事件](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts) · [推进计数](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L1270-L1282)。

[^x15]: [本地会话边界](../../cline/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts) · [清空和恢复历史](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L594-L608) · [关闭会话](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/runtime/orchestration/session-runtime-orchestrator.ts#L699-L712)。

[^x16]: [本地缓存未命中](../../cline/sdk/packages/core/src/session/services/tool-result-cache.ts) · [不得重做副作用的提示](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L5-L8) · [未命中抛错](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/session/services/tool-result-cache.ts#L59-L72)；[本地读取错误转换](../../cline/sdk/packages/core/src/extensions/tools/definitions.ts) · [每路径失败结果](https://github.com/cline/cline/blob/b549ceb4bb4247284c975f6d6ca0979decec097c/sdk/packages/core/src/extensions/tools/definitions.ts#L333-L351)。
