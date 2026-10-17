<p align="center">
  <img src="docs/assets/agent-book-logo.png" alt="Agent Book" width="144">
</p>

<h1 align="center">Agent Book</h1>

<p align="center"><strong>Understand the design choices behind AI agents.</strong></p>

<p align="center">An open book in Chinese · 23 chapters · 5 system topics · Principles, mechanisms, and trade-offs</p>

<p align="center">
  <a href="https://mar-garet.github.io/agent_book/">Read the book →</a>
</p>

---

How do agents use tools, remember information, plan tasks, and work together? What does their design need to account for when tasks grow longer, tools fail, or execution stops halfway through?

**Agent Book puts design thinking first.** It starts with how agents work, then examines why they are built that way, what alternatives exist, and when each choice makes sense.

Open-source projects—including Pi, Codex, LangGraph, Deep Agents, Hermes, and OpenClaw—provide concrete cases. Source code and experiments ground the discussion, helping you apply the underlying ideas to your own systems.

## The approach

**Start with a problem.** Take memory: what deserves to be remembered? How should outdated facts expire? Which version of a rule applies to a historical task? Compare how Hermes, OpenClaw, and LangGraph handle these questions, then reason about your own storage, retrieval, and update policies.

**Explain the choices and their costs.** When should a model choose the next step, and when should the application fix the workflow? When is another agent worth the coordination cost? Each discussion connects goals and constraints to alternatives, trade-offs, and failure modes.

**Use implementation as evidence.** Code clarifies key mechanisms. Experiments reveal boundaries that intuition can miss. The prose explains the design; linked sources let you investigate further.

## Inside the book

The foundations introduce models, tools, and the agent loop, then build toward MCP, context, memory, planning, Skills, and multi-agent systems. Five deeper topics connect these concepts to system design:

| Topic | Design questions |
| --- | --- |
| **Memory** | What to store, when to retrieve it, how to update it, and where it applies |
| **Context** | What the next model call should see; how to handle long outputs, compression, and information loss |
| **Tools & MCP** | How discovery, authorization, execution, and result handling fit together; what to retry |
| **Collaboration** | When to delegate or hand off; how to divide work, reconcile evidence, and verify a shared result |
| **Reliable execution & evaluation** | How approval, recovery, trust, budgets, and task acceptance work together |

![Agent Book reader showing the foundations and five system topics](docs/assets/reader-system-topics.webp)

## Who it is for

- **New to agents?** Follow the foundations to understand how models, tools, and runtimes work together.
- **Already using agents?** Explore the mechanisms behind stale memory, lost context, and duplicate actions after retries or recovery.
- **Designing an agent system?** Compare approaches and decide what the model should control, what the application should enforce, and how to manage state, permissions, and acceptance.

You can read the book without installing a framework or obtaining a model API key. Source studies and experiment instructions provide a separate path for deeper investigation. **The book itself is currently written in Chinese.**

## Sources and experiments

Claims about project behavior link to local source material and pinned commits. Companion studies trace the relevant execution paths. **Five experiment groups, with 31 deterministic scenarios**, examine recovery, tool retries, delegation budgets, summary inputs, and acceptance rules using scripted inputs or simulated services.

Teaching scenarios, design inferences, and observed results are identified separately. The running case connects the design discussions; it has not been evaluated as an end-to-end task with a real model.

[Table of contents](book/README.md) · [Source studies](references/studies/README.md) · [Experiments & reproduction](experiments/README.md)
