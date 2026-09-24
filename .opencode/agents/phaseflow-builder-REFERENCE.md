---
description: >-
  Reference guide for phaseflow-builder detailed execution. Not a standalone
  agent — read this file from builder.md for expanded instructions.
---

# PhaseFlow Builder — Reference

> **This file is a reference for `phaseflow-builder.md`.** It contains the detailed execution flow, error handling, and examples. Read it when you need details beyond the condensed steps in builder.md.

---

## Phase States (Single Source of Truth)

Each phase's state is stored **only** in `outputs/phase-X/.phase` (one word per file). This is the canonical state — agents read from it, agents write to it. The `plan.md` table is a **derived view** that can be regenerated at any time via `phaseflow-doctor --fix`.

| State | `.phase` file | Meaning | Terminal? |
|-------|---------------|---------|:---------:|
| `PENDING` | `outputs/phase-X/.phase` → `pending` | The phase has not been started yet. | No |
| `IN_PROGRESS` | `outputs/phase-X/.phase` → `in_progress` | The phase is currently executing, or paused mid-execution. | No |
| `COMPLETED` | `outputs/phase-X/.phase` → `completed` | The phase has finished successfully. | No |
| `REQUIRES_FIX` | `outputs/phase-X/.phase` → `requires_fix` | Reviewer found bugs — re-execute phase to fix. | No |
| `REVIEWED` | `outputs/phase-X/.phase` → `reviewed` | Passed review ✅ | **Yes** |
| `BLOCKED` | `outputs/phase-X/.phase` → `blocked` | Missing dependencies or information. | **Yes** |
| `ERROR` | `outputs/phase-X/.phase` → `error` | Unrecoverable failure. | **Yes** |

Only one phase can be `IN_PROGRESS` at a time. `REVIEWED`, `BLOCKED`, and `ERROR` are terminal — do not touch them.

> **Resume signals:** If a phase is `in_progress` AND `outputs/phase-X/remaining-tasks.md` exists, it was paused via `/phaseflow-stop` — resume from there. If `outputs/phase-X/CHECKPOINT.md` exists instead, it crashed mid-execution — resume from checkpoint.

---

## Execution Flow — Full Detail

### Step 1 — Read the Plan & States

Use the `read` tool on `plan.md` to get the project name, goal, and phase table. The state column in plan.md is a derived view — always use .phase files for canonical state.

Then read machine-readable states from `.phase` files using ONE `read` tool call per file:

```bash
ls outputs/ | sort
```

This gives you a clean list of phase directories. Then use individual `read` tool calls:
```
read("outputs/phase-1/.phase")
read("outputs/phase-2/.phase")
```

> 🔴 **Do NOT use bash loops with nested `$()` for reading .phase files.** On Q4-quantized models, nested bash subshells (like `cat "$(basename ...)"`) reliably produce syntax errors. Use individual `read` tool calls — this is the safe pattern. Or use `ls outputs/ | sort` for the directory listing, then read each .phase file individually.

This produces clean output like:
```
1: in_progress
2: pending
3: pending
```

### Step 2 — Select Phase

> ⏹️ **You will execute ONE phase only. After you finish it, STOP.**
> Do NOT plan to continue to the next phase — that will be a separate invocation.

Using the states from `.phase` files, find the first phase (lowest ID) that matches:

1. `in_progress` → this phase to continue or resume (check for remaining-tasks.md / CHECKPOINT.md).
2. `requires_fix` → re-execute it (fix bugs from review). **REQUIRES_FIX blocks downstream phases — always fix before starting new work.**
3. `pending` → this is the next one to execute.
4. No `in_progress`, `requires_fix`, or `pending` phases:
   - If all are `reviewed` → report "Project completed" and finish.
   - If any are `completed` (not yet reviewed) → report "All phases are built but some still need review. Run `/phaseflow-review` to audit them." and STOP.
   - If any are `blocked` → report the block and DO NOT continue.
   - If any are `error` → report the error and DO NOT continue.

### 🔴 Step 2.5 — Completion Check (Prevent Infinite Loops)

**BEFORE doing anything else, check if this phase is actually already complete.**

This is the #1 cause of builder infinite loops. Models re-read the same files and re-summarize state without advancing. Break the loop here.

Run this checklist:

```
1. Does outputs/phase-X/.phase exist?
   → YES: Read it. Check the state:
      - If "completed" or "reviewed" → STOP immediately, phase is already done.
        (plan.md is a derived view — if it's stale, run `phaseflow-doctor --fix` later.)
      - If "requires_fix" → EXPECTED. SUMMARY.md exists from the original
        completion. Proceed to Step 3 to fix issues flagged in REVIEW.md.
      - If "in_progress" → continue to check 2 below.

2. Does outputs/phase-X/CHECKPOINT.md exist?
   → YES: This is a mid-execution resume. Proceed to Step 3.5.
   → NO: Continue to next check.

3. Does outputs/phase-X/CONTEXT.md already exist?
   → YES: Phase might be complete. Check if ALL tasks are done (Step 2.5.2).
   → NO: Continue to next check.

4. Phase is in_progress but nothing in outputs/phase-X/ → possible stale state.
   → Read the phase file. Check if ALL output files/tasks are verifiably complete.
   → If YES → mark COMPLETED now (write .phase) and STOP.
   → If NO (tasks remain) → proceed to Step 3.
```

#### Step 2.5.1 — Immediate Stale-State Recovery (IN_PROGRESS only)

If `outputs/phase-X/SUMMARY.md` exists but `.phase` file says `in_progress`:
- The builder completed the phase in a prior run but was interrupted before updating files
- **Verify DECISIONS.md** — check if the phase has a decision entry there. If `DECISIONS.md` is missing or has no entry for this phase, append the decisions now (reconstruct from CONTEXT.md if available, or log a warning).
- **Immediately** write `outputs/phase-X/.phase` → `completed`
- Do NOT re-execute, do NOT re-write SUMMARY.md
- Report: "Phase X was already complete (SUMMARY.md exists). Fixed stale state+DECISIONS.md."
- **STOP** — do not continue to the next phase

> 🔴 This does NOT apply to REQUIRES_FIX states. For REQUIRES_FIX, SUMMARY.md exists by design — proceed to Step 3 to fix issues.

#### Step 2.5.2 — Task-Verification Gate

If SUMMARY.md does NOT exist but the phase looks complete, verify EACH task from the phase file:

| Task type | How to verify |
|-----------|--------------|
| "Initialize project" | Check `Cargo.toml`, `package.json`, etc. |
| "Create file X" | Check if file X exists with `bash test -f` or `glob` |
| "Implement function Y" | Check if the expected source file contains the function |
| "Install dependency Z" | Check config file for dependency string |
| "Configure tool T" | Check for config file existence |
| "Verify build" | Run the build command briefly |

**Rules:**
- If ALL tasks pass verification → proceed directly to Step 7 (skip Steps 3-6 entirely)
- If ANY task fails verification → that task needs execution. Proceed to Step 3 normally
- **Do NOT trust CONTEXT.md as proof of completion** — CONTEXT.md is advisory. Verify against real files.
- **Do NOT write a CONTEXT.md block as your reasoning output** — that fills context and causes compaction loops.

### Step 3 — Mark as In Progress

**Before executing any task**, update the canonical state:

Write `outputs/phase-X/.phase` → `in_progress`

### Step 3.5 — Resume from Checkpoint (if continuing)

If resume files exist for an in-progress pause or crash:

**Priority order:** If both exist, read `remaining-tasks.md` first (more context from the pause point), then `CHECKPOINT.md` for detailed task tracking.

**If `remaining-tasks.md` exists** (paused via `/phaseflow-stop`):
1. Read the "Completed tasks" and "Next task to resume" fields
2. Resume from where they stopped
3. Log: "Resuming phase X from pause. Completed: [N] tasks. Resuming at [next task]."

**If `CHECKPOINT.md` exists** (interrupted execution):
1. Read the completed tasks list
2. Resume from the `Next task` field
3. Skip all completed tasks
4. Log: "Resuming phase X from checkpoint. Tasks [N] already completed, resuming at task [N+1]."

**After resume:**
- Ensure `outputs/phase-X/.phase` contains `in_progress` (it should already, but write if missing).

If neither file exists, proceed normally from Step 4.

### Step 4 — Read the Phase File

```
Use the read tool on phases/phase-X.md
```

Read the file COMPLETELY. Pay special attention to:
- **Required Context**: everything you need to know is here.
- **Related Files**: existing project files you MUST read for context (see Step 4.5).
- **Inputs**: files that must exist before starting.
- **Tasks**: what you must execute, in order.
- **Expected Outputs**: what you must generate.
- **Completion Criteria**: how to know if you finished correctly.

### Step 4.5 — Read Related Files (if listed)

If the phase file contains a `## Related Files` section, read each file listed there to understand its content and context. If a file does not exist, **do NOT block** — just note it and continue. Related Files are informational, not mandatory (unlike `## Inputs`).

### Step 4.6 — Verify Phase Type

Check the phase's type metadata:

- **`Backend/Logic`** → proceed normally. This is your domain.
- **`Visual/Frontend`** → **STOP.** Mark the phase as `BLOCKED` with reason: "This is a Visual/Frontend phase. Use `phaseflow-builder-visual` instead." Do NOT attempt to build UI components.
- **Missing Type** → warn but proceed (assume Backend/Logic).

### Step 4.7 — Read Project Decisions Log

Read `DECISIONS.md` to understand prior technical decisions. If the file does not exist yet (first phase or greenfield project), skip this step — you will create it in Step 8.6.

> This file prevents "decision drift": where Phase 5 unwittingly reverses a deliberate choice made in Phase 2. It also gives the reviewer context for why certain patterns may look non-standard.

### Step 4.7.5 — Read Previous Phase Summary (if not Phase 1)

If this is NOT Phase 1, read the previous phase's summary file for context:
`outputs/phase-[previous-phase-number]/SUMMARY.md`

The SUMMARY.md contains a compact bullet-point recap of what the previous phase built, what files it touched, and any `## Reviewer Notes` about intentional non-standard decisions.

If the file does not exist, skip it and continue (the phase may not have completed yet).

> This replaces 100+ lines of source code with ~20 lines of summary. It keeps context overhead tiny (≈200 tokens) while preventing "context loss" between phases.

### Step 4.8 — Detect Existing Project Structure

**Before executing any tasks, check if the project already exists in the current directory.** This step prevents DUPLICATE NESTED PROJECTS (e.g., creating `smb3_clone/` inside an existing Rust project).

1. **Scan for project markers:**

   | Language | File(s) to check |
   |----------|------------------|
   | Rust     | `Cargo.toml` |
   | Node.js  | `package.json` |
   | Python   | `pyproject.toml`, `setup.py`, `requirements.txt` |
   | Go       | `go.mod` |
   | Any      | `.git/` directory |

2. **If a project marker exists:**
   - The project is ALREADY initialized in this directory.
   - **DO NOT** run `cargo init`, `cargo new`, `npm init`, or any "initialize new project" command.
   - **DO NOT** create a subdirectory project (e.g., `cargo new my_project` inside an existing project).
   - Instead, **verify** the existing config matches the phase requirements. Update dependencies if needed.
   - Log: "Project already initialized at {dir}. Skipping init, verifying existing config."

3. **If NO project marker exists:**
   - Execute the initialization task normally.
   - **Run the init command in the CURRENT directory** (no subdirectory argument):
     - ✅ `cargo init` (initializes current dir, name = dir name)
     - ✅ `npm init -y` (initializes current dir)
     - ❌ `cargo new smb3_clone` (creates NESTED sub-project)
     - ❌ `cargo init smb3_clone` (creates NESTED sub-project)

4. **Also scan the phase's `## Related Files` section:** These files may already exist even if the planner didn't create them. If they exist, read them and skip creation tasks that are already done.

> ⚠️ **For small models (7B-14B):** Be literal in following instructions, but always check preconditions. "Initialize a new project" → first check if already initialized. "Create file X" → first check if X already exists. When in doubt, READ first, then decide.

### Step 4.9 — Read Dependency Context (CONTEXT.md)

If this phase lists dependencies (e.g., "Depends on Phase X"), read the context files from those phases automatically: `outputs/phase-X/CONTEXT.md`.

CONTEXT.md contains structured context produced by the previous phase: files created, schemas defined, ports configured, key decisions.

If the file does not exist, fall back to reading `outputs/phase-X/SUMMARY.md` (less structured, but still useful).

Also check if this phase is in `REQUIRES_FIX` state:
- Read `outputs/phase-X/REVIEW.md` to understand what the reviewer flagged
- The findings in REVIEW.md are your fix list — prioritize them over all other tasks

### Step 5 — Pre-Flight Validation

Before executing, run this checklist and STOP if ANY check fails:

1. **Inputs exist**: All files in `## Inputs` must exist. Missing input → `BLOCKED`.
2. **Related Files exist (warn only)**: Log a warning if a `## Related Files` entry is missing, but continue.
3. **Dependencies met**: If phase depends on Phase N and Phase N is not `COMPLETED` or `REVIEWED` → `BLOCKED`.
4. **Directory structure**: Verify the expected directories exist. Create them if missing and allowed by the phase.

### Step 6 — Execute Tasks

> ## 🔴 CRITICAL GUARD — PREVENT RE-EXECUTION LOOPS
>
> If you reach Step 6 and ALL phase tasks are verifiably complete
> (files exist, code compiles, build succeeds), you MUST:
> 1. NOT execute any task
> 2. NOT re-write or re-create any file
> 3. NOT generate a CONTEXT.md-like summary as reasoning output
> 4. Proceed DIRECTLY to Step 7 (Verify Completion Criteria)
> 5. If criteria are met → mark COMPLETED and STOP
>
> The most common infinite-loop pattern:
> ❌ Read plan.md → read phase file → detect all done → write reasoning summary → repeat
> ✅ Read plan.md → read phase file → detect all done → mark COMPLETED → STOP

**Before executing each task, check if it's already done:**
- If the task says "Initialize a new X project" and Step 4.8 detected an existing project → **skip init** (mark as verified, update dependencies if needed)
- If the task says "Create file X" and file X already exists with correct content → **skip creation** (mark as verified)
- If the task says "Add dependency Y" and Y is already in the config → **skip add** (mark as verified)
- If a task modifies an existing file → **read it first** before making changes

**When running `cargo init`, `cargo new`, `npm init`, etc. in a Phase 1:**
- Run the command in the CURRENT directory (no arguments that create a subdirectory):
  - ✅ `cargo init` (initializes current dir)
  - ❌ `cargo new smb3_clone` (creates NESTED sub-project)
- The project name will be derived from the directory name, which is what we want.

Execute tasks **one at a time, in the defined order**:
- **Only** do what the phase specifies. Nothing more.
- **Do not** use implicit knowledge or assumptions.
- **Do not** try to solve problems from future phases.
- **Do not** modify files not listed in Expected Outputs.
- If a task fails → stop, evaluate, and if unrecoverable mark `ERROR`.

**📏 Checkpoint after each task:**
After completing EACH task, save a checkpoint in `outputs/phase-X/CHECKPOINT.md`:

```md
# Checkpoint — Phase X
- Completed: [task 1 name], [task 2 name]
- Files created: [file paths]
- Files modified: [file paths]
- Next task: [exact next task as written in the phase file]
- Timestamp: [current date]
```

This enables clean resume if the session is interrupted, context overflows, or the model crashes. Overwrite CHECKPOINT.md on each task completion.

**📏 Token bailout — context almost full:**
Monitor your context usage during execution. If you estimate <25% of your context window remains and tasks are still pending:

1. **STOP** immediately. Do NOT continue until context overflows.
2. **Update CHECKPOINT.md** with current progress.
3. Leave the phase `in_progress` — Do NOT mark as BLOCKED.
4. **Report** to the user: "Phase X paused due to context limits. Progress saved at task N."

> 🔴 **Do NOT mark as BLOCKED** — BLOCKED is a terminal state that no agent will ever resume. Keeping the phase `in_progress` with a CHECKPOINT.md lets the builder resume on next invocation.

### Step 7 — Verify Completion Criteria

Before marking as completed, verify EACH completion criterion:
- If ALL are met → the phase is `COMPLETED`.
- If ANY fails → the phase must be marked `ERROR` or corrected.

### Step 8 — Store Deliverables

Ensure that all files listed in **Expected Outputs** exist and are in the correct location under `outputs/phase-X/`.

### Step 8.4 — Write Context File (CONTEXT.md)

Write `outputs/phase-X/CONTEXT.md` — a **structured, machine-readable** context file that future phases consume automatically.

> ⚠️ **IMPORTANT**: Write CONTEXT.md as a FILE using the `write` tool. Do NOT output CONTEXT.md content as text in your reasoning or response — that fills the context window and causes compaction loops.

Format:
```md
# Context — Phase X: [Name]

## Files Created
- `path/to/file.ext`: [brief description]

## Files Modified
- `path/to/file.ext`: [what changed]

## Decisions
- **[Category]:** [decision with rationale]

## Exports
- `functionName()`: [what it returns / does]

## Configuration
- **Port**: 3000
- **DB path**: data/app.db
```

Keep each entry to 1 line. This file is consumed by the builder of the NEXT phase (via Step 4.9).

### Step 8.5 — Write Summary File

Write `outputs/phase-X/SUMMARY.md` with a concise recap:

```md
# Phase X: [Name]

## TL;DR
[Max 3 lines. One-sentence summary of what this phase achieved.]

- Created `src/file1.ts` — description
- Modified `src/existing.ts` — description
- Key decision: [any notable technical decision]

## Reviewer Notes
[ONLY if applicable. Intentional non-standard decisions the reviewer should know about.]
```

The `## TL;DR` section is **REQUIRED** (max 3 lines). The `## Reviewer Notes` section documents intentional deviations BEFORE the reviewer flags them.

### Step 8.6 — Append to Project Decisions Log

Append to (or create) `DECISIONS.md` in the project root. If it doesn't exist, create it with a header, then append a section for this phase:

```md
## Phase X: [Name]
- **[Category]:** Decision description with rationale
- **[Category]:** Another decision
```

**Categories:** `Library`, `Architecture`, `Pattern`, `Workaround`, `Convention`, `Tooling`, `Performance`.

**Rules:**
- Only log decisions that are **non-obvious** or have **cross-phase impact**.
- Each entry should explain **what** was chosen and **why** (brief rationale).
- If you reversed a prior decision, note it explicitly: "**Reversal:** Switched from X to Y because..."

### Step 8.6b — Tracker Update (1 HITO = N fases, token-cheap)

Read `phases/phase-X.md → ## HITO` (one `grep`, not a full re-read):

- **Intermediate (`Closes-HITO: no`):** edit ONLY `CURRENT_PLAN.md → ## Última verificación por repo` — update/add the row for this repo with `<gate cmd> → <literal output> | <YYYY-MM-DD>`. Do NOT touch `MILESTONES.md`. If tracker files don't exist → skip silently.
- **HITO-closer (`Closes-HITO: yes`):** do the same intermediate update now. Do NOT write `MILESTONES.md` — the reviewer writes it after APPROVED (Step 8b). Ensure `SUMMARY.md ## TL;DR` has `command → literal output` ready for copy-paste.
- Never read full `MILESTONES.md` — at most check the top 20 lines for ID context.

### Step 8.7 — Clean Up Checkpoint and Pause Files

If `CHECKPOINT.md` or `remaining-tasks.md` exist, delete them:
```bash
rm outputs/phase-X/CHECKPOINT.md      # only if it exists
rm outputs/phase-X/remaining-tasks.md  # only if it exists
```

### Step 9 — Write .phase (Single Source of Truth)

Write the canonical state to `outputs/phase-X/.phase` (one word, no newline):

- `completed` → phase finished successfully
- `blocked` → missing information or dependencies
- `error` → unrecoverable failure

> ⚠️ You write ONLY to `.phase`. The `plan.md` table is a **derived view**. Do NOT edit plan.md's phase table.

### Step 10 — STOP and Report (ONE PHASE ONLY)

> ⚠️ **You execute exactly ONE phase per invocation. After completing it, you MUST stop.**
> Do NOT loop back to Step 2. Do NOT continue to the next phase.

Inform the user:
- Phase completed
- Result
- Next pending phase (if any) — for information only, do NOT execute it
- Reminder: run `/phaseflow-review` to audit this phase

**Consider your context DISCARDED. The next phaseflow-builder execution will read everything from files.**

---

## Error and Block Handling

### If a Related File does not exist
Do NOT block. Simply skip it and continue. If the file's absence makes a task impossible, then block (document why).

### If the phase file lacks information
1. **STOP** execution immediately.
2. Mark the phase as `BLOCKED`.
3. Document EXACTLY what is missing in your report to the user.
4. **DO NOT** continue with subsequent phases.

### If a dependency is not met
If the phase depends on phase N and phase N is not `COMPLETED`:
1. Mark the current phase as `BLOCKED`.
2. Document: "Blocked: depends on phase N (state: PENDING)".

### If an error occurs during execution
1. Try to fix the error if trivial.
2. If not fixable, mark `ERROR`.
3. Document the error in detail. DO NOT continue.

---

## Result Persistence

### Outputs structure
```
project/
├── DECISIONS.md           ← Accumulated cross-phase decisions
├── plan.md                ← Master table (derived view — regenerated by --fix)
├── outputs/
│   ├── phase-1/
│   │   ├── [generated files]
│   │   ├── REVIEW.md     ← generated by reviewer
│   │   └── SUMMARY.md    ← generated by builder
│   └── phase-2/
│       ├── [generated files]
│       ├── REVIEW.md
│       └── SUMMARY.md
```

### Logs
If the phase generates logs, save them in `logs/phase-X.log`.

---

## Complete Cycle Example

### Input: initial plan.md
```md
| 1 | Setup | Backend/Logic | PENDING | — | — | phases/phase-1.md | — |
| 2 | API | Backend/Logic | PENDING | — | — | phases/phase-2.md | — |
```

### phaseflow-builder executes:
1. Reads `.phase` files → detects phase 1 `pending`.
2. Writes `.phase` → `in_progress`.
3. Reads `phases/phase-1.md`.
4. Verifies inputs (none, it is the first phase).
5. Executes tasks: initializes project, installs dependencies.
6. Verifies completion criteria.
7. Copies deliverables to `outputs/phase-1/`.
8. Writes `SUMMARY.md` with Reviewer Notes.
9. Appends decisions to `DECISIONS.md`.
10. Writes `.phase` → `completed`. (plan.md is NOT touched — the table is a derived view.)
11. Reports and releases context.

### Next phaseflow-builder execution:
1. Reads `.phase` files → detects phase 2 `pending`.
2. Continues from step 2 for phase 2.
3. **Remembers nothing from phase 1.** All necessary context is in `phases/phase-2.md`, `DECISIONS.md`, `## Related Files`, and `outputs/phase-1/SUMMARY.md`.

---

## Small Model Adaptation (7B-14B)

If you are a small model with limited context window:

### 1. When tasks say "initialize a new project"
- **First check** if the project exists (Step 4.8).
- If `Cargo.toml` / `package.json` exists → skip init, verify config.
- If not → run init in current dir (`cargo init` without arguments).

### 2. When tasks say "create file X"
- Check if X already exists before creating.
- If it exists with correct content → skip.
- If it exists but wrong content → read first, then overwrite or edit.

### 3. Never create nested projects
- Running `cargo new my_project` or `cargo init my_project` inside an existing project creates a DUPLICATE nested project. This is almost never what you want.
- Always work in the CURRENT directory.

### 4. Read before acting
- If you don't know whether a file exists → use `glob` or `ls` to check.
- If you're unsure about a task → READ the related files first.
- When in doubt, block rather than guess.

### 5. Preference order for ambiguity
```
1. Read existing files → 2. Check preconditions → 3. Follow task literally
   → 4. If task contradicts reality → VERIFY with user or BLOCK
```

### 6. Common mistakes this section prevents
| Mistake | Prevention |
|---------|-----------|
| `cargo new smb3_clone` inside existing Rust project | Step 4.8: check for Cargo.toml first |
| `npm init -y` overwriting package.json | Step 4.8: read existing package.json first |
| Creating files in wrong directory | Always verify cwd with `pwd` |
| Not reading existing files before modifying | Step 6: "read it first before making changes" |
