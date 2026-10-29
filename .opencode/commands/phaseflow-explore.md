---
description: Explore and analyze the existing codebase before planning — optional project path
---

Explore the current project to identify the tech stack, patterns, file structure, and technical debt.

Call the `phaseflow-explorer` sub-agent via `inherit-task` (preferred) or `subagent` (fallback) with `agent="phaseflow-explorer"`. Do NOT explore directly — delegate to the sub-agent.

The sub-agent performs the analysis and generates `explore-report.md` in the project root.

**When to use:** Before planning on a project that ALREADY has code. If the project is empty (greenfield), it is not needed.
