---
description: 'Runs the full pipeline unattended — builder → reviewer loop for ALL phases.'
tools:
  inherit-task: true
  task: true
---

Runs the entire PhaseFlow Nano pipeline automatically without manual intervention.

Uses the `phaseflow-orchestrator` agent to:
1. Read `plan.md` and find the first PENDING or REQUIRES_FIX phase
2. Invoke `phaseflow-builder` (or `phaseflow-builder-visual` for Visual/Frontend phases) with the `inherit-task` tool (which inherits the current session's model)
3. Invoke `phaseflow-reviewer` to audit the completed phase
4. Repeat until all phases are REVIEWED, BLOCKED, or ERROR

**No manual steps required.** The orchestrator handles the builder → reviewer → next phase loop automatically.

For single-phase manual execution, use `/phaseflow-build` instead.
