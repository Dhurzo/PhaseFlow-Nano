# ⚙️ Installation & Configuration

> **Extracted from the main README** for a focused reference on setup, configuration, and commands.

---

## Requirements

- [OpenCode](https://opencode.ai) ≥ 1.0
- Node.js ≥ 18 (only needed for the optional model-inheritance plugin)
- npm or bun (only needed for the plugin)

---

## Installation

### 1. Clone or copy

```bash
git clone https://github.com/dhurzo/phaseflow-nano.git
# or download and extract the ZIP
```

### 2. Install

**Option A — Installer script (recommended):**

```bash
# Install in the current project:
cd /path/to/your-project
/path/to/phaseflow-nano/install.sh

# Or from the repo itself (updates .opencode/agents/ with latest changes):
cd /path/to/phaseflow-nano
./install.sh
```

The installer detects self-install and copies latest sources from the repo root:

```
╔══════════════════════════════════════════════╗
║        PhaseFlow Nano Installer              ║
╚══════════════════════════════════════════════╝

  Target:    /path/to/your-project
  Source:    /path/to/phaseflow-nano

→ Copying agents to .opencode/agents/
  phaseflow-explorer       ... ✓ installed
  phaseflow-planner        ... ✓ installed
  phaseflow-builder        ... ✓ installed
  phaseflow-builder-visual ... ✓ installed
  phaseflow-reviewer       ... ✓ installed
  phaseflow-orchestrator   ... ✓ installed
  phaseflow-refiner        ... ✓ installed
  phaseflow-doctor         ... ✓ installed

→ Copying commands to .opencode/command/
  phaseflow-explore        ... ✓ installed
  phaseflow-plan           ... ✓ installed
  phaseflow-build          ... ✓ installed
  phaseflow-build-visual   ... ✓ installed
  phaseflow-review         ... ✓ installed
  phaseflow-orchestrate    ... ✓ installed
  phaseflow-doctor         ... ✓ installed
  phaseflow-stop           ... ✓ installed

→ Checking AGENTS.md
  ✓ AGENTS.md copied

→ Checking opencode.json
  ✓ Created opencode.json from template

╔══════════════════════════════════════════════╗
║  ✅  PhaseFlow Nano installed successfully!  ║
╚══════════════════════════════════════════════╝
```

**Option B — Manual:**

```bash
mkdir -p .opencode/agents .opencode/command .opencode/plugins templates
cp /path/to/phaseflow-nano/phaseflow-*.md .opencode/agents/
cp /path/to/phaseflow-nano/.opencode/command/*.md .opencode/command/
cp /path/to/phaseflow-nano/AGENTS.md .
cp /path/to/phaseflow-nano/templates/*.md templates/   # optional: phase templates
# Optional: plugin model-inheritance
cp -r /path/to/phaseflow-nano/.opencode/plugins/model-inheritance .opencode/plugins/
```

> ⚠️ **Inline commands:** `/phaseflow-status` and `/phaseflow-refine` are defined inside
> `opencode.json`, not as standalone `.md` files. After copying the files above, you must
> also merge the `command` section from `opencode.json` template into your project's
> `opencode.json` — or copy the entire file and customize it.

**Option C — Global install (works from any project):**

```bash
# Local + global:
/path/to/phaseflow-nano/install.sh --global

# All at once (global + plugin):
/path/to/phaseflow-nano/install.sh --global --plugin
```

This copies agents, commands, and `AGENTS.md` to `~/.config/opencode/`.  
After restarting OpenCode, PhaseFlow Nano is available in **every** project.

**Option D — Install into another project:**

```bash
/path/to/phaseflow-nano/install.sh /path/to/other-project
/path/to/phaseflow-nano/install.sh --global /path/to/other-project  # global + remote project install
```

> With `--global`, the installer copies to `~/.config/opencode/` AND to the specified project path. Without `--global`, only the specified project path is installed.

> **Flags are positional:** `--global` and `--plugin` can be mixed freely with
> a target directory path. The first non-flag argument is used as the target.

### 3. Configure opencode.json

Create or update your project's `opencode.json`. The installer does this automatically
if the file doesn't exist, but you can also paste the full config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ["AGENTS.md"],
  "command": {
    "phaseflow-status": {
      "description": "Show PhaseFlow project status — reads plan.md and summarizes all phases, states, and results",
      "subtask": true,
      "agent": "explore",
      "template": "Read plan.md from the current project directory and display its phase table with states."
    },
    "phaseflow-refine": {
      "description": "Refine a phase file — reads the phase, researches ambiguities, asks clarifying questions, and rewrites it with concrete, actionable prompts",
      "subtask": true,
      "agent": "phaseflow-refiner",
      "template": "You are improving a PhaseFlow phase file. Read the specified phase (e.g. phases/phase-1.md) and plan.md. Analyze it for vague tasks, missing inputs, ambiguous decisions, and gray areas. Ask the user targeted questions to clarify. Then rewrite the phase file with the resolved information.\n\nPhase to refine: {{input}}"
    }
  },
  "agent": {
    "phaseflow-explorer": {
      "description": "Codebase explorer. Investigates existing projects to identify tech stack, patterns, file structure, and technical debt.",
      "mode": "subagent",
      "color": "#10B981",
      "permission": { "edit": "allow", "bash": "allow", "read": "allow", "glob": "allow", "grep": "allow", "write": "allow" }
    },
    "phaseflow-planner": {
      "description": "Project planner. Analyzes requests and splits them into independent, self-contained phases. When the project has existing code, it analyzes the codebase to map relevant files into each phase.",
      "mode": "subagent",
      "color": "#6366F1",
      "permission": { "edit": "allow", "bash": "allow", "read": "allow", "glob": "allow", "grep": "allow", "write": "allow" }
    },
    "phaseflow-builder": {
      "description": "Sequential phase executor. Reads plans, executes pending phases one at a time, persists progress in files.",
      "mode": "subagent",
      "color": "#F59E0B",
      "permission": { "edit": "allow", "bash": "allow", "read": "allow", "glob": "allow", "grep": "allow", "write": "allow" }
    },
    "phaseflow-builder-visual": {
      "description": "UI-specialized phase executor. Handles frontend, CSS, React/Vue/Svelte components, responsive design, accessibility.",
      "mode": "subagent",
      "color": "#EC4899",
      "permission": { "edit": "allow", "bash": "allow", "read": "allow", "glob": "allow", "grep": "allow", "write": "allow" }
    },
    "phaseflow-reviewer": {
      "description": "Post-phase code auditor. Reviews deliverables for bugs, vulnerabilities, duplicated code, and plan deviations.",
      "mode": "subagent",
      "color": "#EF4444",
      "permission": { "edit": "allow", "bash": "allow", "read": "allow", "glob": "allow", "grep": "allow", "write": "allow" }
    },
    "phaseflow-orchestrator": {
      "description": "Automated pipeline orchestrator. Reads plan.md, invokes builder+reviewer in a loop until all phases are done.",
      "mode": "subagent",
      "color": "#8B5CF6",
      "permission": {
        "edit": "allow",
        "bash": "allow",
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "task": "allow",
        "inherit-task": "allow"
      }
    },
    "phaseflow-refiner": {
      "description": "Phase prompt engineer. Reads a phase-N.md file, identifies ambiguities and gray areas, asks clarifying questions, researches technologies, and rewrites the phase with concrete, actionable prompts.",
      "mode": "subagent",
      "color": "#F97316",
      "permission": {
        "read": "allow",
        "write": "allow",
        "edit": "allow",
        "glob": "allow",
        "grep": "allow",
        "question": "allow",
        "webfetch": "allow",
        "websearch": "allow",
        "bash": "deny",
        "task": "deny"
      }
    },
    "phaseflow-doctor": {
      "description": "Project diagnostician — validates phase structure, states, and file consistency. Read-only, safe at any time.",
      "mode": "subagent",
      "color": "#06B6D4",
      "permission": {
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "write": "deny",
        "edit": "deny",
        "bash": "deny",
        "task": "deny"
      }
    }
  }
}
```

> **Note about permissions:** All agents now include `"write": "allow"` so they can create
> phase output files (SUMMARY.md, REVIEW.md) and update `plan.md`.  
> The orchestrator has `"task": "allow"` and `"inherit-task": "allow"` — it prefers `inherit-task`
> (which passes the parent model to sub-agents via the model-inheritance plugin) but falls
> back to OpenCode's built-in `task` tool if the plugin is unavailable.

---

### 4. (Optional) Model-inheritance plugin

By default, OpenCode's `task` tool spawns sub-agents with a **different default model**  instead of inheriting the parent session's model.

The `model-inheritance` plugin registers an `inherit-task` tool that reads the parent
session's model and passes it to child sessions.

#### Install the plugin

```bash
cd /path/to/phaseflow-nano
npm install
```

Or use the installer flag:

```bash
/path/to/phaseflow-nano/install.sh --plugin
```

#### Add to global config

Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["model-inheritance"]
}
```

#### Verify

```bash
node -e "require('model-inheritance'); console.log('✅ Plugin OK')"
```

---

## Model-Inheritance Plugin

### What it does

The plugin registers an `inherit-task` tool that works exactly like `task` but
**passes the parent session's model** to the sub-agent. Sub-agents run with
whatever model you have selected in the TUI.

### How it works

```
Parent session (model: Ministral 3 14B)
  │
  ├── inherit-task(subagent_type="phaseflow-builder", prompt="...")
  │    │
  │    ├── 1. Reads parent messages → extracts model (providerID + modelID)
  │    ├── 2. Creates child session with parentID
  │    ├── 3. Sends prompt with model: { providerID, modelID }
  │    └── 4. Polls until child finishes, collects output
  │
  └── Child session runs with Ministral 3 14B ✅ (not deepseek)
```

### Files

| File | Role |
|------|------|
| `.opencode/plugins/model-inheritance/index.js` | Plugin source (~70 lines) |
| `.opencode/plugins/model-inheritance/package.json` | npm metadata |

---

## Commands

| Command | Agent | Description |
|---------|-------|-------------|
| `/phaseflow-explore` | `phaseflow-explorer` | Analyze existing codebase before planning |
| `/phaseflow-plan` | `phaseflow-planner` | Split a project into independent phases |
| `/phaseflow-build` | `phaseflow-builder` | Execute the next pending phase (backend/logic) |
| `/phaseflow-build-visual` | `phaseflow-builder-visual` | Execute the next UI/frontend phase (⚠️ untested) |
| `/phaseflow-review` | `phaseflow-reviewer` | Review the last completed phase |
| `/phaseflow-orchestrate` | `phaseflow-orchestrator` | Run all phases automatically (builder → reviewer loop) |
| `/phaseflow-orchestrate --gsd` | `phaseflow-orchestrator` | Same as above, plus sync results to GSD `.planning/` files |
| `/phaseflow-refine` | `phaseflow-refiner` | Refine a vague phase file — research, clarify, rewrite with concrete prompts |
| `/phaseflow-doctor` | `phaseflow-doctor` | Diagnose project health — validates phases, states, files (read-only) |
| `/phaseflow-stop` | (built-in) | Pause the currently executing phase — writes `remaining-tasks.md` for clean resume |
| `/phaseflow-status` | (built-in explore) | Show project status — reads `plan.md`, displays phase table |

> 💡 **`/phaseflow-status`** is a zero-side-effect utility. Use it anytime to check progress without reading files manually.
