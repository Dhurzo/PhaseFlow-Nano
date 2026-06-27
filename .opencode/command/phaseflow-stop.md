---
description: 'Pause the current phase safely — writes remaining-tasks.md for clean resume'
---

Pause the currently executing PhaseFlow phase. This command:

1. Reads `plan.md` to find the phase in `IN_PROGRESS` state
2. Reads `outputs/phase-X/CHECKPOINT.md` (if it exists) to capture current progress
3. Writes `outputs/phase-X/remaining-tasks.md` with the resume state
4. Updates `outputs/phase-X/.phase` to `in_progress` (already should be; ensures consistency) and adds reason to `plan.md`

**Execute these steps directly (no sub-agent needed):**

### Step 1 — Read plan.md

Read `plan.md` from the current project directory. Find the phase row with state `IN_PROGRESS`. If none exists, report that no phase is currently running and stop.

Extract: phase number, phase name, and phase file path.

### Step 2 — Read CHECKPOINT.md (if exists)

Read `outputs/phase-X/CHECKPOINT.md` (where X is the phase number from Step 1).

If it exists, extract the completed tasks list and the "Next task" field.
If it does not exist, note that no checkpoint was saved — the phase may not have started any tasks yet.

### Step 3 — Write remaining-tasks.md

Write `outputs/phase-X/remaining-tasks.md` with the following format:

```md
# Remaining Tasks — Phase X: [Name]

## Status
- Paused at: [current date and time]
- Reason: Manual pause via /phaseflow-stop

## Progress
- Completed tasks: [list from CHECKPOINT.md, or "None yet"]
- Next task to resume: [from CHECKPOINT.md, or "Phase start"]

## Resume Notes
[Any context that would help the builder resume cleanly.
If CHECKPOINT.md existed, mention it was read for the checkpoint data.
If not, note that the phase had not started any tasks.]
```

Create the `outputs/phase-X/` directory if it doesn't exist.

### Step 4 — Update .phase and plan.md

1. Verify `outputs/phase-X/.phase` contains `in_progress`. If not, write `in_progress` to it (ensures consistency).
2. Edit `plan.md` to update the Result column with: `Paused by /phaseflow-stop. See outputs/phase-X/remaining-tasks.md for resume point.`
3. Keep the plan.md state as `IN_PROGRESS` (not PAUSED — state `in_progress` + remaining-tasks.md signals pause).

### Step 5 — Report

Inform the user that the phase has been paused:
- Which phase was paused
- What progress was captured (tasks completed vs pending)
- To resume, run `/phaseflow-build` or `/phaseflow-orchestrate`
