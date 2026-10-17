# Agent Book · 源码资料库

本目录收录 32 个 GitHub 开源项目，供 Agent Book 阅读、比较和引用源码。
索引生成时间：2026-10-17 09:00:01（UTC+08:00）。

每个子目录都是独立的 Git 仓库，保存下载时默认分支的当前源码。
仓库采用浅克隆（`--depth 1`），并递归检出子模块；完整提交历史及标签尚未下载。
本次只下载源码，没有安装项目依赖、构建或启动服务。

[SOURCES.json](../SOURCES.json) 记录来源、分支、完整提交 SHA、下载时间和校验信息。
每个项目的授权范围以其仓库内的许可证文件为准。

## 编程 Agent 与开发任务执行

| 项目 | 本地源码 | GitHub 仓库 | 分支 | 下载版本 | 许可证文件 |
| --- | --- | --- | --- | --- | --- |
| Codex CLI | [codex/](../codex/) | [openai/codex](https://github.com/openai/codex) | `main` | `5009a99dfc07` | [LICENSE](../codex/LICENSE) |
| Gemini CLI | [gemini-cli/](../gemini-cli/) | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | `main` | `ed96faedfd55` | [LICENSE](../gemini-cli/LICENSE) |
| OpenCode | [opencode/](../opencode/) | [anomalyco/opencode](https://github.com/anomalyco/opencode) | `dev` | `65932e870ca5` | [LICENSE](../opencode/LICENSE) |
| Cline | [cline/](../cline/) | [cline/cline](https://github.com/cline/cline) | `main` | `b549ceb4bb42` | [LICENSE](../cline/LICENSE) |
| Aider | [aider/](../aider/) | [Aider-AI/aider](https://github.com/Aider-AI/aider) | `main` | `5dc9490bb35f` | [LICENSE.txt](../aider/LICENSE.txt) |
| Qwen Code | [qwen-code/](../qwen-code/) | [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code) | `main` | `4e2753b006bd` | [LICENSE](../qwen-code/LICENSE) |
| Pi | [pi/](../pi/) | [earendil-works/pi](https://github.com/earendil-works/pi) | `main` | `8efd314fa3d3` | [LICENSE](../pi/LICENSE) |
| OpenHands | [openhands/](../openhands/) | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | `main` | `045290739f0a` | [LICENSE](../openhands/LICENSE) |

## 通用任务、个人助理与浏览器 Agent

| 项目 | 本地源码 | GitHub 仓库 | 分支 | 下载版本 | 许可证文件 |
| --- | --- | --- | --- | --- | --- |
| Goose | [goose/](../goose/) | [aaif-goose/goose](https://github.com/aaif-goose/goose) | `main` | `59e588dfd941` | [LICENSE](../goose/LICENSE) |
| OpenClaw | [openclaw/](../openclaw/) | [openclaw/openclaw](https://github.com/openclaw/openclaw) | `main` | `ec38f535d3d5` | [LICENSE](../openclaw/LICENSE) |
| Hermes Agent | [hermes-agent/](../hermes-agent/) | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | `main` | `e31c674f7c52` | [LICENSE](../hermes-agent/LICENSE) |
| Browser Use | [browser-use/](../browser-use/) | [browser-use/browser-use](https://github.com/browser-use/browser-use) | `main` | `ccd22fef47a1` | [LICENSE](../browser-use/LICENSE) |

## Agent 框架、编排与 SDK

| 项目 | 本地源码 | GitHub 仓库 | 分支 | 下载版本 | 许可证文件 |
| --- | --- | --- | --- | --- | --- |
| LangChain Python | [langchain/](../langchain/) | [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | `master` | `bd5b134d876e` | [LICENSE](../langchain/LICENSE) |
| LangGraph Python | [langgraph/](../langgraph/) | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | `main` | `41c9c22fdc83` | [LICENSE](../langgraph/LICENSE) |
| LangChain JS/TS | [langchainjs/](../langchainjs/) | [langchain-ai/langchainjs](https://github.com/langchain-ai/langchainjs) | `main` | `84eca2b11c09` | [LICENSE](../langchainjs/LICENSE) |
| LangGraph JS/TS | [langgraphjs/](../langgraphjs/) | [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | `main` | `cc29753d529c` | [LICENSE](../langgraphjs/LICENSE) |
| Deep Agents | [deepagents/](../deepagents/) | [langchain-ai/deepagents](https://github.com/langchain-ai/deepagents) | `main` | `e80fd67dfaf5` | [LICENSE](../deepagents/LICENSE) |
| CrewAI | [crewai/](../crewai/) | [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | `main` | `40bb2d3b586e` | [LICENSE](../crewai/LICENSE) |
| AutoGen | [autogen/](../autogen/) | [microsoft/autogen](https://github.com/microsoft/autogen) | `main` | `004749e6b710` | [LICENSE](../autogen/LICENSE)、[LICENSE-CODE](../autogen/LICENSE-CODE) |
| Microsoft Agent Framework | [agent-framework/](../agent-framework/) | [microsoft/agent-framework](https://github.com/microsoft/agent-framework) | `main` | `44fe223da7ea` | [LICENSE](../agent-framework/LICENSE) |
| Semantic Kernel | [semantic-kernel/](../semantic-kernel/) | [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) | `main` | `7a92cd4e7c27` | [LICENSE](../semantic-kernel/LICENSE) |
| OpenAI Agents SDK Python | [openai-agents-python/](../openai-agents-python/) | [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | `main` | `9abc9182d06d` | [LICENSE](../openai-agents-python/LICENSE) |
| OpenAI Agents SDK JS/TS | [openai-agents-js/](../openai-agents-js/) | [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | `main` | `9687b544c8c8` | [LICENSE](../openai-agents-js/LICENSE) |
| Google Agent Development Kit | [adk-python/](../adk-python/) | [google/adk-python](https://github.com/google/adk-python) | `main` | `0e968189596f` | [LICENSE](../adk-python/LICENSE) |
| Smolagents | [smolagents/](../smolagents/) | [huggingface/smolagents](https://github.com/huggingface/smolagents) | `main` | `96f33faaf028` | [LICENSE](../smolagents/LICENSE) |
| Pydantic AI | [pydantic-ai/](../pydantic-ai/) | [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | `main` | `bbe2790190c2` | [LICENSE](../pydantic-ai/LICENSE) |
| Agno | [agno/](../agno/) | [agno-agi/agno](https://github.com/agno-agi/agno) | `main` | `6e4348233832` | [LICENSE](../agno/LICENSE) |
| AgentScope | [agentscope/](../agentscope/) | [agentscope-ai/agentscope](https://github.com/agentscope-ai/agentscope) | `main` | `976e2ffc9c28` | [LICENSE](../agentscope/LICENSE) |
| CAMEL | [camel/](../camel/) | [camel-ai/camel](https://github.com/camel-ai/camel) | `master` | `e5e55256e944` | [LICENSE](../camel/LICENSE) |
| LlamaIndex | [llama-index/](../llama-index/) | [run-llama/llama_index](https://github.com/run-llama/llama_index) | `main` | `619d74664e84` | [LICENSE](../llama-index/LICENSE) |
| Mastra | [mastra/](../mastra/) | [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | `main` | `f8cb6873cfa2` | [LICENSE.md](../mastra/LICENSE.md) |

## 长期记忆 Agent

| 项目 | 本地源码 | GitHub 仓库 | 分支 | 下载版本 | 许可证文件 |
| --- | --- | --- | --- | --- | --- |
| Letta | [letta/](../letta/) | [letta-ai/letta](https://github.com/letta-ai/letta) | `main` | `5bcdd177d70f` | [LICENSE](../letta/LICENSE) |

## 后续更新

进入某个项目目录后，可运行 `git pull --ff-only` 获取该分支的新提交。
含子模块的项目随后运行 `git submodule update --init --recursive --depth 1`。
需要研究完整提交历史时，在对应项目中运行 `git fetch --unshallow`。

更新源码后，下载快照索引仍记录本次版本，适合用作 Agent Book 的引用基线。
下载日志和原始校验记录保存在 `.downloads/` 中。

## 首轮阅读补充

Letta 当前主分支主要是迁移入口，README 指向 `letta-ai/letta-code`；这份新实现尚未下载。本地 `letta/` 保留原快照，不能直接当作完整当前运行内核。OpenHands 当前主仓库介绍 Agent Canvas，实际任务由可选 Agent 后端执行。详见 [研究范围](../references/evidence.md)。
