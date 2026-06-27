#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# PhaseFlow Nano Installer
# Installs agents, commands, and optional plugin into a project
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║        PhaseFlow Nano Installer              ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Parse flags & project dir ────────────────
INSTALL_PLUGIN=false
INSTALL_GLOBAL=false
PROJECT_DIR=""
for arg in "$@"; do
  case "$arg" in
    --help|-h)
      echo -e "${BOLD}Usage:${NC} $0 [--plugin] [--global] [target-directory]"
      echo ""
      echo -e "  ${BOLD}Flags:${NC}"
      echo -e "    ${CYAN}--plugin${NC}    Also install the model-inheritance plugin"
      echo -e "    ${CYAN}--global${NC}    Install system-wide (~/.config/opencode/)"
      echo -e "    ${CYAN}--help${NC}      Show this help message"
      echo ""
      echo -e "  ${BOLD}Examples:${NC}"
      echo -e "    $0                          # Install in current directory"
      echo -e "    $0 /path/to/project         # Install in another project"
      echo -e "    $0 --global                # Install globally"
      echo -e "    $0 --plugin               # Install + plugin"
      echo -e "    $0 --global --plugin      # Global + plugin"
      echo -e "    $0 --plugin /path/to/proj # Plugin + target"
      exit 0
      ;;
    --plugin) INSTALL_PLUGIN=true ;;
    --global) INSTALL_GLOBAL=true ;;
    *)        PROJECT_DIR="$arg" ;;  # first non-flag argument = target directory
  esac
done
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
OPENCODE_DIR="$PROJECT_DIR/.opencode"

# ── Check destination ────────────────────────
if [ ! -d "$PROJECT_DIR" ]; then
  echo -e "${YELLOW}✖ Error: directory '$PROJECT_DIR' does not exist.${NC}"
  exit 1
fi

echo -e "  ${BOLD}Target:${NC}    $PROJECT_DIR"
echo -e "  ${BOLD}Source:${NC}    $SCRIPT_DIR"
echo ""

# ── Detect self-install (same source and dest) ──
SELF_INSTALL=false
if [ "$SCRIPT_DIR" = "$PROJECT_DIR" ]; then
  SELF_INSTALL=true
  echo -e "  ${YELLOW}ℹ Running install from the repo itself.${NC}"
  echo -e "  ${YELLOW}  Agents and commands are already in place (same file).${NC}"
  echo ""
  echo -e "  ${YELLOW}  Use ${BOLD}./install.sh /path/to/other-project${NC}${YELLOW} to install into another project.${NC}"
  echo -e "  ${YELLOW}  Use ${BOLD}--global${NC}${YELLOW} to install system-wide (works from any project).${NC}"
  echo ""
fi

# ── Create directories ───────────────────────
mkdir -p "$OPENCODE_DIR/agents"
mkdir -p "$OPENCODE_DIR/command"

# ── safe_copy: avoid cp "same file" error ────
safe_copy() {
  local src="$1"
  local dst="$2"
  if [ "$src" = "$dst" ]; then
    echo -e "  ${YELLOW}⏭ already in place${NC}"
    return 0
  fi
  cp "$src" "$dst"
  echo -e "  ${GREEN}✓${NC} installed"
}

# ── Copy agent files ─────────────────────────
echo -e "${BOLD}→ Copying agents to ${CYAN}.opencode/agents/${NC}"
for agent in phaseflow-explorer phaseflow-planner phaseflow-builder phaseflow-builder-visual phaseflow-reviewer phaseflow-orchestrator phaseflow-refiner phaseflow-doctor; do
  dst="$OPENCODE_DIR/agents/$agent.md"
  src="$SCRIPT_DIR/.opencode/agents/$agent.md"
  if [ -f "$src" ]; then
    echo -e -n "  ${BOLD}$agent${NC} ... "
    safe_copy "$src" "$dst"
  else
    echo -e "  ${YELLOW}⚠ $agent.md not found, skipping${NC}"
  fi
done

# ── Copy command files ───────────────────────
echo ""
echo -e "${BOLD}→ Copying commands to ${CYAN}.opencode/command/${NC}"
for cmd in phaseflow-explore phaseflow-plan phaseflow-build phaseflow-build-visual phaseflow-review phaseflow-orchestrate phaseflow-doctor phaseflow-stop; do
  src="$SCRIPT_DIR/.opencode/command/$cmd.md"
  dst="$OPENCODE_DIR/command/$cmd.md"
  if [ -f "$src" ]; then
    echo -e -n "  ${BOLD}$cmd${NC} ... "
    safe_copy "$src" "$dst"
  else
    echo -e "  ${YELLOW}⚠ $cmd.md not found, skipping${NC}"
  fi
done

# ── Copy templates ───────────────────────────
echo ""
echo -e "${BOLD}→ Copying phase templates to ${CYAN}templates/${NC}"
TEMPLATES_DIR="$SCRIPT_DIR/templates"
if [ -d "$TEMPLATES_DIR" ]; then
  mkdir -p "$PROJECT_DIR/templates"
  for tmpl in "$TEMPLATES_DIR"/*.md; do
    tmpl_name="$(basename "$tmpl")"
    dst="$PROJECT_DIR/templates/$tmpl_name"
    if [ "$tmpl" != "$dst" ]; then
      cp "$tmpl" "$dst"
    fi
    echo -e "  ${GREEN}✓${NC} $tmpl_name"
  done
else
  echo -e "  ${YELLOW}⚠ templates/ directory not found, skipping${NC}"
fi

# ── Copy AGENTS.md ───────────────────────────
echo ""
echo -e "${BOLD}→ Checking ${CYAN}AGENTS.md${NC}"
if [ -f "$SCRIPT_DIR/AGENTS.md" ]; then
  src="$SCRIPT_DIR/AGENTS.md"
  dst="$PROJECT_DIR/AGENTS.md"
  if [ "$src" != "$dst" ]; then
    cp "$src" "$dst"
    echo -e "  ${GREEN}✓${NC} AGENTS.md copied"
  else
    echo -e "  ${GREEN}✓${NC} AGENTS.md already in place"
  fi
else
  echo -e "  ${YELLOW}⚠ AGENTS.md not found, skipping${NC}"
fi

# ── opencode.json setup / merge ──────────────
echo ""
echo -e "${BOLD}→ Checking ${CYAN}opencode.json${NC}"

OPENCODE_JSON="$PROJECT_DIR/opencode.json"
REPO_JSON="$SCRIPT_DIR/opencode.json"

if [ ! -f "$OPENCODE_JSON" ]; then
  if [ -f "$REPO_JSON" ]; then
    cp "$REPO_JSON" "$OPENCODE_JSON"
    echo -e "  ${GREEN}✓${NC} Created opencode.json from template"
  fi
else
  echo -e "  ${GREEN}✓${NC} opencode.json already exists — merging agent definitions..."
  # Use node to merge PhaseFlow agent definitions and plugin into existing config
  if command -v node &>/dev/null; then
    node -e "
      const fs = require('fs');
      const target = JSON.parse(fs.readFileSync('$OPENCODE_JSON', 'utf8'));
      const template = JSON.parse(fs.readFileSync('$REPO_JSON', 'utf8'));

      let changed = false;

      // Merge instructions
      if (!target.instructions || !target.instructions.includes('AGENTS.md')) {
        if (!target.instructions) target.instructions = [];
        if (!target.instructions.includes('AGENTS.md')) {
          target.instructions.push('AGENTS.md');
          changed = true;
        }
      }

      // Merge root permission block — add inherit-task if missing
      if (!target.permission) {
        target.permission = {};
      }
      if (target.permission['inherit-task'] !== 'allow') {
        target.permission['inherit-task'] = 'allow';
        changed = true;
      }

      // Merge plugin registration
      if (!target.plugin) target.plugin = [];
      if (!target.plugin.includes('model-inheritance')) {
        target.plugin.push('model-inheritance');
        changed = true;
      }

      // Merge agent definitions
      if (!target.agent) target.agent = {};
      for (const [name, def] of Object.entries(template.agent || {})) {
        if (!target.agent[name]) {
          target.agent[name] = def;
          changed = true;
        }
      }

      // Patch orchestrator permissions: ensure task:allow + inherit-task:allow
      // (even if the agent definition already exists from a previous install)
      const orch = target.agent['phaseflow-orchestrator'];
      if (orch && orch.permission) {
        if (orch.permission.task !== 'allow') {
          orch.permission.task = 'allow';
          changed = true;
        }
        if (orch.permission['inherit-task'] !== 'allow') {
          orch.permission['inherit-task'] = 'allow';
          changed = true;
        }
      }

      // Merge commands (status, refine)
      if (!target.command) target.command = {};
      for (const [name, def] of Object.entries(template.command || {})) {
        if (!target.command[name]) {
          target.command[name] = def;
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync('$OPENCODE_JSON', JSON.stringify(target, null, 2) + '\n');
        console.log('  ${GREEN}✓${NC} Config updated with PhaseFlow agent definitions');
      } else {
        console.log('  ${GREEN}✓${NC} PhaseFlow config already complete — no changes needed');
      }
    " 2>&1 || echo -e "  ${YELLOW}⚠ Failed to merge config. Check $OPENCODE_JSON manually.${NC}"
  else
    echo -e "  ${YELLOW}⚠ node not found. Cannot merge config automatically.${NC}"
    echo -e "  ${YELLOW}  Verify opencode.json includes agents, plugin, and AGENTS.md.${NC}"
  fi
fi

# ── Plugin installation ──────────────────────
if [ "$INSTALL_PLUGIN" = true ]; then
  echo ""
  echo -e "${BOLD}→ Installing model-inheritance plugin${NC}"

  if command -v npm &>/dev/null; then
    # Install plugin dependency in the repo
    cd "$SCRIPT_DIR"
    npm install --silent 2>/dev/null
    echo -e "  ${GREEN}✓${NC} Plugin dependencies installed in repo node_modules"

    # Copy plugin source files to target
    PLUGIN_SRC="$SCRIPT_DIR/.opencode/plugins/model-inheritance"
    if [ "$INSTALL_GLOBAL" = true ]; then
      PLUGIN_DST="$HOME/.config/opencode/plugins/model-inheritance"
    else
      PLUGIN_DST="$OPENCODE_DIR/plugins/model-inheritance"
    fi
    if [ -d "$PLUGIN_SRC" ]; then
      if [ "$PLUGIN_SRC" = "$PLUGIN_DST" ]; then
        echo -e "  ${YELLOW}⏭ plugin already in place (self-install)${NC}"
      else
        mkdir -p "$PLUGIN_DST"
        cp -r "$PLUGIN_SRC/"* "$PLUGIN_DST/"
        echo -e "  ${GREEN}✓${NC} Plugin files copied to ${CYAN}$PLUGIN_DST${NC}"
      fi

      # Add dependency to package.json (project install only, skip for global)
      if [ "$INSTALL_GLOBAL" != true ]; then
        TARGET_PKG="$PROJECT_DIR/package.json"
        if [ -f "$TARGET_PKG" ]; then
          node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('$TARGET_PKG', 'utf8'));
            if (!pkg.dependencies) pkg.dependencies = {};
            if (!pkg.dependencies['model-inheritance']) {
              pkg.dependencies['model-inheritance'] = 'file:.opencode/plugins/model-inheritance';
              fs.writeFileSync('$TARGET_PKG', JSON.stringify(pkg, null, 2) + '\n');
              console.log('  ${GREEN}✓${NC} Added model-inheritance dependency to package.json');
            }
          " 2>/dev/null || true
        fi
      fi
    fi

    # Install in global opencode cache
    if [ -d "$HOME/.cache/opencode/packages" ]; then
      cd "$HOME/.cache/opencode/packages"
      npm install "$SCRIPT_DIR/.opencode/plugins/model-inheritance" 2>/dev/null || true
      echo -e "  ${GREEN}✓${NC} Plugin installed in OpenCode global cache"
    fi

    # Ensure plugin is registered in global config
    GLOBAL_CONFIG="$HOME/.config/opencode/opencode.json"
    if [ -f "$GLOBAL_CONFIG" ]; then
      node -e "
        const fs = require('fs');
        const c = JSON.parse(fs.readFileSync('$GLOBAL_CONFIG', 'utf8'));
        if (!c.plugin) c.plugin = [];
        if (!c.plugin.includes('model-inheritance')) {
          c.plugin.push('model-inheritance');
          fs.writeFileSync('$GLOBAL_CONFIG', JSON.stringify(c, null, 2) + '\n');
          console.log('  ${GREEN}✓${NC} Added model-inheritance to global config');
        }
      " 2>/dev/null || true
    else
      echo -e "  ${YELLOW}⚠ No global config at $GLOBAL_CONFIG${NC}"
    fi

    # ── Ensure plugin in tui.json (respects existing config) ──
    TUI_JSON="$HOME/.config/opencode/tui.json"
    if [ -f "$TUI_JSON" ]; then
      node -e "
        const fs = require('fs');
        const p = '$TUI_JSON';
        let c = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (!c.plugin) c.plugin = [];
        if (!c.plugin.includes('model-inheritance')) {
          c.plugin.push('model-inheritance');
          fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
          console.log('  ${GREEN}✓${NC} Plugin added to tui.json');
        }
      " 2>/dev/null || true
    else
      mkdir -p "$(dirname "$TUI_JSON")"
      printf '{\n  "plugin": ["model-inheritance"]\n}\n' > "$TUI_JSON"
      echo -e "  ${GREEN}✓${NC} Created tui.json with plugin"
    fi
  else
    echo -e "  ${YELLOW}⚠ npm not found. Install manually: cd $SCRIPT_DIR && npm install${NC}"
  fi
fi

# ── Global install ──
if [ "$INSTALL_GLOBAL" = true ]; then
  GLOBAL_AGENTS_DIR="$HOME/.config/opencode/agents"
  GLOBAL_COMMANDS_DIR="$HOME/.config/opencode/command"
  GLOBAL_CONFIG="$HOME/.config/opencode/opencode.json"

  echo ""
  echo -e "${BOLD}→ Installing agents globally → ${CYAN}$GLOBAL_AGENTS_DIR${NC}"
  mkdir -p "$GLOBAL_AGENTS_DIR"
for agent in phaseflow-explorer phaseflow-planner phaseflow-builder phaseflow-builder-visual phaseflow-reviewer phaseflow-orchestrator phaseflow-refiner phaseflow-doctor; do
    src="$SCRIPT_DIR/.opencode/agents/$agent.md"
    if [ -f "$src" ]; then
      cp "$src" "$GLOBAL_AGENTS_DIR/$agent.md"
      echo -e "  ${GREEN}✓${NC} $agent (global)"
    else
      echo -e "  ${YELLOW}⚠ $agent.md not found, skipping global install${NC}"
    fi
  done

  echo ""
  echo -e "${BOLD}→ Installing commands globally → ${CYAN}$GLOBAL_COMMANDS_DIR${NC}"
  mkdir -p "$GLOBAL_COMMANDS_DIR"
for cmd in phaseflow-explore phaseflow-plan phaseflow-build phaseflow-build-visual phaseflow-review phaseflow-orchestrate phaseflow-doctor phaseflow-stop; do
    src="$SCRIPT_DIR/.opencode/command/$cmd.md"
    if [ -f "$src" ]; then
      cp "$src" "$GLOBAL_COMMANDS_DIR/$cmd.md"
      echo -e "  ${GREEN}✓${NC} $cmd (global)"
    fi
  done

  echo ""
  echo -e "${BOLD}→ Installing AGENTS.md globally${NC}"
  if [ -f "$SCRIPT_DIR/AGENTS.md" ]; then
    cp "$SCRIPT_DIR/AGENTS.md" "$HOME/.config/opencode/AGENTS.md"
    echo -e "  ${GREEN}✓${NC} AGENTS.md (global)"
  fi

  # Merge into global opencode.json
  echo ""
  echo -e "${BOLD}→ Checking global opencode.json${NC}"
  if [ ! -f "$GLOBAL_CONFIG" ]; then
    if [ -f "$REPO_JSON" ]; then
      cp "$REPO_JSON" "$GLOBAL_CONFIG"
      echo -e "  ${GREEN}✓${NC} Created global opencode.json"
    fi
  else
    node -e "
      const fs = require('fs');
      const target = JSON.parse(fs.readFileSync('$GLOBAL_CONFIG', 'utf8'));
      const template = JSON.parse(fs.readFileSync('$REPO_JSON', 'utf8'));
      let changed = false;

      // Merge root permission block — add inherit-task if missing
      if (!target.permission) {
        target.permission = {};
      }
      if (target.permission['inherit-task'] !== 'allow') {
        target.permission['inherit-task'] = 'allow';
        changed = true;
      }

      // Merge plugin registration
      if (!target.plugin) target.plugin = [];
      if (!target.plugin.includes('model-inheritance')) {
        target.plugin.push('model-inheritance');
        changed = true;
      }

      // Merge agent definitions
      if (!target.agent) target.agent = {};
      for (const [name, def] of Object.entries(template.agent || {})) {
        if (!target.agent[name]) {
          target.agent[name] = def;
          changed = true;
        }
      }

      // Patch orchestrator permissions: ensure task:allow + inherit-task:allow
      // (even if the agent definition already exists from a previous install)
      const orch = target.agent['phaseflow-orchestrator'];
      if (orch && orch.permission) {
        if (orch.permission.task !== 'allow') {
          orch.permission.task = 'allow';
          changed = true;
        }
        if (orch.permission['inherit-task'] !== 'allow') {
          orch.permission['inherit-task'] = 'allow';
          changed = true;
        }
      }

      if (changed) {
        fs.writeFileSync('$GLOBAL_CONFIG', JSON.stringify(target, null, 2) + '\n');
        console.log('  ${GREEN}✓${NC} Global config updated with PhaseFlow agents');
      } else {
        console.log('  ${GREEN}✓${NC} PhaseFlow agents already in global config');
      }
    " 2>/dev/null || echo -e "  ${YELLOW}⚠ Could not update global config. Check manually.${NC}"
  fi
fi

# ── Verify installed permissions ─────────────
echo ""
echo -e "${BOLD}→ Verifying installed files${NC}"
VERIFY_ERRORS=0

# Check orchestrator has inherit-task AND task (fallback)
ORCH_FILE="$OPENCODE_DIR/agents/phaseflow-orchestrator.md"
if [ -f "$ORCH_FILE" ]; then
  if grep -q "inherit-task" "$ORCH_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator: inherit-task allowed"
  else
    echo -e "  ${RED}✖${NC} Orchestrator: missing inherit-task permission!"
    VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
  fi
  if grep -q "task: allow" "$ORCH_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator: task allowed (fallback)"
  else
    echo -e "  ${YELLOW}⚠${NC} Orchestrator: missing task: allow (recommended as fallback)"
  fi
fi

# Check builder has task: deny
BUILDER_FILE="$OPENCODE_DIR/agents/phaseflow-builder.md"
if [ -f "$BUILDER_FILE" ]; then
  if grep -q "task: deny" "$BUILDER_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Builder: task denied"
  else
    echo -e "  ${YELLOW}⚠${NC} Builder: missing task: deny (recommended)"
  fi
fi

# Check command files have inherit-task + task
for cmd_file in "$OPENCODE_DIR/command/"*.md; do
  cmd_name="$(basename "$cmd_file")"
  if [ "$cmd_name" != "phaseflow-orchestrate.md" ]; then
    if grep -q "inherit-task:" "$cmd_file" 2>/dev/null; then
      : # OK
    else
      echo -e "  ${YELLOW}⚠${NC} $cmd_name: missing inherit-task (manual commands use default model)"
    fi
  fi
done

# Check orchestrate command has inherit-task AND task
ORCH_CMD="$OPENCODE_DIR/command/phaseflow-orchestrate.md"
if [ -f "$ORCH_CMD" ]; then
  if grep -q "inherit-task:" "$ORCH_CMD" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} phaseflow-orchestrate command: inherit-task available"
  else
    echo -e "  ${RED}✖${NC} phaseflow-orchestrate command: missing inherit-task!"
    VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
  fi
  if grep -q "task:" "$ORCH_CMD" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} phaseflow-orchestrate command: task available (fallback)"
  else
    echo -e "  ${YELLOW}⚠${NC} phaseflow-orchestrate command: missing task (recommended as fallback)"
  fi
fi

if [ "$VERIFY_ERRORS" -gt 0 ]; then
  echo -e "  ${YELLOW}⚠ $VERIFY_ERRORS critical issue(s) found. Re-run install to fix.${NC}"
fi

# ── Summary ──────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅  PhaseFlow Nano installed successfully!  ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Files installed:${NC}"
    echo -e "    ${CYAN}•${NC} 8 agents        → ${CYAN}.opencode/agents/${NC}"
    echo -e "    ${CYAN}•${NC} 8 commands      → ${CYAN}.opencode/command/${NC}"
    echo -e "    ${CYAN}•${NC} 6 templates     → ${CYAN}templates/${NC}"
if [ "$INSTALL_PLUGIN" = true ]; then
    echo -e "    ${CYAN}•${NC} Plugin files    → ${CYAN}.opencode/plugins/model-inheritance/${NC}"
fi
echo -e "    ${CYAN}•${NC} AGENTS.md       → ${CYAN}$PROJECT_DIR/AGENTS.md${NC}"
echo ""
echo -e "  ${BOLD}Quick start:${NC}"
echo -e "    ${CYAN}/phaseflow-plan${NC}          Plan a project into phases"
echo -e "    ${CYAN}/phaseflow-build${NC}         Execute the next pending phase"
echo -e "    ${CYAN}/phaseflow-build-visual${NC}  Execute a UI/frontend phase"
echo -e "    ${CYAN}/phaseflow-review${NC}        Review the last completed phase"
echo -e "    ${CYAN}/phaseflow-explore${NC}       Analyze an existing codebase"
echo -e "    ${CYAN}/phaseflow-orchestrate${NC}   Run the full pipeline automatically"
echo -e "    ${CYAN}/phaseflow-doctor${NC}        Diagnose project health (read-only)"
echo -e "    ${CYAN}/phaseflow-stop${NC}          Pause the current phase safely"
echo ""
echo -e "  ${YELLOW}💡 Tip:${NC} Restart OpenCode for changes to take effect."
echo -e "  ${YELLOW}💡 Tip:${NC} Use ${CYAN}--global${NC} to install system-wide from any project."
echo -e "  ${YELLOW}💡 Tip:${NC} Use ${CYAN}--plugin${NC} to install the model-inheritance plugin."
echo -e "  ${YELLOW}💡 Tip:${NC} Use ${CYAN}/phaseflow-orchestrate --gsd${NC} to sync results to GSD .planning/ files."
echo ""
