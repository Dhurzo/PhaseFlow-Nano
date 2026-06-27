---
description: Plan a project by splitting it into independent, self-contained phases
argument-hint: "[project or feature description]"
tools:
  task: true
  inherit-task: true
---

Analyze the user's request and divide the work into independent, self-contained phases.

Call the `phaseflow-planner` sub-agent via `inherit-task` (preferred) or `task` (fallback) with `subagent_type="phaseflow-planner"`. Do NOT plan directly — delegate to the sub-agent.

The sub-agent will:
1. Analyze the requirements
2. Decompose the work into atomic phases (max 5-7 tasks per phase)
3. Generate `plan.md` with the phase table
4. Generate `phases/phase-X.md` for each phase

**Important:** `phaseflow-planner` NEVER executes — it only plans. To execute, use `/phaseflow-build`.
