# 机制实验：观察恢复边界

这里的实验让书中的设计问题可以复核。当前只有一组 LangGraph 中断与恢复实验，包含四个受控场景，没有调用模型、真实业务服务或付费 API。

实验采用已下载的本地 LangGraph、LangChain 固定源码。模拟审查服务保存在图状态之外，便于观察“业务效果已发生、节点状态尚未返回”的差异。它不提供真实网络、数据库事务或进程崩溃模拟。

## 实际观察

| 场景 | 创建请求次数 | 新建记录数 | 观察 |
| --- | --- | --- | --- |
| 同一节点先创建，再中断 | 2 | 2 | 恢复重新进入创建逻辑 |
| 创建节点完成后，另一个节点中断 | 1 | 1 | 恢复重新进入等待节点 |
| 同一节点，服务按稳定标识识别重复 | 2 | 1 | 重新请求，复用既有记录 |
| 拆分节点，创建后、节点返回前注入异常 | 2 | 2 | 没有交付结果的创建节点重新执行 |

原始输入、暂停状态、恢复状态、服务事件与环境版本保存在 [结果文件](results/langgraph-interrupt-replay.json)。这是一组确定性的机制观察，不是框架性能评测，也没有测量模型成功率。

## 复现环境

已运行环境为 Python 3.12.13、macOS arm64。源代码快照见主目录 [SOURCES.json](../SOURCES.json)，运行时第三方依赖版本见 [dependencies.lock](dependencies.lock)。本地安装的五个源码包版本另外记录在结果文件中。

在本书根目录，先准备相应源码和独立环境：

```bash
git submodule update --init --depth 1 langgraph langchain
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r experiments/dependencies.lock
uv pip install --python .venv/bin/python --no-deps \
  -e ./langgraph/libs/langgraph \
  -e ./langgraph/libs/checkpoint \
  -e ./langgraph/libs/prebuilt \
  -e ./langgraph/libs/sdk-py \
  -e ./langchain/libs/core
```

然后运行：

```bash
.venv/bin/python experiments/langgraph_interrupt_replay.py \
  --output experiments/results/langgraph-interrupt-replay.json
```

如果在独立书稿工作树中运行，可以用 `--source-root /path/to/agent_book` 指向已下载的上游源码。脚本会校验导入路径和两个仓库的 HEAD，确保与 SOURCES.json 的记录一致。更换源码快照或 Python/平台时，应重新记录运行环境与依赖。

## 结果的适用范围

检查点使用 `InMemorySaver`；暂停、异常、恢复都发生在同一进程中。服务也是模拟实现，不具备真实事务隔离。场景中的幂等行为是本书为模拟服务显式编写的业务约定，不能据此声称框架自动提供了业务幂等。

脚本关闭继承的远程追踪开关。核心验证直接检查事件与记录数，任何与预期不符的结果都会报错。构建依赖与跨平台二进制分发不属于本次锁文件的覆盖范围。

[对应正文](../book/14-resume-and-side-effects.md) · [源码观察记录](../references/studies/langgraph-interrupt-resume.md)
