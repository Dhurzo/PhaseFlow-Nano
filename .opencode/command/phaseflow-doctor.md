---
description: 'Diagnose project health — validates phases, states, files. Safe, read-only.'
tools:
  task: true
  inherit-task: true
---

Diagnose the PhaseFlow project structure and health.

Use the `phaseflow-doctor` agent to:
1. Check that `plan.md` exists and has a valid phase table
2. Verify all referenced phase files exist
3. Check `.phase` files exist and match plan.md states
4. Find orphaned files (unreferenced phases, stale checkpoints)
5. Verify CONTEXT.md and SUMMARY.md quality
6. Generate a structured health report

**Read-only — does not modify any files.**

Run after planning to validate the plan, or when phases get stuck.
