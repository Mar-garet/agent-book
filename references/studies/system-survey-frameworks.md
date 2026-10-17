# 十二个框架仓库的系统机制调查

> 更新：2026-10-17。固定提交以 SOURCES.json 为准。

本调查把同一组问题放到十二个框架仓库中，先沿入口、请求、适配器、状态与结果读取调用链，再分九个维度记录设计与代价。框架、运行系统、可选 provider、旧模块和仓库示例分别标范围；源码事实与本书设计推断分开。未运行新的项目实验，以下不包含成功率或性能排名。

循环/工具维度包含工具派发与 MCP 适配的研究边界；某仓只深化派发链时，会明确留下 MCP 传输待查范围。规划可以是显式流程、模型计划或按需能力，不能都叫同一种 Skills。评测维度区分运行时完成判据、检查函数、独立离线评测包，不用“框架正常返回”冒充业务成功。

## langchain

固定快照：`bd5b134d876ef47858beef27bd29c81eeda03293`。Python 新版 langchain_v1 主线；classic 评测作为单独包层的旁证，非新 Agent 默认接线。

调用与状态关系：调用者创建 Agent 图 → 模型节点构建 ModelRequest → 中间层可改请求 → 模型返回 → 条件边路由到 ToolNode 或结束 → 工具消息再进入模型。

### 1. 循环与工具/MCP

机制事实：模型节点从状态取消息与默认工具，构建请求，绑定模型后调用；条件边决定工具执行及回到模型。MCP 工具接入后的执行遵循此工具路径，本轮未审计独立 MCP adapter。

设计取舍：统一工具循环便于替换模型，但协议接通仍需在适配器落实业务结果。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`create_agent/model_node/_execute_model_sync`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/factory.py#L1493-L1545) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/factory.py#L1493-L1545)。

### 2. 上下文

机制事实：请求持有 state、runtime 与 messages；wrap_model_call 可包裹实际调用，系统消息在实际模型调用前拼入。

设计取舍：输入投影可与持久状态分开，排错要同时记录变换前后。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`model_node`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/factory.py#L1520-L1545) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/factory.py#L1520-L1545)。

### 3. 记忆

机制事实：工厂显式把调用者提供的 checkpointer 与 store 交给编译图，两者是不同配置项。

设计取舍：保存执行状态与保存跨任务事实可独立选后端；传入 Store 不会自动定义事实提炼与检索策略。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`graph.compile`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/factory.py#L1904-L1925) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/factory.py#L1904-L1925)。

### 4. 规划与 Skills

机制事实：显式加入中间层才注册 write_todos，并把规划说明加到模型请求；工具整体替换 todo 列表，单轮多次调用存在优先次序歧义。

设计取舍：显式计划能查看进度，任务完成仍不能由模型自行标记的 todo 状态证明；该路径不代表 SKILL.md 加载器。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`TodoListMiddleware`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/middleware/todo.py#L180-L250) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/middleware/todo.py#L180-L250)。

### 5. 协作

机制事实：工厂注册子代理流变换器，与工具调用变换器并列，用于组织输出流；这里未由变换器推导调度协议。

设计取舍：可见子过程不等于已有协调者验收；委派需应用明确子任务输入和输出。

范围：仅审计工厂接线；不据 transformer 宣称默认会启动子代理。实际追踪位置：`SubagentTransformer/graph.compile`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/factory.py#L1904-L1925) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/factory.py#L1904-L1925)。

### 6. 恢复与副作用

机制事实：interrupt_before/after 与 checkpointer 是独立交给图的参数，恢复机制由底层 LangGraph 承担。

设计取舍：节点级恢复可组合，但外部写入是否重复要看服务身份与节点边界，参见本书已有恢复实验。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`graph.compile`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/factory.py#L1909-L1925) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/factory.py#L1909-L1925)。

### 7. 权限与信任

机制事实：显式HITL中间层把工具名、参数与允许决策组成审查请求；approve 保留原调用，reject/respond 可生成答复消息。

设计取舍：审查绑定实际调用比仅提示谨慎更具体，但用户权限及服务端最终授权仍需应用落实。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_create_action_and_config/_process_decision`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py#L600-L653) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py#L600-L653)。

### 8. 预算

机制事实：显式中间层在调用前检查线程/本次计数，超额抛错或跳到结束，模型后增加计数；工厂另把 recursion_limit 设为 9999。

设计取舍：图步数、模型次数与金额是不同计数；没有挂载限额中间层不能据其存在声称默认受该限制。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`before_model/after_model`。

来源：[本地 langchain 实现](../../langchain/libs/langchain_v1/langchain/agents/middleware/model_call_limit.py#L168-L250) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain_v1/langchain/agents/middleware/model_call_limit.py#L168-L250)。

### 9. 评测与完成

机制事实：classic QA评测需要 reference 与 input，构造时校验 query/answer/result 提示变量，再调用所提供模型判分。

设计取舍：参考答案与judge适合离线质量判断，不等于新版Agent运行时自动验收业务产物。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`QAEvalChain.from_llm`。

来源：[本地 langchain 实现](../../langchain/libs/langchain/langchain_classic/evaluation/qa/eval_chain.py#L90-L135) · [固定提交](https://github.com/langchain-ai/langchain/blob/bd5b134d876ef47858beef27bd29c81eeda03293/libs/langchain/langchain_classic/evaluation/qa/eval_chain.py#L90-L135)。

## langgraph

固定快照：`41c9c22fdc83d68a2859d0c9a2b627c8615a792f`。Python 图执行核心、prebuilt ReAct、Store 与已有本书恢复研究；不把应用图策略视为框架默认 Agent。

调用与状态关系：应用定义节点与状态/归并规则 → 编译图 → Pregel 调度任务 → 节点返回写集 → 提交状态与检查点；工具节点只是可选节点。

### 1. 循环与工具/MCP

机制事实：预构建Agent按 state 解析模型输入，再调用绑定模型；若 remaining_steps 不足则产生“need more steps”回复。工具派发由 ToolNode 承担。

设计取舍：图表达控制流但需要正确路由；回复友好地结束与业务任务完成需区分。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`create_react_agent/call_model`。

来源：[本地 langgraph 实现](../../langgraph/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py#L620-L694) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py#L620-L694)。

### 2. 上下文

机制事实：配置 pre_model_hook 时优先采用 llm_input_messages，回退到 messages；工具调用历史也需校验一致性。

设计取舍：可改模型输入而保留其他状态，但钩子必须保留关键约束和请求结果对应。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_get_model_input_state`。

来源：[本地 langgraph 实现](../../langgraph/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py#L636-L665) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py#L636-L665)。

### 3. 记忆

机制事实：Store以namespace与key表达记录，get转换为GetOp批处理；search接收前缀、query、filter、limit等。

设计取舍：精确业务键与语义候选可分开；namespace校验只验证形状，不能替代租户权限。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`BaseStore.get/search`。

来源：[本地 langgraph 实现](../../langgraph/libs/checkpoint/langgraph/store/base/__init__.py#L756-L795) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/checkpoint/langgraph/store/base/__init__.py#L756-L795)。

### 4. 规划与 Skills

机制事实：流程的继续、暂停与恢复由应用节点和Command安排；interrupt按节点内次序取恢复值。此处规划是显式控制结构，不是自动推理出的任务计划。

设计取舍：显式流程可审阅，环境变化后的重规划仍需要应用/模型节点；本轮未审计Skills扩展。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`Command/interrupt`。

来源：[本地 langgraph 实现](../../langgraph/libs/langgraph/langgraph/types.py#L903-L925) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/types.py#L903-L925)。

### 5. 协作

机制事实：runner为独立任务提交 run_with_retry，按完成情况收集结果；并发任务在调度层彼此独立。

设计取舍：并行执行节省等待，但共享状态归并与外部写冲突仍需单独约定，独立调度不等于事务隔离。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`PregelRunner.tick`。

来源：[本地 langgraph 实现](../../langgraph/libs/langgraph/langgraph/pregel/_runner.py#L259-L280) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_runner.py#L259-L280)。

### 6. 恢复与副作用

机制事实：恢复会从节点开头重执行，多个interrupt按次序匹配恢复值，需开启checkpointer。

设计取舍：检查点保存进度不保存任意函数程序计数器；写入后再中断要考虑幂等与结果查询。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`interrupt`。

来源：[本地 langgraph 实现](../../langgraph/libs/langgraph/langgraph/types.py#L903-L925) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/types.py#L903-L925)。

### 7. 权限与信任

机制事实：中断把待审批值交给调用者，调用者用Command提供恢复值。框架提供暂停边界，没有从该函数推出具体审批人权限。

设计取舍：应用可加入人工准入，但恢复值还须绑定业务对象、版本与权限，模型文本不能代替批准记录。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`interrupt`。

来源：[本地 langgraph 实现](../../langgraph/libs/langgraph/langgraph/types.py#L903-L925) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/types.py#L903-L925)。

### 8. 预算

机制事实：预构建Agent对remaining_steps作阈值判断：工具调用需要预留后续执行步。

设计取舍：步预算帮助避免走到半截，不是每个子Agent共享的金额预算；重试次数还在独立策略。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_are_more_steps_needed`。

来源：[本地 langgraph 实现](../../langgraph/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py#L620-L634) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/prebuilt/langgraph/prebuilt/chat_agent_executor.py#L620-L634)。

### 9. 评测与完成

机制事实：任务正常/异常分别commit，非GraphBubbleUp的错误可走已配置error handler，再决定是否抛给调用者。

设计取舍：运行结局有可观察证据，业务完成仍需验收节点；本条研究运行判定边界，不宣称具备离线业务评分器。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`PregelRunner.tick`。

来源：[本地 langgraph 实现](../../langgraph/libs/langgraph/langgraph/pregel/_runner.py#L220-L249) · [固定提交](https://github.com/langchain-ai/langgraph/blob/41c9c22fdc83d68a2859d0c9a2b627c8615a792f/libs/langgraph/langgraph/pregel/_runner.py#L220-L249)。

## langchainjs

固定快照：`84eca2b11c0900a67775dca258ebec04f8e852a2`。TypeScript 新Agent图；classic QA单独标明；不假定Python与JS中间层实现完全等价。

调用与状态关系：createAgent装配ReactAgent → 初始化中间层状态 → 编译图invoke → 模型/工具路由 → 返回最终图状态。

### 1. 循环与工具/MCP

机制事实：无工具调用走出口；成功的returnDirect工具可直接出图，错误工具消息回到模型，配置结构输出时仍安排相应路由。

设计取舍：returnDirect减少往返，但工具返回必须携带可解释的状态，返回正文中的业务失败不会天然变成status=error。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ReactAgent.#createModelRouter/#createToolsRouter`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/ReactAgent.ts#L812-L870) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/ReactAgent.ts#L812-L870)。

### 2. 上下文

机制事实：invoke合并配置并初始化中间层状态，再把状态和配置交给内部图。

设计取舍：请求构造和图持久状态分层，审计应检查最终模型请求而非只看传入state。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ReactAgent.invoke`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/ReactAgent.ts#L1223-L1244) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/ReactAgent.ts#L1223-L1244)。

### 3. 记忆

机制事实：checkpointer与store由options显式传入编译图，没有在这一接线处自动构造持久化后端。

设计取舍：会话恢复与跨线程记录可单独配置；存储机制不决定业务记忆何时写入。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`workflow.compile`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/ReactAgent.ts#L700-L706) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/ReactAgent.ts#L700-L706)。

### 4. 规划与 Skills

机制事实：显式todo中间层加入write_todos、三态todo schema与系统说明，整个列表替换要求避免同轮并行多次写。

设计取舍：计划可见性来自状态，不构成计划正确或动作完成证明；该机制与Skill文件加载分开。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`todoListMiddleware`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/middleware/todoListMiddleware.ts#L226-L278) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/middleware/todoListMiddleware.ts#L226-L278)。

### 5. 协作

机制事实：子代理流转换器与工具流转换器在图编译时注册。

设计取舍：流中标明子过程可帮助观测，但不据此推导默认多Agent分派或全树预算；分派策略需应用接线。

范围：已读工厂与流接线；本轮未追踪所有子代理适配实现。实际追踪位置：`createSubagentTransformer`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/ReactAgent.ts#L690-L705) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/ReactAgent.ts#L690-L705)。

### 6. 恢复与副作用

机制事实：恢复交给所编译的LangGraph图与调用者配置的checkpointer；ReactAgent外壳没有给外部服务提供共同回滚。

设计取舍：复用底层图恢复降低接线成本，业务编号与去重仍需服务配合。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ReactAgent.invoke/compile`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/ReactAgent.ts#L700-L706) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/ReactAgent.ts#L700-L706)。

### 7. 权限与信任

机制事实：后置Agent中间层可显式声明跳转目标；图只允许配置的目的地，未把任意文本当控制边。

设计取舍：控制流约束能限制跳转形状，真实资源权限仍要由工具/服务落实；本轮未审计全部人工审批中间层。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`middleware graph routing`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/ReactAgent.ts#L600-L650) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/ReactAgent.ts#L600-L650)。

### 8. 预算

机制事实：摘要触发条件数组之间OR，同一条件的messages/tokens/fraction之间AND；缺少模型窗口信息时fraction条件不满足。

设计取舍：不能比较一个阈值就判断摘要时机；这是上下文预算，金额/调用上限另由运行配置负责。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`shouldSummarize`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain/src/agents/middleware/summarization.ts#L532-L585) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain/src/agents/middleware/summarization.ts#L532-L585)。

### 9. 评测与完成

机制事实：评测把examples的query/answer与predictions的result配成输入，再执行链。

设计取舍：显式参考答案便于比较，但classic评测不是新createAgent的默认结束判据。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`QAEvalChain.evaluate`。

来源：[本地 langchainjs 实现](../../langchainjs/libs/langchain-classic/src/evaluation/qa/eval_chain.ts#L38-L62) · [固定提交](https://github.com/langchain-ai/langchainjs/blob/84eca2b11c0900a67775dca258ebec04f8e852a2/libs/langchain-classic/src/evaluation/qa/eval_chain.ts#L38-L62)。

## langgraphjs

固定快照：`cc29753d529caa5eed97a65e765ba26c0f88c631`。JS Pregel核心、ToolNode、InMemoryStore；不把Python的默认错误处理直接套到JS。

调用与状态关系：应用定义StateGraph与节点 → 编译 → invoke收集stream → runner执行任务 → 返回最新values及中断信息。

### 1. 循环与工具/MCP

机制事实：按名称找工具，以ToolRuntime注入state、callId、context、store后调用；普通结果包装success消息，默认捕获普通异常生成error消息，GraphInterrupt透传。

设计取舍：JS默认错误转消息与Python快照不完全一样；模型获得修正机会，但错误转消息不自动安排重试。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ToolNode.runTool/run`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/prebuilt/tool_node.ts#L227-L278) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/prebuilt/tool_node.ts#L227-L278)。

### 2. 上下文

机制事实：从历史找AIMessage并过滤已有对应ToolMessage的call id，再并行运行剩余工具，普通结果写回messages。

设计取舍：消息层去重减少重复派发，但工具结果缺失时仍可能无法判断外部已发生的动作。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ToolNode.run`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/prebuilt/tool_node.ts#L315-L335) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/prebuilt/tool_node.ts#L315-L335)。

### 3. 记忆

机制事实：批量操作区分get、search、put，验证namespace；只有配置embeddings时才执行向量查询与打分。

设计取舍：内存Store可作机制验证，跨进程持久化要换后端；搜索配置不等于默认语义记忆。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`InMemoryStore.batch`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/checkpoint/src/store/memory.ts#L84-L145) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/checkpoint/src/store/memory.ts#L84-L145)。

### 4. 规划与 Skills

机制事实：计划推进可以由图节点和interrupt表达：缺恢复值时抛GraphInterrupt，已有值按scratchpad次序读取。

设计取舍：可暂停的人工作业流与模型自主规划不是一回事；本轮不据此判断Skills扩展是否存在。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`interrupt`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/interrupt.ts#L92-L166) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/interrupt.ts#L92-L166)。

### 5. 协作

机制事实：同条AI消息内工具通过Promise.all并发；若返回Command，则走另一路归并处理。

设计取舍：并发工具也可包装子Agent，但控制图状态与外部资源冲突不能靠Promise.all解决。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ToolNode.run`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/prebuilt/tool_node.ts#L326-L335) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/prebuilt/tool_node.ts#L326-L335)。

### 6. 恢复与副作用

机制事实：每次尝试前清空task.writes，再invoke同一个任务；AbortSignal已触发则不再重试。

设计取舍：清理的是图的待提交写集，远端副作用需幂等；本地取消信号不等于远端动作已撤销。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_runWithRetry`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/pregel/retry.ts#L67-L124) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/pregel/retry.ts#L67-L124)。

### 7. 权限与信任

机制事实：中断要求checkpointer；Zod responseSchema会解析恢复值，而JSON Schema对象只交客户端展示。

设计取舍：有表单schema不一定有服务端值验证，仍需对批准人和业务对象做应用检查。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`interrupt`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/interrupt.ts#L107-L166) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/interrupt.ts#L107-L166)。

### 8. 预算

机制事实：运行循环把maxConcurrency与signal交runner，out_of_steps时抛GraphRecursionError。

设计取舍：并发额度与图步数约束各自位置，不等于总模型请求、token或金额的共享硬上限。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_runLoop`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/pregel/index.ts#L2880-L2901) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/pregel/index.ts#L2880-L2901)。

### 9. 评测与完成

机制事实：invoke消费stream：values模式返回最新输出并带回收集到的interrupts，其他模式可返回chunks。

设计取舍：调用正常返回时仍可能含待处理interrupt；应用须看状态，不可仅以Promise兑现作业务成功。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`invoke`。

来源：[本地 langgraphjs 实现](../../langgraphjs/libs/langgraph-core/src/pregel/index.ts#L2795-L2837) · [固定提交](https://github.com/langchain-ai/langgraphjs/blob/cc29753d529caa5eed97a65e765ba26c0f88c631/libs/langgraph-core/src/pregel/index.ts#L2795-L2837)。

## autogen

固定快照：`004749e6b7102c8fd317b9b1499ce5807223c278`。Python autogen-agentchat与core；Studio评测明确属于另一包。扩展MCP Workbench仅按已读统一Workbench契约分析。

调用与状态关系：AssistantAgent接收新消息 → 更新model_context与可选memory → 调模型 → 受限工具迭代 → 返回文本/工具摘要/交接；团队管理器另决定下位发言者。

### 1. 循环与工具/MCP

机制事实：文本输出立即结束；工具列表以asyncio.gather执行；执行函数解析JSON，按Workbench列出的名称找到call_tool，传CancellationToken。

设计取舍：统一Workbench能换工具来源，服务业务错误依赖ToolResult.is_error而非自由文本。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_process_model_result/_execute_tool_call`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1149-L1225) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1149-L1225)。

### 2. 上下文

机制事实：本轮先把可选memory加入model_context，再从system_messages和model_context调用模型。

设计取舍：可替换的ChatCompletionContext决定实际历史；不能把Agent接收过的所有消息当成必然每轮全发。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`on_messages_stream/_call_llm`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L940-L964) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L940-L964)。

### 3. 记忆

机制事实：ListMemory按顺序把全部内容拼成SystemMessage，query忽略查询并返回全部记录，add追加列表。

设计取舍：极简实现便于显式注入，但没有按相似度筛选；不能用扩展向量后端的能力描述这个默认具体类。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ListMemory.update_context/query/add`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-core/src/autogen_core/memory/_list_memory.py#L104-L157) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-core/src/autogen_core/memory/_list_memory.py#L104-L157)。

### 4. 规划与 Skills

机制事实：团队选择先尝试应用selector_func，再用candidate_func过滤或排除前一发言者，最后由模型选一个speaker。

设计取舍：这里规划的是对话调度，角色选择不自动构成任务依赖图或Skill库。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`select_speaker`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_selector_group_chat.py#L152-L215) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_selector_group_chat.py#L152-L215)。

### 5. 协作

机制事实：交接结果携带所选目标、消息和工具调用相关上下文，普通工具与handoff工具分开收集。

设计取舍：责任可以切换，但父协调者是否回来验收由团队/应用设计；多份报告要核对同一任务范围。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`handoff result processing`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1364-L1405) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1364-L1405)。

### 6. 恢复与副作用

机制事实：Agent保存/加载的是model_context状态；reset清空该上下文。

设计取舍：恢复对话可继续推理，不会因此恢复任意工具的事务状态或撤销外部效果。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`save_state/load_state`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1626-L1639) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1626-L1639)。

### 7. 权限与信任

机制事实：调用传入CancellationToken并校验JSON；正常工具只能从已登记Workbench名称中选择，Workbench返回is_error被保留。

设计取舍：参数与工具目录约束了可派发动作，执行凭证、批准与资源授权仍需适配器/服务落实，不能据此称沙箱隔离。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_execute_tool_call`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1536-L1613) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1536-L1613)。

### 8. 预算

机制事实：max_tool_iterations控制顺序工具循环；达到最后迭代跳到摘要/反思阶段，默认构造值为1。

设计取舍：一轮可能并发多个工具，反思也可能额外调用模型，不能把此上限直接当全团队成本上限。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`tool iteration loop`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1149-L1278) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py#L1149-L1278)。

### 9. 评测与完成

机制事实：Studio的ModelEvalRunner把EvalTask转为UserMessage后调用模型并形成EvalRunResult；评测执行器与AgentChat日常循环分开。

设计取舍：生成一次待评输出与判定其正确属于不同环节；不能把Studio评测支持说成每个AssistantAgent默认验收。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ModelEvalRunner.run`。

来源：[本地 autogen 实现](../../autogen/python/packages/autogen-studio/autogenstudio/eval/runners.py#L81-L110) · [固定提交](https://github.com/microsoft/autogen/blob/004749e6b7102c8fd317b9b1499ce5807223c278/python/packages/autogen-studio/autogenstudio/eval/runners.py#L81-L110)。

## agent-framework

固定快照：`44fe223da7ea6853eefb7053e25c2c213a2e5c15`。Microsoft Agent Framework Python core与明确可选的_harness MemoryContextProvider；未把.NET与Python混写。

调用与状态关系：Agent.run准备AgentSession → 各ContextProvider.before_run贡献消息/说明/工具 → 客户端函数循环 → provider收尾；Workflow另按superstep分派并提交状态。

### 1. 循环与工具/MCP

机制事实：Agent运行前合并默认配置，各provider按顺序向SessionContext贡献工具和instructions，再交实际客户端。MCP连接属于专门适配层。

设计取舍：客户端与Agent装配分层，换客户端不等于工具执行、审批与上下文策略都相同。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_prepare_session_and_messages`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_agents.py#L1798-L1856) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_agents.py#L1798-L1856)。

### 2. 上下文

机制事实：provider状态放在session.state的source_id命名下；启用逐服务调用历史持久化时跳过一次性before_run的HistoryProvider加载。

设计取舍：加载所有权避免重复历史，但应用需要区分每次run与每次service call的写入时点。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_prepare_session_and_messages`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_agents.py#L1810-L1856) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_agents.py#L1810-L1856)。

### 3. 记忆

机制事实：可选memory provider重建MEMORY索引、按输入选主题，注册主题查询与write_memory；after_run保存会话、可选提炼与整理。

设计取舍：有界索引+主题按需可减少常驻正文，但这是显式provider，不能称所有Agent默认长期记忆。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`MemoryContextProvider.before_run/after_run`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_harness/_memory.py#L1202-L1268) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_harness/_memory.py#L1202-L1268)。

### 4. 规划与 Skills

机制事实：有注册Skill才注入目录和load/resource工具；有脚本时再加入脚本工具。读取和执行工具的approval mode由独立disable开关决定。

设计取舍：分层披露节省输入，首次读取有额外往返；Skill脚本是可执行能力，不能只当提示词。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`SkillsProvider.before_run/_create_tools`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_skills.py#L2642-L2692) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_skills.py#L2642-L2692)。

### 5. 协作

机制事实：workflow以superstep推进消息，迭代完成后commit共享状态，之后checkpoint；无消息即收敛。

设计取舍：确定的消息边便于组织多个executor，但没有消息只表示流程收敛，报告冲突仍要验收executor处理。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`run_until_convergence/_run_iteration`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_workflows/_runner.py#L108-L185) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_workflows/_runner.py#L108-L185)。

### 6. 恢复与副作用

机制事实：生成器结束/取消会取消并等待迭代与事件任务；未commit时discard待提交状态，成功后才创建checkpoint。

设计取舍：本地图状态可丢弃不表示外部动作回滚；在外部写入与checkpoint之间仍需业务幂等。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`run_until_convergence`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_workflows/_runner.py#L127-L174) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_workflows/_runner.py#L127-L174)。

### 7. 权限与信任

机制事实：Skills工具默认审批分支返回always_require，显式禁用才never_require；普通FunctionTool另有自己的默认。

设计取舍：读取可信Skill与执行其脚本可设不同政策；不能把Skill的默认审批推广到全部工具。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_approval_mode/_create_tools`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_skills.py#L2681-L2692) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_skills.py#L2681-L2692)。

### 8. 预算

机制事实：函数调用配置分别表达模型往返max_iterations、函数总调用与持续时长限制。

设计取舍：不同计数应组合，不能用一个图迭代数代替全部调用；共享预算仍要核对嵌套传播范围。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`FunctionInvocationConfiguration`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_tools.py#L1867-L1955) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_tools.py#L1867-L1955)。

### 9. 评测与完成

机制事实：LocalEvaluator对每项并发执行checks，必须有至少一个检查且全部通过才判pass，分别记录失败原因和分数。

设计取舍：可做无API的确定性验收，但检查集合的覆盖范围决定结论力度，关键词/工具调用发生不能替代业务正确。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`LocalEvaluator.evaluate`。

来源：[本地 agent-framework 实现](../../agent-framework/python/packages/core/agent_framework/_evaluation.py#L1525-L1584) · [固定提交](https://github.com/microsoft/agent-framework/blob/44fe223da7ea6853eefb7053e25c2c213a2e5c15/python/packages/core/agent_framework/_evaluation.py#L1525-L1584)。

## semantic-kernel

固定快照：`7a92cd4e7c2712370b8d85b687a474b2e858cdcc`。Python ChatCompletionAgent与函数自动调用；orchestration标实验性；旧semantic_text_memory单独限定，非默认新向量模块全貌。

调用与状态关系：ChatCompletionAgent先格式化instructions并准备ChatHistory → connector按FunctionChoiceBehavior进入函数循环 → Kernel查函数、校验参数、过滤调用 → 工具结果写历史 → 返回响应。

### 1. 循环与工具/MCP

机制事实：有FunctionChoiceBehavior且允许auto invoke才进入自动循环；一轮函数用asyncio.gather，Kernel把函数结果加入历史；无工具调用则返回。

设计取舍：循环在连接器层，Kernel是执行路由而非单独决策者；更换connector需重新确认自动调用语义。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`get_chat_message_contents`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/connectors/ai/chat_completion_client_base.py#L110-L173) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/connectors/ai/chat_completion_client_base.py#L110-L173)。

### 2. 上下文

机制事实：Agent先合并参数与服务配置，再格式化系统说明，加上历史；调用后从变更历史提取新工具消息，避免重复加入thread。

设计取舍：运行历史与单次请求副本不同，需要跟踪工具消息的写入所有者。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_inner_invoke/_prepare_agent_chat_history`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/agents/chat_completion/chat_completion_agent.py#L500-L581) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/agents/chat_completion/chat_completion_agent.py#L500-L581)。

### 3. 记忆

机制事实：旧SemanticTextMemory写入时检查collection、生成embedding、构造MemoryRecord并upsert；get从storage取记录。

设计取舍：存储接口接入向量后端不负责决定哪些对话值得记住，也不自动将结果送入Agent输入。

范围：旧memory模块真实路径；不概括新vector store连接器或全部SDK。实际追踪位置：`save_information/get`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/memory/semantic_text_memory.py#L40-L122) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/memory/semantic_text_memory.py#L40-L122)。

### 4. 规划与 Skills

机制事实：函数调用先解析参数并核对必需与额外字段，错误变为反馈请求模型修正，正确请求再进入执行过滤栈。

设计取舍：模型选函数可以形成逐步计划，但函数目录/插件不等同SKILL.md生命周期；本轮不据此判断Skill生态全貌。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`invoke_function_call`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/kernel.py#L370-L424) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/kernel.py#L370-L424)。

### 5. 协作

机制事实：实验性顺序编排注册成员actor，从首成员发送请求，最终CollectionActor调用result_callback收集输出。

设计取舍：固定交接顺序可解释，不能自动比较多名Agent的证据冲突；协调验收仍需显式成员或回调。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`SequentialOrchestration._start/_prepare`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/agents/orchestration/sequential.py#L104-L150) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/agents/orchestration/sequential.py#L104-L150)。

### 6. 恢复与副作用

机制事实：函数循环已加入工具消息，Agent只收集新增消息并将非工具输出通知thread，避免重复记录。

设计取舍：消息去重与执行幂等不同；这一聊天thread路径本轮未证明任意业务函数可跨进程恰好执行一次。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_drain_mutated_messages/thread.on_new_message`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/agents/chat_completion/chat_completion_agent.py#L549-L568) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/agents/chat_completion/chat_completion_agent.py#L549-L568)。

### 7. 权限与信任

机制事实：执行前构造AutoFunctionInvocationContext交过滤栈，过滤器可改变调用/终止；之后快照复制结果值再写回历史。

设计取舍：过滤器是可插入准入位置，只有应用安装并正确实现检查才构成业务授权；参数合法不表示获准。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`construct_call_stack/AUTO_FUNCTION_INVOCATION`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/kernel.py#L428-L463) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/kernel.py#L428-L463)。

### 8. 预算

机制事实：循环上限是maximum_auto_invoke_attempts；达到上限后重置function choice再做最终无函数调用请求。

设计取舍：上限限制自动工具轮，不等于模型请求总数；最后回答还有成本，需为其预留预算。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`automatic invocation loop`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/connectors/ai/chat_completion_client_base.py#L136-L175) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/connectors/ai/chat_completion_client_base.py#L136-L175)。

### 9. 评测与完成

机制事实：群聊按selection strategy选成员，按termination strategy判断完成，另受maximum_iterations限制。

设计取舍：终止策略是应用可定的完成边界，不天然证明外部产物正确；本轮核对运行时结束条件，未运行独立质量评分实验。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`invoke/termination_strategy`。

来源：[本地 semantic-kernel 实现](../../semantic-kernel/python/semantic_kernel/agents/group_chat/agent_group_chat.py#L116-L162) · [固定提交](https://github.com/microsoft/semantic-kernel/blob/7a92cd4e7c2712370b8d85b687a474b2e858cdcc/python/semantic_kernel/agents/group_chat/agent_group_chat.py#L116-L162)。

## openai-agents-python

固定快照：`9abc9182d06dbd28330af888306031269d57a175`。Python常规Runner、MCP工具转换、Session与可选sandbox Skills；已有本书委派实验另存，不追加新的模型/服务观察。

调用与状态关系：Runner持有当前Agent与RunState → 准备输入/会话 → 模型请求 → 工具/交接/最终输出三分支 → 保存结果；Agent.as_tool另启动子Runner。

### 1. 循环与工具/MCP

机制事实：Runner循环遇最终输出结束、交接换当前Agent继续，否则执行工具再进循环；模型轮以一次AI invocation计数。

设计取舍：统一循环让交接成本与状态可追踪，单次Run的轮数边界不等于整棵委派树。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`Runner.run`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/run.py#L279-L326) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L279-L326)。

### 2. 上下文

机制事实：客户端session在模型调用前接收已通过guardrail的pending input；服务管理的conversation等响应确认服务接受后才提交。

设计取舍：本地与服务历史有不同所有权，不能把同一条输入无条件写两边；压缩与恢复须保持所有权一致。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`admit_pending_input`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/run_internal/session_persistence.py#L166-L201) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run_internal/session_persistence.py#L166-L201)。

### 3. 记忆

机制事实：Session协议存会话条目，提供读、追加、弹出与清空；它保留对话历史，而非自动提炼事实的接口。

设计取舍：换后端可持久化历史，长期事实的范围、生效期与检索仍需另一层应用策略或可选能力。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`Session.get_items/add_items`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/memory/session.py#L52-L93) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/memory/session.py#L52-L93)。

### 4. 规划与 Skills

机制事实：可选sandbox Skills定义元信息与load接口，说明索引与正文按需读取分开；它不是每个普通Runner自动扫描本地文件。

设计取舍：渐进披露节省输入，路径可访问性和内容刷新要由sandbox manifest与provider保证。

范围：已读Skills模型、索引说明与load契约；不把sandbox可选能力写成全SDK默认。实际追踪位置：`Skills/SkillMetadata`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/sandbox/capabilities/skills.py#L123-L152) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/sandbox/capabilities/skills.py#L123-L152)。

### 5. 协作

机制事实：工具式委派启动子Runner并传子上限、上下文、session；返回默认final_output或自定义extractor，嵌套中断按工具身份保存。

设计取舍：子过程输出便于父Agent继续，但不能假定完整子历史全部回传；父必须获得证据位置才能验收。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`Agent.as_tool child Runner.run`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/agent.py#L1043-L1085) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/agent.py#L1043-L1085)。

### 6. 恢复与副作用

机制事实：新运行把输入、starting_agent、max_turns及服务conversation标识封装RunState；恢复路径使用保存状态而非把工具当无状态文本重试。

设计取舍：运行恢复可关联审批与工具结果，外部效果的去重仍由工具/服务契约决定。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`RunState construction`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/run.py#L834-L848) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L834-L848)。

### 7. 权限与信任

机制事实：MCP工具转换为FunctionTool，工具的needs_approval从server策略解析后写入包装器；目录过滤亦在转换前组织。

设计取舍：协议工具可参与SDK审批，但目录过滤与执行授权不同；服务端资源权限不能由模型说明替代。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`to_function_tool`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/mcp/util.py#L518-L599) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/mcp/util.py#L518-L599)。

### 8. 预算

机制事实：max_turns超过时抛特定异常（可配置处理）；None可关闭上限，一个turn是模型调用而非一条工具。

设计取舍：父子Runner各自计轮，应结合共享Usage与应用硬额度；本书已运行替身实验可见父子总调用超过父轮数。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`Runner.run max_turns`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/run.py#L309-L323) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/run.py#L309-L323)。

### 9. 评测与完成

机制事实：输入与输出guardrail是可配置可调用函数，有各自结果与tripwire；Runner文档明确只跑起始Agent输入guardrail。

设计取舍：可在运行内阻断不合格输入/输出，但事实核查和外部产物验收取决于检查函数；这不是已完成的离线效果评测。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`InputGuardrail/OutputGuardrail`。

来源：[本地 openai-agents-python 实现](../../openai-agents-python/src/agents/guardrail.py#L72-L176) · [固定提交](https://github.com/openai/openai-agents-python/blob/9abc9182d06dbd28330af888306031269d57a175/src/agents/guardrail.py#L72-L176)。

## openai-agents-js

固定快照：`9687b544c8c873080e6ff7e7d294c0b353cd9ab6`。TypeScript agents-core普通运行与可选sandbox skills；不把Python同名类的具体行为直接套用。

调用与状态关系：Runner.run持有RunState → 准备turn/工具定义 → 模型 → 解析工具/交接/最终结果 → 更新状态与session；恢复时先校验原工具接收者再执行获准请求。

### 1. 循环与工具/MCP

机制事实：恢复先preflightToolInvocations核对当前Agent与原响应，解析具体工具调用身份与批准状态，再解中断回合。

设计取舍：工具名相同不保证接收者未变；保持身份连续性比重新按当前目录随意路由更严格。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`resumeInterruptedTurn`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/runner/runLoop.ts#L243-L310) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/runner/runLoop.ts#L243-L310)。

### 2. 上下文

机制事实：构造与读取克隆item；有限读取返回末N条，顺序仍为时间顺序。

设计取舍：历史容器控制条目数量，不等同token预算或语义摘要；完整原文是否另存取决于后端。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`MemorySession.getItems`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/memory/memorySession.ts#L39-L72) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/memory/memorySession.ts#L39-L72)。

### 3. 记忆

机制事实：追加复制条目；历史事务以operationId去重，重复同id不同内容拒绝，后缀替换先核对expectedSuffix。

设计取舍：历史编辑有并发前提与去重，但它只保护该session内容；内存实现不能提供跨进程持久性或业务写入幂等。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`MemorySession.addItems/applyHistoryTransaction`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/memory/memorySession.ts#L74-L149) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/memory/memorySession.ts#L74-L149)。

### 4. 规划与 Skills

机制事实：可选sandbox Skills生成目录发现说明与按需加载相关指引，索引与Skill内容构建分层。

设计取舍：可按目录先选再读，调用者须配置sandbox能力；不能把它宣传成所有Agent默认拥有本机Skills。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`skills/renderSkillsInstructions`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/sandbox/capabilities/skills.ts#L609-L655) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/sandbox/capabilities/skills.ts#L609-L655)。

### 5. 协作

机制事实：交接完成后先setCurrentAgent并存继续状态，再由调用者处理可能失败的session追加；本地历史不再保留源Agent执行计划。

设计取舍：责任流转有明确状态边界，可降低恢复时把源工具重绑到目标Agent的风险；跨Agent验收仍需应用定义。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`resumeInterruptedTurn handoff`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/runner/runLoop.ts#L350-L388) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/runner/runLoop.ts#L350-L388)。

### 6. 恢复与副作用

机制事实：审批解出上一回合后标记其结束，工具/交接效果已完成时保存后续continuation，再做可失败的history持久化。

设计取舍：精细状态可避免只因会话写失败就重复已完成步骤；仍需区分外部服务是否真成功，SDK无法为任意API制造事务。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`resumeInterruptedTurn`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/runner/runLoop.ts#L359-L388) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/runner/runLoop.ts#L359-L388)。

### 7. 权限与信任

机制事实：hosted MCP approval按request identity解析请求id，生成approve/reject响应或交on_approval回调，并保留pending集合。

设计取舍：服务托管审批与本地函数工具审批应区分；批准应对应具体请求，不是笼统相信整个MCP文本。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`handleHostedMcpApprovals`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/runner/mcpApprovals.ts#L40-L110) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/runner/mcpApprovals.ts#L40-L110)。

### 8. 预算

机制事实：准备回合时根据RunState当前轮与maxTurns作上限判断；null允许不设此轮数限制。

设计取舍：轮数防无界循环，不能代表token金额或子Runner全部调用；恢复也要保持已计轮状态。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`prepareTurn/maxTurns check`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/runner/turnPreparation.ts#L130-L175) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/runner/turnPreparation.ts#L130-L175)。

### 9. 评测与完成

机制事实：恢复后直接最终输出且有output guardrail时，会延后相应session写入/检查点流程，等待输出检查边界。

设计取舍：工具效果已发生与最终输出可交付是两个时点；输出被拒绝不意味着工具副作用撤回。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`approved tool final output checkpoint`。

来源：[本地 openai-agents-js 实现](../../openai-agents-js/packages/agents-core/src/run.ts#L1730-L1765) · [固定提交](https://github.com/openai/openai-agents-js/blob/9687b544c8c873080e6ff7e7d294c0b353cd9ab6/packages/agents-core/src/run.ts#L1730-L1765)。

## adk-python

固定快照：`0e968189596f93a0220f8f7bc63ebe3a569765a8`。Google ADK Python当前固定快照，包含新的Skills生命周期与旧SequentialAgent废弃标记；不以在线新文档覆盖快照。

调用与状态关系：Runner加载session与InvocationContext → LlmAgent flow构造LlmRequest → 请求processors整理指令/内容/工具 → 调模型 → 工具与事件后处理 → Runner追加非partial事件。

### 1. 循环与工具/MCP

机制事实：flow持续执行单步，最终响应/无事件/partial结束；预处理后可暂停或重放之前函数调用，正常路径再请求模型并后处理。

设计取舍：执行控制与模型调用分开，不能把一次Runner启动当作只调用一次模型。MCP工具集遵循工具声明与派发层，具体传输本轮未深追。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`BaseLlmFlow.run_async/_run_one_step_async`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/flows/llm_flows/base_llm_flow.py#L332-L450) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/flows/llm_flows/base_llm_flow.py#L332-L450)。

### 2. 上下文

机制事实：按模型是否用Interactions及include_contents选择完整历史或当前turn；还保留function-call id、branch与isolation scope来构造请求。

设计取舍：服务端有历史时本地再全发可能重复；隔离分支不等于资源权限隔离。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_ContentLlmRequestProcessor.run_async`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/flows/llm_flows/context/_contents.py#L116-L178) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/flows/llm_flows/context/_contents.py#L116-L178)。

### 3. 记忆

机制事实：内存记忆按app_name+user_id分组，追加事件按id去重并尊重删除集合；查询先在锁内复制稳定快照再按词检索。

设计取舍：保存会话事件与生成长期事实不同；该后端是内存关键词机制，不能用Vertex可选RAG能力描述它。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`add_session_to_memory/add_events_to_memory/search_memory`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/memory/in_memory_memory_service.py#L99-L170) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/memory/in_memory_memory_service.py#L99-L170)。

### 4. 规划与 Skills

机制事实：程序load_skill激活Skill及其附加工具，不向对话注入说明；模型工具加载与程序激活不同。生命周期可淘汰其他bounded Skill，ephemeral按turn生效。

设计取舍：控制工具可见性还要同步说明；只激活不注入会让模型拿到工具却不知用途。正文应同时解释加载、失效和资源成本。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`load_skill/process_llm_request`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/tools/skill_toolset.py#L2449-L2500) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/tools/skill_toolset.py#L2449-L2500)。

### 5. 协作

机制事实：旧顺序Agent记录current_sub_agent以继续执行，并按子Agent列表推进；快照明确deprecated，推荐方向是Workflow但说明其尚不能作为LlmAgent sub-agent。

设计取舍：不能只按旧类名宣称当前最佳实践；迁移时需核对可嵌套层次，父子共享session也不等于共享全部输入。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`SequentialAgent._run_async_impl`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/agents/sequential_agent.py#L91-L130) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/agents/sequential_agent.py#L91-L130)。

### 6. 恢复与副作用

机制事实：Runner先处理插件回调，再追加非partial事件；flow恢复分支可按保存的函数调用重放。

设计取舍：保存事件让控制流可恢复，但外部函数效果不随事件存储原子提交；业务仍需稳定编号与结果查询。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_process_and_append_event`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/runners.py#L1534-L1560) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/runners.py#L1534-L1560)。

### 7. 权限与信任

机制事实：确认目标需在历史找原始函数调用，校验已注册、确实需要确认且与历史调用对应；其他Agent作者的请求留给其处理。

设计取舍：确认绑定调用身份比自然语言同意更可靠，身份验证与真实数据权限仍需服务层保障。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_resolve_confirmation_targets`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/flows/llm_flows/tools/_confirmation.py#L73-L168) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/flows/llm_flows/tools/_confirmation.py#L73-L168)。

### 8. 预算

机制事实：共享调用计数先增再比较正数max_llm_calls；非正限制不在该条件下强制。

设计取舍：这是调用次数而非金额或token；嵌套Agent是否共用context还需具体分派链，不能把每个配置都说成全树硬额度。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`increment_and_enforce_llm_calls_limit`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/agents/invocation_context.py#L75-L94) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/agents/invocation_context.py#L75-L94)。

### 9. 评测与完成

机制事实：轨迹评测要求expected invocations，按EXACT/IN_ORDER/ANY_ORDER比较工具调用，再合并各invocation分数。

设计取舍：同一任务可能有不同合法路径，轨迹严格匹配适合固定流程，却不能单独证明产物质量。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`evaluate_invocations/_calculate_tool_use_accuracy`。

来源：[本地 adk-python 实现](../../adk-python/src/google/adk/evaluation/trajectory_evaluator.py#L106-L174) · [固定提交](https://github.com/google/adk-python/blob/0e968189596f93a0220f8f7bc63ebe3a569765a8/src/google/adk/evaluation/trajectory_evaluator.py#L106-L174)。

## smolagents

固定快照：`96f33faaf028479119ec8d34507b47694cf14e34`。Python MultiStepAgent、ToolCallingAgent、CodeAgent本地解释器与显式MCP工具集合；不把远程executor策略写成本地默认。

调用与状态关系：MultiStepAgent.run设置任务与memory → 每步可先规划 → ToolCallingAgent调用工具或CodeAgent执行代码 → ActionStep记录观察/错误 → final_answer与可选checks结束。

### 1. 循环与工具/MCP

机制事实：工具与managed_agents合并名称表；先替换state变量并校验参数，再执行；普通工具启用输入输出sanitize，子Agent走其调用接口。

设计取舍：统一动作表达使代码/工具可组合，但sanitize不是业务权限检查，异常提示重试也不提供副作用去重。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ToolCallingAgent.execute_tool_call`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L1453-L1502) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L1453-L1502)。

### 2. 上下文

机制事实：每次把system prompt与memory.steps逐项转为模型消息，summary_mode改变表示。

设计取舍：步骤记录与本次消息投影可不同，数据增长后预算控制仍需明确，summary_mode名字不能当已验证保真摘要。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`write_memory_to_messages`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L758-L770) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L758-L770)。

### 3. 记忆

机制事实：memory保存TaskStep/ActionStep/PlanningStep，reset清除步骤并保留系统说明，提供succinct/full表示。

设计取舍：这里主要是运行经历，不是自动跨任务事实库；run(reset=False)延续步骤不等于长期记忆更新策略。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`AgentMemory/reset`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/memory.py#L214-L245) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/memory.py#L214-L245)。

### 4. 规划与 Skills

机制事实：planning_interval显式配置时，在首步及对应间隔生成规划步骤，计时并写memory。

设计取舍：专门规划请求增加成本，可用于复杂任务；本条没有把规划模板当作Skill加载生命周期。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_run_stream planning_interval`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L540-L567) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L540-L567)。

### 5. 协作

机制事实：managed agent被调用时包装task、执行自己的run，再用报告模板返回结果；可选提供工作过程摘要。

设计取舍：父拿到的是包装报告而非自动完整共享状态，是否需要回查证据由调用契约决定。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`MultiStepAgent.__call__`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L868-L890) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L868-L890)。

### 6. 恢复与副作用

机制事实：run按reset决定清空memory/monitor，state可接收additional_args，并向Python executor发送变量/工具。

设计取舍：继续同一对象可延续内存，但该机制不等于崩溃检查点或外部事务恢复；本轮未证明跨进程恢复保证。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`run/reset and _run_stream`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L468-L492) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L468-L492)。

### 7. 权限与信任

机制事实：MCP集合通过可选mcpadapt依赖导入，须trust_remote_code=True；HTTP transport限定已支持类型，再上下文管理连接生命周期。

设计取舍：显式信任门槛不等于每次业务调用审批；本地解释器另以authorized_imports和操作上限约束代码，但不是OS隔离证明。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ToolCollection.from_mcp`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/tools.py#L1025-L1058) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/tools.py#L1025-L1058)。

### 8. 预算

机制事实：主循环受max_steps限制，每步可以另有planning；达到上限后仍调用provide_final_answer产生结束答复。

设计取舍：动作步数不等于模型调用总数，规划/最终回答额外消耗要算入预算。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_run_stream/_handle_max_steps_reached`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L540-L608) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L540-L608)。

### 9. 评测与完成

机制事实：发现final answer时运行显式final_answer_checks；check失败变AgentError被当前循环记录，后续仍可继续。

设计取舍：在线check有机会阻止过早交付，默认空列表不会产生验收覆盖；应用要检查实际产物而非只检查回答语气。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`_validate_final_answer`。

来源：[本地 smolagents 实现](../../smolagents/src/smolagents/agents.py#L580-L618) · [固定提交](https://github.com/huggingface/smolagents/blob/96f33faaf028479119ec8d34507b47694cf14e34/src/smolagents/agents.py#L580-L618)。

## pydantic-ai

固定快照：`bbe2790190c2d7c704fa80a338bed9a70938f988`。pydantic_ai_slim核心与capability/toolset机制，pydantic_evals独立评测包，flight_booking仅作为显式委派示例而非默认行为。

调用与状态关系：Agent运行图准备请求与能力 → 校验预算 → 模型返回 → CallToolsNode处理输出工具/普通工具/延后工具 → 更新历史 → 类型与业务输出检查。

### 1. 循环与工具/MCP

机制事实：早结束策略下，合法非工具输出只有在同发工具均是普通function时才能优先；output/deferred调用仍进入正常处理。异常时保存已收集工具结果作为interrupted消息。

设计取舍：结束策略影响工具是否真执行，不能把模型输出调用列表当实际动作清单；部分结果需用于恢复定位。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`CallToolsNode/process_tool_calls`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/_agent_graph.py#L2650-L2705) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/_agent_graph.py#L2650-L2705)。

### 2. 上下文

机制事实：显式capability运行同步/异步history processor，复制结果到request_context.messages，也更新ctx.messages视图。

设计取舍：整理机制可减少输入，但调用者须保证工具请求响应配对和关键约束；不会因为类型正确就保留含义。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ProcessHistory.before_model_request`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/capabilities/process_history.py#L25-L65) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/capabilities/process_history.py#L25-L65)。

### 3. 记忆

机制事实：模型请求以message_history切片构造，运行状态保留历史；存储和跨任务提炼不是这个切片操作的一部分。

设计取舍：会话历史可由应用序列化与再次传入，长期规则的作用域、时效和检索需要另设计；不据该路径断言不存在记忆扩展。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ModelRequestContext/GraphAgentState message history`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/_agent_graph.py#L1918-L1929) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/_agent_graph.py#L1918-L1929)。

### 4. 规划与 Skills

机制事实：capability默认for_run复用self，可覆写获得每run实例；defer_loading时说明要到模型调用load_capability后才解析。

设计取舍：能力按需加载与每run隔离可组合，动态说明需要callable；此处是capability机制，不冒称标准SKILL.md文件加载器。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`AbstractCapability.for_run/get_instructions`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/capabilities/abstract.py#L447-L484) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/capabilities/abstract.py#L447-L484)。

### 5. 协作

机制事实：仓库示例把extraction_agent作为search_agent的工具内部调用，显式传usage=ctx.usage，再只返回结构化result.output。

设计取舍：共享计量需要调用方连接，子Agent隔离输入可减少干扰，但父要自行核实返回数据；示例不证明所有嵌套默认共享预算。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`extract_flights`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/examples/pydantic_ai_examples/flight_booking.py#L64-L79) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/examples/pydantic_ai_examples/flight_booking.py#L64-L79)。

### 6. 恢复与副作用

机制事实：工具处理异常仍把收集到的部分返回写入interrupted请求记录，避免遗留无法继续配对的历史；durable执行另有独立后端。

设计取舍：协议修补让后续请求合法，不等于查询或补偿外部效果；不能把可选Temporal/DBOS接入概括成所有run默认持久执行。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`interrupted tool result preservation`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/_agent_graph.py#L2691-L2705) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/_agent_graph.py#L2691-L2705)。

### 7. 权限与信任

机制事实：被包装工具在未approved且策略要求时抛ApprovalRequired，否则才转父工具调用。

设计取舍：审批阻止工具执行的边界明确，应用仍需绑定用户、对象与参数，恢复的批准标志不能任意跨调用复用。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ApprovalRequiredToolset.call_tool`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/toolsets/approval_required.py#L15-L32) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/toolsets/approval_required.py#L15-L32)。

### 8. 预算

机制事实：请求前校验次数与已有token/cost，响应后token/cost另检查，tool limit按projected usage检查；缺价格时cost_limit警告无法强制。

设计取舍：计量时点决定最多能阻止哪次请求；金额硬限制依赖价格资料，返回后检查不等于费用预占。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`UsageLimits.check_before_request/check_cost/check_tokens`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_ai_slim/pydantic_ai/usage.py#L577-L650) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_ai_slim/pydantic_ai/usage.py#L577-L650)。

### 9. 评测与完成

机制事实：从span tree提取本地工具按开始时间排序；ToolCorrectness用计数比较expected/actual，报告missing与extra；无span tree直接失败。

设计取舍：本地工具span看不到提供方托管动作，成功尝试/失败尝试的计数口径不同，轨迹命中仍需配产物验收。

范围：固定快照静态源码；未新增运行实验。实际追踪位置：`ToolCorrectness.evaluate`。

来源：[本地 pydantic-ai 实现](../../pydantic-ai/pydantic_evals/pydantic_evals/evaluators/agentic.py#L165-L244) · [固定提交](https://github.com/pydantic/pydantic-ai/blob/bbe2790190c2d7c704fa80a338bed9a70938f988/pydantic_evals/pydantic_evals/evaluators/agentic.py#L165-L244)。

## 用于正文的共同判断

第一，框架的稳定接口往往是状态和控制流，完整产品还要提供授权、证据持久化与验收策略。LangGraph、LangGraph JS 与 Agent Framework 的图/工作流记录进度；OpenAI SDK 的 RunState 与 Session 分别承担恢复和历史；这些都不能直接代替远端服务的结果账本。

第二，“工具”是统一的模型动作表面，后面可能是函数、MCP服务、代码解释器或子Agent。AutoGen Workbench、Smolagents managed agents 与 OpenAI Agent.as_tool 展示不同归属方式。比较时应沿同一调用身份追到执行者、结果层与再次决策的位置，而不是计算类名。

第三，预算必须按请求、工具、图步、持续时长和金额分别解释。LangChain中间层、ADK调用计数、SK自动调用上限、Smolagents动作步、Pydantic UsageLimits的检查位置各不相同；没有共同账本与原子预占，不能把它们当同一层保证。

第四，按需能力已在多个框架有真实实现，但语义不同：Agent Framework SkillsProvider提供说明/资源/脚本，ADK有激活和卸载生命周期，OpenAI SDK将Skills放在可选sandbox能力，Pydantic延后加载的是capability。正文应比较这些责任和状态，不把全部路径混成默认技能目录。

后续深化范围：独立MCP传输的超时/身份/大结果链尚未在全部十二仓逐一审计；LangChain两端的子代理流变换器只证明观测接线；本调查的运行时结束判断不能替代各仓全部评测产品研究。需要扩展时沿这里给出的具体缺口继续读，不把“未深化”写为“不支持”。
