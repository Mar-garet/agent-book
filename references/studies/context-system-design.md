# 上下文系统：结果外置与模型可见边界补充

> 研究日期：2026-10-17。方法：固定源码阅读，未运行模型任务、未运行上游测试。Pi、Deep Agents 与 Codex 版本均沿用主仓库 `SOURCES.json`；本地源码链接按主工作区解析。

本记录补充[执行边界研究](pi-deepagents-execution.md)和[Codex 工具执行研究](codex-tool-execution.md)，供上下文主章使用。比较对象不是同层产品：Pi 为核心循环与编程会话，Deep Agents 为工厂与文件中间层，Codex 为 MCP 工具输出包装器。正文中的报表排障是共同解释情境，没有在三个项目中运行任务。

## 大工具结果的外置条件

Deep Agents 文件系统中间层默认接受 `tool_token_limit_before_evict=20000`；处理函数抽取各文本块，使用字符长度与估算系数相乘后的阈值比较，不能把它当成精确分词器计数。关闭配置时直接返回原消息；未超过阈值同样原样返回。超过阈值后调用 `_offload_tool_message_content`，若该函数返回 `None`，此处理函数仍返回原消息并标记没有外置。

本地依据：[构造参数](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L1897) · [处理函数](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3500-L3569)。固定依据：[构造参数](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L1897) · [处理函数](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3500-L3569)。

外置辅助函数先调用 backend 写入原文，写入失败时返回 `None`；成功后才创建携带头尾预览与文件位置的替代消息。本地依据：[外置辅助函数](../../deepagents/libs/deepagents/deepagents/middleware/_message_eviction.py#L260-L282) · 固定依据：[外置辅助函数](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/_message_eviction.py#L260-L282)。

工具 wrapper 先处理同批文件修改冲突，然后执行工具；另有二进制内容外置路径。文本结果驱逐检查配置与工具排除项，满足条件才进入 `_intercept_large_tool_result`。不能由此推出所有工具原文都自动保存在磁盘上。文件实际归属由 backend 决定，默认 StateBackend 也不能解释成本机永久文件。

本地依据：[工具 wrapper](../../deepagents/libs/deepagents/deepagents/middleware/filesystem.py#L3835-L3850)。固定依据：[工具 wrapper](https://github.com/langchain-ai/deepagents/blob/e80fd67dfaf5ef19f11a64c5d039f18b8b0c7b27/libs/deepagents/deepagents/middleware/filesystem.py#L3835-L3850)。

**设计推断：** 文件引用提供后续访问的条件，不能证明模型已经读过原文。长期恢复能力还需核查 backend、检查点与实际保存方式。正文图 2 是建议闭环，不宣称上述 wrapper 包办版本化、检索决策与跨进程可读性。

## Codex 的 MCP 输出边界

`McpToolOutput::response_payload` 先转换 MCP 结果、规范图片细节并附加时间头，然后调用 `truncate_function_output_payload`。代码注释区分历史预算与 Code Mode 保留原始结果的路径，正文只据此讨论不同表示，未推导普通 MCP 结果存在统一原文检索入口。

本地依据：[MCP 输出](../../codex/codex-rs/core/src/tools/context.rs#L157-L213)。固定依据：[MCP 输出](https://github.com/openai/codex/blob/5009a99dfc07830ddf7464c26f310a2b8532b55d/codex-rs/core/src/tools/context.rs#L157-L213)。

## 边界与待验证项

本文没有进行真实模型的任务成功率、成本或延迟比较。规则新鲜度、证据重启可读性、日志头中尾标记、恢复后的约束完整性，都是正文提出的验证设计。唯一提及的已运行裁剪检查沿用[上下文压缩研究](context-compaction.md)与实验记录，不扩大其结论。
