---
description: Execute UI/Frontend phases with design sensibility (components, CSS, accessibility)
argument-hint: "[optional phase number]"
tools:
  task: true
  inherit-task: true
---

Execute phases of type UI, frontend, or visual design.

Call the `phaseflow-builder-visual` sub-agent via `inherit-task` (preferred) or `task` (fallback) with `subagent_type="phaseflow-builder-visual"`. Do NOT execute UI phases directly — delegate to the sub-agent.

The sub-agent applies:
- Quality visual design (not generic AI aesthetics)
- Mobile-first responsive design
- WCAG 2.1 AA accessibility
- Purposeful micro-interactions and animations
- Component states: loading, empty, error, success

**⚠️ Warning:** The `phaseflow-builder-visual` agent is currently **untested**. It may produce incomplete or incorrect output. Use with caution and review results carefully.

For backend/logic phases, use `/phaseflow-build` instead.
