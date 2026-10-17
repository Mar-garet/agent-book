<h1 align="center">Agent Book</h1>

<p align="center"><strong>你真的懂 Agent 吗？</strong></p>

<p align="center">理解 Agent 的工作方式与设计取舍。</p>

<p align="center">
  <a href="https://mar-garet.github.io/agent_book/?read=book%2F00-do-you-really-understand-agents"><strong>开始阅读 →</strong></a>
</p>

---

模型说“已经完成”之后，系统还需要交付可以核查的结果。工具的反馈怎样进入下一轮，哪些状态会被保存，失败后如何继续，都取决于系统的设计。

这本书沿着这些问题，对照 Pi、Codex、LangGraph 等项目的实际机制，解释不同设计的前提、代价和失效方式。

## 阅读路线

1. [看见一个 Agent 如何工作](book/01-model-agent-and-harness.md)：模型、工具与运行系统怎样配合，任务如何进入行动循环。
2. [理解 Agent 怎样接触世界](book/03-tool-calling.md)：工具调用、MCP、上下文和记忆各自承担什么责任。
3. [理解长期工作中的取舍](book/07-planning-and-methods.md)：规划、Skills 与多 Agent 怎样改变执行过程，又带来哪些成本。
4. [形成自己的判断](book/10-project-comparisons.md)：把不同项目放在同一组问题下比较，再回到真实任务的系统设计。
5. [沿真实机制深入](book/12-action-boundaries.md)：追踪动作边界、默认装配、恢复副作用、记忆更新与 MCP 宿主差异。
6. [从局部动作走向完整交付](book/17-tool-results-and-retries.md)：理解工具重试、压缩损失、委派、信任边界、预算与验收。

[查看完整目录](book/README.md)

## 从具体问题进入

- [从断点继续，为什么会再做一遍？](book/14-resume-and-side-effects.md) 看 LangGraph 的恢复过程如何影响外部动作。
- [已经记住了，为什么还要等到后来才生效？](book/15-memory-update-boundaries.md) 区分记忆写入、检索与实际加载。
- [同一个 MCP 服务，为什么进入两个 Agent 后表现不同？](book/16-mcp-host-differences.md) 比较 Goose 与 Cline SDK 怎样组织工具与执行权限。

## 研究资料

正文中的设计判断可以沿 [参考资料](references/evidence.md) 回到固定版本的实现。完整调用链保存在 [源码研究记录](references/studies/README.md)，已运行的场景保存在 [实验与复现](experiments/README.md)。

全部收录项目及版本见 [源码目录](docs/source-catalog.md)，概念说明见 [术语表](references/glossary.md)。

## 当前进度

书稿仍在完善，目前有 23 篇正文。部分机制配有源码研究与可复现实验，覆盖恢复、工具重试、委派预算、摘要输入和离线验收。跨项目的任务成功率、性能与成本评测仍待开展。

<details>
<summary>阅读界面预览</summary>

[![章节阅读界面](docs/assets/reader-chapter.webp)](https://mar-garet.github.io/agent_book/?read=book%2F14-resume-and-side-effects)

</details>

## 参与和使用

欢迎通过 [Issue](https://github.com/Mar-garet/agent_book/issues) 提出问题或纠错。补充项目机制时，请附具体版本、配置条件与出处；写作方法见 [研究约定](docs/editorial-guide.md)。

本地打开阅读站见 [使用说明](website/README.md)。上游源码作为 Git 子模块保存，可在克隆本仓库后按需下载：

<details>
<summary>下载源码</summary>

先下载用于研究的案例：

```bash
git submodule update --init --depth 1 pi langchain langgraph codex
```

需要全部收录项目时运行：

```bash
git submodule update --init --recursive --depth 1
```

各项目使用各自的许可证，入口见 [源码目录](docs/source-catalog.md)。

</details>
