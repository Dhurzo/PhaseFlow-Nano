---
description: Execute UI/Frontend phases with design sensibility (components, CSS, accessibility) — optional phase number
---

Execute phases of type UI, frontend, or visual design.

Call the `phaseflow-builder-visual` sub-agent via `inherit-task` (preferred) or `subagent` (fallback) with `agent="phaseflow-builder-visual"`. Do NOT execute UI phases directly — delegate to the sub-agent.

The sub-agent applies:
- Quality visual design (not generic AI aesthetics)
- Mobile-first responsive design
- WCAG 2.1 AA accessibility
- Purposeful micro-interactions and animations
- Component states: loading, empty, error, success

**⚠️ Warning:** The `phaseflow-builder-visual` agent is currently **untested**. It may produce incomplete or incorrect output. Use with caution and review results carefully.

For backend/logic phases, use `/phaseflow-build` instead.
