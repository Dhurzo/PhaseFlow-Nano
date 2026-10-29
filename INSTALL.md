# ⚙️ Installation & Configuration

> **Extracted from the main README** for a focused reference on setup, configuration, and commands.

---

## Requirements

- [OpenCode](https://opencode.ai) ≥ 2.0 (V2 — this project targets the V2 config, plugin and permission APIs)
- Node.js ≥ 18 (only needed to run the test suite or the optional model-inheritance plugin locally)
- npm or bun (only needed for the test suite)

> ⚠️ **V1 users:** OpenCode V2 renamed several config keys and tools. Run
> `node tools/migrate-config-v1-to-v2.js opencode.json` to migrate an existing
> V1 config (it preserves your own agents, commands, models and plugins). See
> [Migrating from V1](#migrating-from-v1) below.

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

→ Copying commands to .opencode/commands/
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
mkdir -p .opencode/agents .opencode/commands .opencode/plugins templates
cp /path/to/phaseflow-nano/.opencode/agents/*.md .opencode/agents/
cp /path/to/phaseflow-nano/.opencode/commands/*.md .opencode/commands/
cp /path/to/phaseflow-nano/AGENTS.md .
cp /path/to/phaseflow-nano/templates/*.md templates/   # optional: phase templates
# Optional: plugin model-inheritance (auto-discovered by OpenCode V2)
cp -r /path/to/phaseflow-nano/.opencode/plugins/model-inheritance .opencode/plugins/
```

> ⚠️ **Inline commands:** `/phaseflow-status`, `/phaseflow-refine` and
> `/phaseflow-close-hito` are defined inside `opencode.json` (under the
> `commands` key in V2), not as standalone `.md` files. After copying the files
> above, you must also merge the `commands` section from the `opencode.json`
> template into your project's config — or copy the entire file and customize it.

> 💡 OpenCode V2 reloads config, agents, commands and plugins automatically — no
> restart needed. (V1 required restarting the server.)

**Option C — Global install (works from any project):**

```bash
# Local + global:
/path/to/phaseflow-nano/install.sh --global

# All at once (global + plugin):
/path/to/phaseflow-nano/install.sh --global --plugin
```

This copies agents and commands to `~/.config/opencode/` (does **not** overwrite your global `AGENTS.md`).  
PhaseFlow Nano is then available in **every** project — OpenCode V2 hot-reloads
the new files, no restart needed.

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
  "commands": {
    "phaseflow-status": {
      "description": "Show PhaseFlow project status — reads .phase files as canonical state, and plan.md for project metadata. Shows all phases, states, and next action.",
      "subagent": true,
      "agent": "explore",
      "template": "Show the PhaseFlow project status. Read plan.md for the project name/goal/snapshot and ## Mapa HITO ↔ Fases if present. Then read all .phase files from outputs/phase-*/.phase as the canonical state source. ..."
    },
    "phaseflow-refine": {
      "description": "Refine a phase file — reads the phase, researches ambiguities, asks clarifying questions, and rewrites it with concrete, actionable prompts",
      "subagent": true,
      "agent": "phaseflow-refiner",
      "template": "You are improving a PhaseFlow phase file. Read the specified phase (e.g. phases/phase-1.md) and plan.md. ... Phase to refine: {{input}}"
    }
  },
  "plugins": [],
  "permissions": [
    { "action": "edit", "resource": "*", "effect": "allow" },
    { "action": "shell", "resource": "*", "effect": "allow" },
    { "action": "read", "resource": "*", "effect": "allow" },
    { "action": "glob", "resource": "*", "effect": "allow" },
    { "action": "grep", "resource": "*", "effect": "allow" },
    { "action": "webfetch", "resource": "*", "effect": "allow" },
    { "action": "websearch", "resource": "*", "effect": "allow" },
    { "action": "question", "resource": "*", "effect": "allow" },
    { "action": "subagent", "resource": "*", "effect": "allow" },
    { "action": "inherit-task", "resource": "*", "effect": "allow" },
    { "action": "external_directory", "resource": "*", "effect": "allow" }
  ],
  "agents": {
    "phaseflow-explorer": {
      "description": "Codebase explorer. Investigates existing projects to identify tech stack, patterns, file structure, and technical debt.",
      "mode": "subagent",
      "color": "#10B981",
      "permissions": [
        { "action": "edit", "resource": "*", "effect": "allow" },
        { "action": "shell", "resource": "*", "effect": "allow" },
        { "action": "read", "resource": "*", "effect": "allow" },
        { "action": "glob", "resource": "*", "effect": "allow" },
        { "action": "grep", "resource": "*", "effect": "allow" },
        { "action": "subagent", "resource": "*", "effect": "deny" }
      ]
    },
    "phaseflow-orchestrator": {
      "description": "Automated pipeline orchestrator. Reads .phase files and plan.md, invokes builder+reviewer in a loop until all phases are done.",
      "mode": "subagent",
      "color": "#8B5CF6",
      "permissions": [
        { "action": "edit", "resource": "*", "effect": "allow" },
        { "action": "shell", "resource": "*", "effect": "allow" },
        { "action": "read", "resource": "*", "effect": "allow" },
        { "action": "glob", "resource": "*", "effect": "allow" },
        { "action": "grep", "resource": "*", "effect": "allow" },
        { "action": "subagent", "resource": "*", "effect": "allow" },
        { "action": "inherit-task", "resource": "*", "effect": "allow" }
      ]
    },
    "phaseflow-refiner": {
      "description": "Phase prompt engineer. Reads a phase-N.md file, identifies ambiguities and gray areas, asks clarifying questions, researches technologies, and rewrites the phase with concrete, actionable prompts.",
      "mode": "subagent",
      "color": "#F97316",
      "permissions": [
        { "action": "read", "resource": "*", "effect": "allow" },
        { "action": "edit", "resource": "*", "effect": "allow" },
        { "action": "glob", "resource": "*", "effect": "allow" },
        { "action": "grep", "resource": "*", "effect": "allow" },
        { "action": "question", "resource": "*", "effect": "allow" },
        { "action": "webfetch", "resource": "*", "effect": "allow" },
        { "action": "websearch", "resource": "*", "effect": "allow" },
        { "action": "shell", "resource": "*", "effect": "deny" },
        { "action": "subagent", "resource": "*", "effect": "deny" }
      ]
    }
  },
  "experimental": {
    "todo": true,
    "subagent_depth": 2
  }
}
```

> The full template with all 9 agents lives in [`opencode.json`](opencode.json).

> **Note about permissions (V2 format):** permissions are now an **ordered array
> of rules** (`action` / `resource` / `effect`), not a map of tool → effect.
> The **last matching rule wins**, so broad rules come first and exceptions go
> last. The `edit` action covers the `edit`, `write` and `patch` tools, and
> `shell` replaces V1's `bash`.  
> The orchestrator has `"subagent": "allow"` and `"inherit-task": "allow"` — it
> prefers `inherit-task` (which forces the parent's model on the child) but falls
> back to OpenCode's built-in `subagent` tool if the plugin is unavailable.

> **`experimental.subagent_depth: 2`** is required: the orchestrator (a subagent)
> launches builders/reviewers (also subagents). The default depth is 1.  
> **`experimental.todo: true`** enables the todo tools, which the builder uses
> to track task progress.

---

### 4. (Optional) Model-inheritance plugin

OpenCode V2's built-in `subagent` tool **inherits the parent session's model**
whenever the target agent does not define its own `model`. PhaseFlow's agents
don't pin a model, so inheritance already works out of the box.

The `model-inheritance` plugin adds an explicit `inherit-task` tool that
guarantees inheritance even if an agent (or a global config) pins a model, and
that always creates the child session with the parent's `providerID` + model id.

#### Install the plugin

```bash
# Local (project-scoped):
/path/to/phaseflow-nano/install.sh --plugin

# Global (all projects):
/path/to/phaseflow-nano/install.sh --global --plugin
```

This copies the plugin to `.opencode/plugins/model-inheritance/` (or
`~/.config/opencode/plugins/model-inheritance/`). **OpenCode V2 auto-discovers
plugins in those directories** — there is nothing to register in the config and
no npm dependency to install.

> ⚠️ Do **not** add `"model-inheritance"` to the `plugins` array in your
> config: OpenCode would try to fetch the package from the public npm registry
> and fail with a 404. Local plugin directories are enough.

#### Verify

```bash
opencode api get "/api/plugin?location%5Bdirectory%5D=/path/to/your-project"
```

The plugin should appear as `model-inheritance | local | active`.

> 💡 **Install it in only one scope.** If the plugin is present both in
> `~/.config/opencode/plugins/` and in a project's `.opencode/plugins/`, V2
> keeps the global one active and reports the project copy as
> `failed — Duplicate plugin ID`. Remove one of the two copies to avoid the
> warning.

---

## Model-Inheritance Plugin

### What it does

The plugin registers an `inherit-task` tool that works exactly like `subagent`
but **passes the parent session's model** to the sub-agent. Sub-agents run with
whatever model you have selected in the TUI.

The tool takes the same arguments as V2's built-in `subagent`:

| Field | Required | Meaning |
|-------|:--------:|---------|
| `agent` | ✅ | Agent id to launch (e.g. `phaseflow-builder`) |
| `description` | ✅ | Short 3–5 word summary of the dispatch |
| `prompt` | ✅ | Full instructions for the sub-agent |

### How it works

```
Parent session (model: Ministral 3 14B)
  │
  ├── inherit-task(agent="phaseflow-builder", prompt="...")
  │    │
  │    ├── 1. Reads parent session → extracts model (providerID + id)
  │    ├── 2. Creates child session with parentID + agent + model
  │    ├── 3. Sends prompt
  │    └── 4. Waits (session.wait, polling fallback), collects output
  │
  └── Child session runs with Ministral 3 14B ✅
```

### Configuration

| Env var | Default | Meaning |
|---------|--------:|---------|
| `INHERIT_TASK_TIMEOUT_MS` | `360000` (6 min) | Max wait time. Values `< 1000` are interpreted as seconds. |

### Files

| File | Role |
|------|------|
| `.opencode/plugins/model-inheritance/index.js` | Plugin source (V2 plugin API, zero dependencies) |

---

## Migrating from V1

OpenCode V2 renamed the following config surface. The bundled tools migrate it
for you:

| V1 | V2 |
|----|----|
| `command` | `commands` |
| `agent` | `agents` |
| `permission` (map) | `permissions` (ordered rule array) |
| `subtask` | `subagent` |
| `bash` (action) | `shell` |
| `task` (action/tool) | `subagent` |
| `write` / `patch` (actions) | `edit` |
| `plugin` | `plugins` |
| `.opencode/command/` | `.opencode/commands/` |
| `tools:` / `argument-hint:` (command frontmatter) | removed — not supported in V2 |

```bash
# Migrate a config in place (preserves your own agents, commands, models, plugins):
node tools/migrate-config-v1-to-v2.js opencode.json

# Preview only:
node tools/migrate-config-v1-to-v2.js opencode.json --dry-run

# Merge PhaseFlow into an existing config (V1 or V2) without touching the rest:
node tools/merge-phaseflow-config.js /path/to/your/opencode.json /path/to/phaseflow-nano/opencode.json
```

Both tools also accept `.jsonc` files with comments — comments are preserved.

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
| `/phaseflow-doctor --fix` | `phaseflow-doctor` | Regenerate plan.md from .phase + validate tracker (autofix Siguiente ID) |
| `/phaseflow-stop` | (built-in) | Pause the currently executing phase — writes `remaining-tasks.md` for clean resume |
| `/phaseflow-status` | (built-in explore) | Show project status — reads `plan.md` + HITO map + tracker (MILESTONES/CURRENT_PLAN) |
| `/phaseflow-close-hito` | `phaseflow-reviewer` | Manually close a HITO — MILESTONES prepend + CURRENT_PLAN rewrite from TL;DRs |

> 💡 **`/phaseflow-status`** is a zero-side-effect utility. Use it anytime to check progress without reading files manually.

---

## Tracker Integration (project-tracker-kit v2)

PhaseFlow + tracker trabajan conjuntamente: PhaseFlow ejecuta por fases, el tracker recuerda por HITOs (1 HITO = 1–4 fases).

- **Scaffold:** el planner crea `MILESTONES.md` / `CURRENT_PLAN.md` / `PLAN.MD` / `tracker-template/TEMPLATE.md` / `tools/check-tracker.sh` desde `templates/tracker/`. `install.sh` copia el validador y la plantilla sin tocar el historial.
- **Ejecución:** fase intermedia (`Closes-HITO: no`) solo toca `CURRENT_PLAN → Última verificación`. Fase cierre (`Closes-HITO: yes` + `REVIEWED`) hace prepend en `MILESTONES` + rewrite de `CURRENT_PLAN` (fuente: `SUMMARY.md ## TL;DR`).
- **Validación:** `tools/check-tracker.sh → OK` y `phaseflow-doctor --fix` (absorbe los 5 checks + autofix de `Siguiente ID libre`). `PLAN.MD` siempre stub.
- **Fuente verbatim:** `project-tracker-kit/` (no editar `TEMPLATE.md` ni el protocolo). Adaptación: `templates/tracker/`.
