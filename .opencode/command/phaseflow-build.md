---
description: Execute plan phases sequentially (backend, logic, DB, APIs)
argument-hint: "[optional phase number]"
tools:
  task: true
  inherit-task: true
---

Execute the plan phases one at a time, in order.

Call the `phaseflow-builder` sub-agent via `inherit-task` (preferred) or `task` (fallback) with `subagent_type="phaseflow-builder"`. Do NOT execute phases directly — delegate to the sub-agent.

The sub-agent will:
1. Read `plan.md` and detect the next `PENDING` or `IN_PROGRESS` phase
2. Execute the phase tasks
3. Verify completion criteria
4. Update `plan.md` with the result

**For UI/Frontend phases**, use `/phaseflow-build-visual` instead.
After each completed phase, it is recommended to run `/phaseflow-review`.
