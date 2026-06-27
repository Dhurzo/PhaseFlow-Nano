# 🔄 PhaseFlow Nano — Flows & State Machine

> **Extracted from the main README** for a focused reference on execution flows, state transitions, and the resilience model.

---

## Workflow

### Manual mode (one phase at a time)

```
┌─────────────────┐
│ phaseflow-explorer   │  ← Only if the project already has code
│ (investigate)    │
└────────┬────────┘
         │ explore-report.md
         ▼
┌─────────────────┐
│ phaseflow-planner    │  ← Plans phases
│ (plan)           │
└────────┬────────┘
         │ plan.md + phases/*.md
         ▼
┌─────────────────────┐     ┌──────────────────────┐
│ phaseflow-builder   │────▶│ phaseflow-reviewer    │
│ or                  │     │ (audit deliverables)  │
│ phaseflow-builder-  │     └──────────────────────┘
│   visual            │
│ (execute)           │
└────────┬────────────┘
         │ outputs/phase-X/
         ▼
    More phases? → repeat execute + review
```

### Automated mode (fire and forget)

```
┌──────────────────────┐
│ phaseflow-orchestrator    │  ← Single command
│ (auto-pilot)          │
└──────────┬────────────┘
           │ reads plan.md
           ▼
       ┌──────────┐     ┌──────────┐
       │ builder  │────▶│ reviewer │  ← Fresh context per invocation
       │(inherit- │     │(inherit- │     via sub-agents (inherits model)
       │  task)   │     │  task)   │
       └────┬─────┘     └────┬─────┘
            │                │
            │         ┌──────┘
            │         ▼
            │    ┌──────────┐
            │    │ REQUIRES │── retry (up to 3×) ──→ builder (fix)
            │    │ _FIX?    │       │
            │    └────┬─────┘  exhausted (>3×)
            │         │ NO          │
            │         ▼             ▼
            │    ┌──────────┐  ┌──────────┐
            │    │ REVIEWED │  │  ERROR   │
            │    └────┬─────┘  └──────────┘
            │         │             │
            └────┬────┘        Stop & Report
                 ▼
           More phases? ──→ loop

     builder failure ──→ ┌──────────┐
                         │ BLOCKED  │
                         │ / ERROR  │
                         └──────────┘
                               │
                          Stop & Report
```

---

## Quick Start

### 1. Greenfield project (from scratch)

```
User: "Plan a REST API with Express and SQLite"

→ Invoke /phaseflow-plan
→ phaseflow-planner generates plan.md + phases/
→ (optional) Invoke /phaseflow-refine phase-N.md to clarify vague phases
→ Invoke /phaseflow-build for phase 1
→ Invoke /phaseflow-review after phase 1
→ Repeat builder + reviewer for each phase
```

### 2. Existing project

```
User: "I want to add JWT authentication to my project"

→ Invoke /phaseflow-explore
→ phaseflow-explorer generates explore-report.md
→ Invoke /phaseflow-plan (reads explorer's report)
→ phaseflow-planner generates informed plan.md + phases/
→ (optional) Invoke /phaseflow-refine phase-N.md to clarify vague phases
→ Normal phase execution with /phaseflow-build + /phaseflow-review
```

### 3. Fully automated (after planning)

```
User: "/phaseflow-orchestrate"

→ Orchestrator reads .phase files, finds next pending/in_progress/completed phase
→ Invokes phaseflow-builder via inherit-task (inherits model)
→ Builder completes phase → writes .phase → completed
→ Orchestrator invokes phaseflow-reviewer via inherit-task
→ Reviewer audits → writes .phase → reviewed (or requires_fix)
→ Repeat until all phases are terminal
→ (plan.md table is a derived view — run `phaseflow-doctor --fix` to regenerate if needed)
```

> 💡 Use **`/phaseflow-status`** at any point to check progress:
> ```
> /phaseflow-status
> → Phase 1: REVIEWED ✅
> → Phase 2: IN_PROGRESS ⏳
> → Phase 3: PENDING
> → Next: Resume Phase 2 or wait for it to complete
> ```

```
User: "/phaseflow-orchestrate --gsd"

→ Same as above, plus after all phases complete:
→ Orchestrator reads SUMMARY.md files and updates GSD state:
   - .planning/STATE.md  → progress bar, last activity, decisions
   - .planning/ROADMAP.md → marks [ ] → [x] for completed phases
   - .planning/PROJECT.md → appends key decisions table
```

---

## State Machine

### Single source of truth

State is stored in **one canonical place**:

1. **`outputs/phase-X/.phase`** — programmatic state (lowercase, one word, no newline). This is the **only** source of truth. Every agent reads from it and writes to it.

2. **`plan.md` table** — **derived view**. It is regenerated from `.phase` files by `phaseflow-doctor --fix`. Agents do NOT write to plan.md's state table — they only write `.phase`.

### States

| `.phase` content | Meaning | Terminal? | Who sets it |
|------------------|---------|:---------:|-------------|
| `pending` | Phase created, never executed | No | `phaseflow-planner` |
| `in_progress` | Builder executing, or paused (check remaining-tasks.md/CHECKPOINT.md) | No | `phaseflow-builder` |
| `completed` | Builder finished successfully, awaiting review | No | `phaseflow-builder` |
| `reviewed` | Passed review ✅ | **Yes** | `phaseflow-reviewer` |
| `requires_fix` | Reviewer found critical bugs — needs fix cycle | No | `phaseflow-reviewer` |
| `blocked` | Missing dependencies or information | **Yes** | `phaseflow-builder` |
| `error` | Unrecoverable failure | **Yes** | `phaseflow-builder` / `phaseflow-orchestrator` |

> **Terminal states** (`reviewed`, `blocked`, `error`) stop all builder/reviewer processing for that phase. The orchestrator only touches them to clean up counter files (Step 4.5). No builder or reviewer will ever execute them again.
> **PAUSED has been removed.** The `in_progress` state + `remaining-tasks.md` file covers both running and paused — no separate PAUSED state needed.

### Transitions

```
  ┌──────────┐    ┌─────────────┐    ┌───────────┐    ┌──────────┐
  │ PENDING  │───▶│ IN_PROGRESS │───▶│ COMPLETED │───▶│ REVIEWED │ ✅
  └──────────┘    └─────────────┘    └─────┬─────┘    └──────────┘
        │              │                    │
        │              │  (resume possible)  │
        │              │                    │
        │              │                    │
        │              │              ┌─────┴─────┐
        │              │              │           │
        │              │         ┌────────┐  ┌──────────┐
        │              │         │REQUIRES│  │ REVIEWED │
        │              │         │_FIX    │  │          │
        │              │         └───┬────┘  └──────────┘
        │              │             │
        │              │      ┌──────┴──────┐
        │              │      │  auto-retry  │
        │              │      │  up to 3×    │
        │              │      └──────┬──────┘
        │              │             │
        │              │      ┌──────▼──────┐
        │              │      │  COMPLETED   │
        │              │      │  (rebuild)   │
        │              │      └─────────────┘
        │              │
        ▼              ▼
  ┌────────┐    ┌─────────┐
  │BLOCKED │    │  ERROR   │
  └────────┘    └─────────┘
```

### What each agent does with states

| Agent | Reads from `.phase` | Writes to `.phase` | Writes to `plan.md`? |
|-------|---------------------|-------------------|---------------------|
| `phaseflow-planner` | — | `pending` | ❌ (only creates initial structure) |
| `phaseflow-builder` | `pending`, `in_progress`, `requires_fix` | `in_progress` → `completed` / `blocked` / `error` | ❌ (plan.md is a derived view) |
| `phaseflow-reviewer` | `completed` | `reviewed` or `requires_fix` | ❌ (plan.md is a derived view) |
| `phaseflow-orchestrator` | All states (loop) | `error` (when retries exhausted) | ❌ (delegates to sub-agents) |
| `phaseflow-doctor --fix` | All states | — | ✅ **only** — regenerates table from .phase |

### Invocation priority

When the builder or orchestrator reads `.phase` files to find the next phase, it checks states in this order:

```
1. in_progress  → resume (crashed mid-execution or paused; check CHECKPOINT.md / remaining-tasks.md)
2. pending      → execute (first one found)
3. completed    → review (via phaseflow-reviewer)
4. requires_fix → fix (re-execute builder)
5. Any terminal → stop
```

### Auto-retry on REQUIRES_FIX

When the reviewer sets a phase to `REQUIRES_FIX`, the orchestrator automatically re-invokes the builder with the same phase. The builder reads `outputs/phase-X/REVIEW.md` and fixes the flagged issues.

**Retry counter** (stored in `outputs/phase-X/.retry-count`):

```
Phase: COMPLETED → reviewer → REQUIRES_FIX
       → read .retry-count (N=0) → write 1 → builder (fix)
       → COMPLETED → reviewer → REQUIRES_FIX again
       → read .retry-count (N=1) → write 2 → builder (fix)
       → COMPLETED → reviewer → REQUIRES_FIX again
       → read .retry-count (N=2) → write 3 → builder (fix)
       → COMPLETED → reviewer → REQUIRES_FIX again
       → read .retry-count (N=3) → N >= 3 → ERROR
```

- Maximum **3 fix attempts** per phase.
- Counters are persisted in files (survive crashes).
- If the phase reaches `REVIEWED` at any point, the counter resets.
- A **global loop limit** (`.loop-count`) caps total dispatches per phase at **8**, which covers 1 initial build + 1 initial review + 3 fix cycles × 2 dispatches = 8.

### Pause / resume

Any phase in `in_progress` can be paused via `/phaseflow-stop`:

```
in_progress ──/phaseflow-stop──▶ in_progress (writes remaining-tasks.md)
in_progress ──phaseflow-builder──▶ resumes from remaining-tasks.md / CHECKPOINT.md
```

There is no separate `PAUSED` state. The `in_progress` state + `remaining-tasks.md` signals a pause. The builder checks for `remaining-tasks.md` (user-initiated pause) or `CHECKPOINT.md` (token-bailout checkpoint) on resume.

The builder also auto-pauses when its context window is nearly full (≤25% remaining), saving a checkpoint to `outputs/phase-X/CHECKPOINT.md` for clean resume.
