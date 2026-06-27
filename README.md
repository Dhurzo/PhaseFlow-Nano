# 🧠 PhaseFlow Nano

<p align="center">
  <img src="assets/logo.svg" width="160" height="160" alt="PhaseFlow Nano logo">
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-plugin-8B5CF6)](https://opencode.ai)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/dhurzo/phaseflow-nano/pulls)

**Multi-agent system for [OpenCode](https://opencode.ai) optimized for local models with 10K–30K context windows.**  
Zero runtime dependencies. Pure markdown agents. ~1.8K–10.7K tokens per agent (see [Token Budget](#token-budget)).

Inspired by [Oh-My-OpenAgent](https://github.com/code-yeongyu/oh-my-openagent) (62K ⭐) and [GSD](https://github.com/rokicool/gsd-opencode) but reimagined for **local and small models** running on consumer hardware. No TypeScript, no build step, no 200K context required.

**This project prioritizes simplicity above all else.** Every design decision — markdown agents, file-based state, sequential phases, zero dependencies — is a deliberate choice to keep the system understandable, debuggable, and easy to modify by anyone, even without TypeScript experience.


## Status

⚠️Early development, for now it is experimental⚠️ 

I will be improving this, because it is a side project to accelerate other project developments.

---

## Features

- 🪶 **~5.7K–14.6K tokens per invocation** (agent file + AGENTS.md) — fits comfortably in 16K+ context windows; tight but workable in 10K with light agents
- 🔌 **Zero runtime dependencies** — core is pure markdown (one optional 145-line plugin)
- 🧠 **8 specialized agents** — explorer, planner, builder (x2), reviewer, orchestrator, refiner, doctor
- 🔁 **Auto-retry on REQUIRES_FIX** — orchestrator re-invokes builder with REVIEW.md up to 3×
- 🩺 **Project doctor** — `/phaseflow-doctor` diagnoses phase structure, states, and file consistency (read-only)
- ⏸️ **Safe pause/resume** — `/phaseflow-stop` pauses phases gracefully; builder resumes from `remaining-tasks.md`
- 📝 **Phase templates** — 6 pre-built templates (`templates/`) reduce planning tokens by ~40%
- 🔗 **CONTEXT.md auto-propagation** — phase outputs (ports, schemas, decisions) flow automatically to next phase
- 💾 **Checkpoint per task** — resumes interrupted phases without context loss
- 🤖 **Unattended mode** — orchestrator runs builder → reviewer loop automatically
- 📊 **`/phaseflow-status`** — glance project progress (phases, states, next step) without reading files
- 📋 **Progressive summarization** — each phase includes a `## TL;DR` section; orchestrator reads only TL;DR for final report, keeping context under 3K tokens
- 🧩 **Per-project or global** — works in any OpenCode project
- 🔄 **Model inheritance** — sub-agents use the model you selected in the TUI
- ❓ **Smart questioning** — planner and refiner ask targeted questions when requirements are vague

---

> See **[`INSTALL.md`](INSTALL.md)** for requirements, installation (4 options), opencode.json configuration, the model-inheritance plugin, and the full commands reference.

---

## Flows & State Machine

> The complete workflow diagrams, state machine reference, auto-retry logic, and pause/resume mechanics have moved to **[`FLOWS.md`](FLOWS.md)**.
>
> **Quick links:**
> - [Manual mode & Automated mode diagrams](FLOWS.md#workflow)
> - [Quick start scenarios](FLOWS.md#quick-start)
> - [State table & transitions](FLOWS.md#state-machine)
> - [Auto-retry on REQUIRES_FIX](FLOWS.md#auto-retry-on-requires_fix)
> - [Pause / resume](FLOWS.md#pause--resume)



> See [`INSTALL.md → Model-Inheritance Plugin`](INSTALL.md#model-inheritance-plugin) for plugin details.

---

## Why Local Models?

| Challenge | How PhaseFlow Nano solves it |
|-----------|------------------------------|
| **Small context (10K-30K tokens)** | Each agent file is 1.8K–10.7K tokens (see [Token Budget](#token-budget)). Only ONE agent loads at a time. Phases are self-contained files — the session never accumulates history. Designed deliberately for 10K–30K context windows — no 200K context required. |
| **No cloud dependency** | Works fully offline with Ollama, LM Studio, or any OpenAI-compatible local server. No API keys needed. |
| **Consumer GPU / CPU inference** | Optimized for 12B-30B models (Qwen, Ministral, DeepSeek-R1-distill, GPT OSS, Gemma 4,...) with 10K–30K context. No 200K context required. |
| **Context fragmentation** | State lives in `plan.md` and files, not in the LLM's memory. Resets between phases = no degradation. |
| **Multiple models** | Use a cheap/fast model for planning, a stronger one for building. Each agent can use a different local model. |

### Token Budget

Agent file sizes (plain text, no frontmatter) at ~3:1 byte→token ratio:

| Agent | Bytes | Tokens (~3:1) |
|--------|------|:---:|
| phaseflow-planner | 24,914 | ~8,305 |
| phaseflow-builder | 32,169 | ~10,723 |
| phaseflow-builder-visual | 9,003 | ~3,001 |
| phaseflow-orchestrator | 14,948 | ~4,983 |
| phaseflow-reviewer | 7,215 | ~2,405 |
| phaseflow-explorer | 5,876 | ~1,959 |
| phaseflow-refiner | 6,220 | ~2,073 |
| phaseflow-doctor | 5,439 | ~1,813 |
| AGENTS.md | 11,531 | ~3,844 |
| **Per invocation** (agent + AGENTS.md, range) | **16,970 – 43,700** | **~5,657 – ~14,567** |

PhaseFlow Nano is designed for **10K–30K context windows**.  
- **10K**: Tight — only works with light agents (doctor, explorer, refiner). Avoid builder/orchestrator.  
- **16K**: Comfortable for most phases with room for tool output.  
- **30K**: Plenty of headroom for complex phases, large file reads, and tool responses.

With a 30K context window, you have ~15K–24K tokens left for the phase content and tools.
With 10K, only light agents fit — use a larger model or split phases further for heavy work.

> 💡 The token increase vs previous versions comes from the new **auto-context propagation**, **checkpoint/resume**, **pre-flight validation**, **REQUIRES_FIX auto-retry**, and **smart questioning** features. These make PhaseFlow Nano significantly more robust — especially for local models that need retries and checkpoint recovery.

### Model recommendations

> 📸 See **[`pocs.md`](pocs.md)** for proof-of-concept comparisons (code quality, phase accuracy, token consumption) across different local models running the same project end-to-end.

PhaseFlow Nano is designed for local models, but not all models are equally capable.
Here is what to expect depending on your hardware:

| Model size | Quality | Best for | Avoid for |
|:----------:|---------|----------|-----------|
| **7B** | ⚠️ Works only with trivial tasks. Most tasks produce poor-quality or broken code. | Simple scaffolding, exploration, doctor, status checks | Phase execution, code generation, complex planning |
| **14B** | ✅ Better quality for simple tasks. Can follow structured instructions. | Planner, reviewer, simple builder phases, exploration | Multi-step code generation, complex business logic |
| **24B–30B** | ✅ Good for mid-complexity tasks. Decent architectural approaches for complex tasks, but generated code can be broken or need fixes. | Full pipeline, builder phases, planning | High-complexity code generation without review |

#### Tested on

| Model | Role | Verdict |
|-------|------|---------|
| **Qwen 2.5 7B** | Explorer, simple builder phases | ⚠️ Usable only for trivial tasks |
| **Qwen 2.5 14B** | Planner, reviewer | ✅ Good for structured planning and review |
| **Ministral 3 14B** | Builder, reviewer | ✅ Reliable for simple-to-moderate builder phases |
| **Ministral 3 14B (reasoning)** | Planner | ✅ Produces better phase decomposition and context analysis |
| **Devstral Small 2 24B** | Full pipeline (orchestrator) | ✅ Handles moderate builder+reviewer loops well. Good architectural sense at high complexity, but generated code can be broken or incomplete — review is essential. |
| **Gemma 4 14B** | Full pipeline (orchestrator) |  ✅ Handles moderate builder+reviewer loops well. Simple solutions but good approaching. Fails on complex logic but tries to autofix the fails|
| **GPT OSS 20B** | ¿Full pipeline? | ⚠️ Usable but caotic,..., have to repeat things to get them done|

> **Tip:** Use a smaller/faster model for the explorer and reviewer, and a larger one for the planner and builder. The orchestrator lets you mix and match.

> **Tip:** Use DCP plugin instead Opencode compactation.

> **Tip:** With Qwen 3 14B / Qwen 3.5 14B and similar models, be very explicit about delegation — instead of "Plan a REST API", say "Invoke the phaseflow-planner sub-agent. Write plan.md and phases/phase-1.md in the current directory. Only write plan files, no code." These models interpret ambiguous phrasing literally and may start implementing directly instead of delegating to sub-agents.

> **Tip:** Temperatures 0.1 - 0.3 should work better.

### ⚠️ Quantization impact on tool-calling reliability

Models under 24B **with heavy quantization (Q4_K_M, Q4_0)** — especially 7B and 14B — can exhibit **unexpected behavior during planning and building**:

- **Planning**: The model may analyze the project and describe what it *would* do, but fail to execute `write` tools — no `plan.md` created, no `phases/` directory, no files generated. It responds with content instead of calling tools.
- **Building**: Similar issues during phase execution — the model describes changes instead of writing files, or writes incomplete content.
- **Root cause**: Tool-calling (structured JSON output) is one of the first capabilities to degrade under heavy quantization. Q4 compression introduces enough noise that the model's output distribution shifts, making precise tool invocations unreliable.

**Symptoms are inconsistent** — sometimes it works, sometimes it doesn't, even with the same prompt.

**Recommendation:**

| If your model is | Use a quantization of | Expected reliability |
|---|---|---|
| 7B | Q8 or FP16 | ✅ Improved, but still limited for complex tasks |
| 14B | **Q6_K or higher** (Q8_0 ideal) | ✅ Good tool-calling reliability |
| 24B+ | Q4_K_M is usually fine | ✅ Better tolerance to quantization |

> Quantization matters more than model size for tool-calling. A 14B at Q6_K will reliably call tools better than a 24B at Q4_K_M in many cases.

> Go below Q4 at your own risk ;D.
---

## About This Project

PhaseFlow Nano started as a **side project** to accelerate SDD (Spec-Driven Development) workflows in my personal OpenCode setup with local models. The goal was simple: break down complex builds into phases small enough that local models (7B–24B) could handle them without burning through context windows.

It is **still experimental** and evolving based on real usage. Some parts are rough, some workflows may break on edge cases, and the agent prompts are tuned through trial and error. As I use it more across different projects, the prompts, state machine, and guardrails will keep improving.

> PRs, issues, and real-world feedback are very welcome — they shape what gets fixed next.

---

> See **[`TROUBLESHOOTING.md`](TROUBLESHOOTING.md)** for solutions to common issues.
>
> **Quick links:**
> - [Token bailout — context low](TROUBLESHOOTING.md#phase-paused-with-token-bailout--context-low)
> - [Builder created a nested project](TROUBLESHOOTING.md#builder-created-a-nested-project-eg-smb3_clone-inside-my-project)
> - [Sub-agents still use the wrong model](TROUBLESHOOTING.md#sub-agents-still-use-the-wrong-model)
> - [Manual commands use the wrong model](TROUBLESHOOTING.md#manual-commands-still-use-the-wrong-model-phaseflow-build-phaseflow-plan-etc)
> - [Commands not showing up](TROUBLESHOOTING.md#commands-not-showing-up)
> - [Config validation errors](TROUBLESHOOTING.md#config-validation-errors)

---

## License

MIT

## PoC Gallery

> See [`POCS.md`](POCS.md) for proof-of-concept comparisons across different local models (code quality, phase accuracy, token consumption).
