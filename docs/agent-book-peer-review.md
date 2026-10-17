# 同类 Agent 开源书与课程比较

调查日期：2026-10-17。本次读取四个仓库的 README，进一步阅读 Hello-Agents 的框架构建与记忆章、Hugging Face 的首个工具循环和最终评测说明、Microsoft 的入门章、记忆章与学习指南。结论针对这些材料，不代表读完四套课程；未运行对方示例，也不以 star 数推断内容质量。

## 核心判断

这些项目最值得借鉴的是：读者很快就知道自己将做出什么，以及下一步如何开始。本书的优势则在另一处：围绕同一系统问题比较不同开源实现，用源码与故障场景解释选择的条件和代价。这个定位已经存在于[项目比较](../book/10-project-comparisons.md)、[记忆专题](../book/15-memory-update-boundaries.md)与[实验目录](../experiments/README.md)，此前入口没有把它具体展示出来。

本书不必为了看起来更全面，再复制一套从零造框架的课程；需要把“读完能作什么设计判断”讲得更实，优先补齐设计的前提、替代方案、代价与适用边界。这是本次材料比较后的编辑判断，不是对课程效果的实测排名。

## 四种不同的学习承诺

| 项目 | 内容结构与受众 | 具体学习产物 | 与本书的主要区别 |
| --- | --- | --- | --- |
| Hello-Agents | 先补 Agent 与 LLM 基础，再实现范式、使用平台和框架；随后扩展自建 HelloAgents，进入记忆、上下文、协议、训练与综合应用。预期有 Python 基础和 LLM API 概念。[H1] | 逐步扩展同一个教学框架，最后连接到旅行、研究、小镇等应用与毕业项目。第八章还把记忆与 RAG 接入文档问答助手。[H2][H3] | 它用“亲手造出应用”串联学习；本书用“同一问题有哪些实现与取舍”组织专题。它覆盖的模型训练与综合应用，不是本书目前的重点。[H1][L1] |
| Hugging Face Agents Course | 基础概念 → smolagents、LlamaIndex、LangGraph → 应用 → 最终项目；明确要求 Python 与 LLM 基础。[F1] | 第一单元用简化工具循环解释运行过程；最终项目连接 GAIA 子集、提交接口与学生榜单。[F2][F3] | 概念很快接到可运行的模型调用；本书先提供可核查的机制观察，尚无对应的真实模型完整任务评测。[F2][L2] |
| Microsoft AI Agents for Beginners | 按工具、RAG、规划、协作、生产、上下文、记忆等模式分课；学习指南另外按目标推荐路线。主要样例围绕 Microsoft Agent Framework 与 Foundry，README 说明云端主路径需要 Azure 账户。[M1][M2] | 每课提供文字、代码及部分视频。记忆课明确链接 Mem0/Azure AI Search 与 Cognee 两套 notebook。[M1][M3] | 它对“如何在选定技术栈做出来”指引更直接；本书的比较跨越运行系统、应用与框架，需要更清楚地告诉读者比较范围及结论如何迁移。[L1] |
| LLM Agents From Scratch | Manning 书籍的配套代码库；按工具、LLM、Agent、MCP、Skills、记忆、人类介入、子代理与 A2A 逐章扩展教学实现。[N1] | 逐章 notebook、综合项目入口，以及 README 链接的 notebook 运行状态页。[N1] | 它把“从头搭建”变成清晰的累积产物。该仓库不能当作免费完整书：README 明确引导购买 Manning Early Access 正文。[N1] |

表中列的是作者提供的学习材料与承诺，不是本次验证过的运行质量。付费模型、在线服务、账户条件及运行状态仍应以相应版本的设置说明为准。

## 从代表章节看到的差异

### 记忆：做成一个功能，与判断怎样设计，是两种价值

Hello-Agents 第八章从四类记忆及存储实现走向 RAG 与文档问答界面；Microsoft 第十三课从记忆类型进入具体集成 notebook。它们使读者容易想象“我会得到一个怎样的程序”。[H3][M3]

本书记忆专题追踪的是另一条链：信息写到哪里、当前运行怎样加载、后续更新何时生效，以及历史事实与未来规则怎样分开。Hermes、OpenClaw、LangGraph 提供不同层次的比较对象，正文进而讨论个人助手、团队规则与长期任务的设计。[L3] 这种价值应在入口用具体讲法展示，而不能只说“深入理解记忆”。

### 开始运行：环境指引必须服务于一个立即可见的问题

Hugging Face 在第一单元直接展示工具描述、模型输出、工具执行与观察回填；其教学代码明确使用推理服务和令牌。最后的评测说明则给出取题、提交与答案比对方式。[F2][F3] Microsoft 的学习指南把不同目标映射到具体课号，减少读者从长目录中自行判断的成本。[M2]

本书已有无模型的离线验收脚本，但原先入口主要是实验清单和环境复现，第一眼容易显得像研究附件。将“同样一句完成，为何分别等待、拒绝和通过”放到首次运行入口，能先让读者看见问题；它仍只是人工构造输入上的应用规则检查，不能称为已运行的 Agent。[L2]

### 可信度：代码可运行与任务效果有效，需要分别证明

Hugging Face 的最终评测材料公开了题目子集、提交方式、精确答案匹配以及榜单的核验局限；nerdai 的 README 则链接 notebook 运行状态，并区分已经提供和待完成的综合项目。[F3][N1] 值得借鉴的是把验证对象说清，而不是把某个分数或自动化徽章搬来。

本书已有固定源码提交、依赖锁、原始记录和 31 个确定性场景。这能支撑恢复、重试、预算与裁剪等局部机制结论；不能代替真实模型在完整任务中的表现，更不能证明教学案例 R42 已经端到端运行。[L2][L4]

## 本轮已经落实的调整

以下内容已经核对本次工作区文件，不是后续设想：

- [README](../README.md) 明确“开源实现与系统设计”的定位，以记忆展示“先比较，再设计”的讲法，增加实际阅读器截图，并把具体设计选择写入专题表格。
- [阅读路线](../book/README.md) 增加从零入门、准备设计系统、定位失败三种目标路径，并分开说明阅读与源码实验的先修要求。
- [实验入口](../experiments/README.md#先运行一个无需模型的样例) 增加 Python 标准库样例、运行命令和三种结果对照；明确它不调用模型、不要求子模块，也不代表 Agent 实际完成报表任务。调查中再次直接运行脚本，九个构造样例正常输出，记录为 `model_calls: 0`；未覆盖随书原始结果。

## 仍需补齐与应当保留的取舍

后续建议限定为四项，避免把本书改成无边界的课程合集：

1. **保留横向比较的主线。** 持续回答“什么前提下选哪种设计”，避免按框架依次介绍 API；这是相对逐章造框架课程更鲜明的阅读理由。[L1][L3]
2. **先补设计论证，再按论断需要安排实验。** 正文优先回答为什么选这种机制、还有哪些替代方案、条件变化后怎样调整。若要讨论真实任务表现，再固定模型、工具、数据、授权边界与验收口径，公开对应运行证据。当前 31 个机制场景与 R42 教学情境均不能替代这种证据。[L2][L4]
3. **让更多专题交付可观察的中间产物。** 例如记忆更新前后的记录、压缩前后的模型输入、恢复前后的业务记录。优先连接既有实验与来源，再决定是否需要新增小型实现；不必先自建一整套框架。[L2][L3]
4. **按可复核程度扩展，而不是按题目数量扩展。** 新增线上演示、模型案例或性能结论时，同步环境、版本与运行记录。模型训练、毕业设计、证书和榜单不是目前必须补齐的内容；先把系统设计这条承诺兑现。[L4]

## 查询版本与来源

以下为查询时 GitHub 默认分支的固定提交。不同课程会持续更新；本报告不以更新后的页面反推此版本行为。

- Hello-Agents：`36f583c233ea5cee4537ef93455702b55053af18`，提交日期 2026-10-13。
  - [H1：README、目录、先修与学习建议](https://github.com/datawhalechina/hello-agents/blob/36f583c233ea5cee4537ef93455702b55053af18/README.md)。
  - [H2：第七章，构建智能体框架](https://github.com/datawhalechina/hello-agents/blob/36f583c233ea5cee4537ef93455702b55053af18/docs/chapter7/第七章%20构建你的Agent框架.md)。
  - [H3：第八章，记忆与检索](https://github.com/datawhalechina/hello-agents/blob/36f583c233ea5cee4537ef93455702b55053af18/docs/chapter8/第八章%20记忆与检索.md)。
- Hugging Face：`3c469e773ec04e5f338b727ff20e3a6ea823ff81`，提交日期 2026-10-06。
  - [F1：README 与目录](https://github.com/huggingface/agents-course/blob/3c469e773ec04e5f338b727ff20e3a6ea823ff81/README.md)。
  - [F2：第一单元，Dummy Agent Library](https://github.com/huggingface/agents-course/blob/3c469e773ec04e5f338b727ff20e3a6ea823ff81/units/en/unit1/dummy-agent-library.mdx)。
  - [F3：第四单元，Hands-On](https://github.com/huggingface/agents-course/blob/3c469e773ec04e5f338b727ff20e3a6ea823ff81/units/en/unit4/hands-on.mdx)。
- Microsoft：`6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0`，提交日期 2026-10-17。
  - [M1：README 与课程材料](https://github.com/microsoft/ai-agents-for-beginners/blob/6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0/README.md)。
  - [M2：Study Guide 与按目标路线](https://github.com/microsoft/ai-agents-for-beginners/blob/6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0/STUDY_GUIDE.md)。
  - [M3：第十三课，Agent 记忆](https://github.com/microsoft/ai-agents-for-beginners/blob/6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0/13-agent-memory/README.md)。
- nerdai：`b001f17d86d4a9bb132db488086c1d41ffdccb3b`，提交日期 2026-10-17。
  - [N1：README、逐章 notebook 与运行方式](https://github.com/nerdai/llm-agents-from-scratch/blob/b001f17d86d4a9bb132db488086c1d41ffdccb3b/README.md)。
- 本书工作区材料：
  - [L1：章节结构与研究覆盖范围](../book/README.md)。
  - [L2：机制实验、复现条件与局限](../experiments/README.md)。
  - [L3：记忆系统比较与设计](../book/15-memory-update-boundaries.md)。
  - [L4：写作与研究约定](editorial-guide.md)。

[H1]: https://github.com/datawhalechina/hello-agents/blob/36f583c233ea5cee4537ef93455702b55053af18/README.md
[H2]: https://github.com/datawhalechina/hello-agents/blob/36f583c233ea5cee4537ef93455702b55053af18/docs/chapter7/第七章%20构建你的Agent框架.md
[H3]: https://github.com/datawhalechina/hello-agents/blob/36f583c233ea5cee4537ef93455702b55053af18/docs/chapter8/第八章%20记忆与检索.md
[F1]: https://github.com/huggingface/agents-course/blob/3c469e773ec04e5f338b727ff20e3a6ea823ff81/README.md
[F2]: https://github.com/huggingface/agents-course/blob/3c469e773ec04e5f338b727ff20e3a6ea823ff81/units/en/unit1/dummy-agent-library.mdx
[F3]: https://github.com/huggingface/agents-course/blob/3c469e773ec04e5f338b727ff20e3a6ea823ff81/units/en/unit4/hands-on.mdx
[M1]: https://github.com/microsoft/ai-agents-for-beginners/blob/6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0/README.md
[M2]: https://github.com/microsoft/ai-agents-for-beginners/blob/6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0/STUDY_GUIDE.md
[M3]: https://github.com/microsoft/ai-agents-for-beginners/blob/6e7a59889a2db3c1eb6489d4d812dea12c1ee4b0/13-agent-memory/README.md
[N1]: https://github.com/nerdai/llm-agents-from-scratch/blob/b001f17d86d4a9bb132db488086c1d41ffdccb3b/README.md
[L1]: ../book/README.md
[L2]: ../experiments/README.md
[L3]: ../book/15-memory-update-boundaries.md
[L4]: editorial-guide.md
