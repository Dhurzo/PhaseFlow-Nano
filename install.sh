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
mkdir -p "$OPENCODE_DIR/commands"

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

# ── Remove the legacy singular `command/` copies ────
# OpenCode V2 discovers both `command/` and `commands/`. The legacy copies from
# a previous install would shadow the V2 ones, so drop them once the new files
# are in place. Only PhaseFlow's own files are removed.
remove_legacy_commands() {
  local legacy_dir="$1"
  local current_dir="$2"
  [ -d "$legacy_dir" ] || return 0
  local removed=0
  for cmd in phaseflow-explore phaseflow-plan phaseflow-build phaseflow-build-visual phaseflow-review phaseflow-orchestrate phaseflow-doctor phaseflow-stop; do
    if [ -f "$legacy_dir/$cmd.md" ] && [ -f "$current_dir/$cmd.md" ]; then
      rm -f "$legacy_dir/$cmd.md"
      removed=$((removed + 1))
    fi
  done
  if [ "$removed" -gt 0 ]; then
    echo -e "  ${GREEN}✓${NC} Removed $removed legacy file(s) from ${CYAN}$legacy_dir${NC}"
  fi
  rmdir "$legacy_dir" 2>/dev/null || true
}

# ── Copy agent files ─────────────────────────
echo -e "${BOLD}→ Copying agents to ${CYAN}.opencode/agents/${NC}"
for agent in phaseflow-explorer phaseflow-planner phaseflow-builder phaseflow-builder-REFERENCE phaseflow-builder-visual phaseflow-reviewer phaseflow-orchestrator phaseflow-refiner phaseflow-doctor; do
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
echo -e "${BOLD}→ Copying commands to ${CYAN}.opencode/commands/${NC}"
for cmd in phaseflow-explore phaseflow-plan phaseflow-build phaseflow-build-visual phaseflow-review phaseflow-orchestrate phaseflow-doctor phaseflow-stop; do
  src="$SCRIPT_DIR/.opencode/commands/$cmd.md"
  dst="$OPENCODE_DIR/commands/$cmd.md"
  if [ -f "$src" ]; then
    echo -e -n "  ${BOLD}$cmd${NC} ... "
    safe_copy "$src" "$dst"
  else
    echo -e "  ${YELLOW}⚠ $cmd.md not found, skipping${NC}"
  fi
done

remove_legacy_commands "$OPENCODE_DIR/command" "$OPENCODE_DIR/commands"

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
  # Tracker templates (PhaseFlow + project-tracker-kit v2)
  if [ -d "$TEMPLATES_DIR/tracker" ]; then
    mkdir -p "$PROJECT_DIR/templates/tracker"
    for tmpl in "$TEMPLATES_DIR"/tracker/*; do
      [ -f "$tmpl" ] || continue
      tmpl_name="$(basename "$tmpl")"
      dst="$PROJECT_DIR/templates/tracker/$tmpl_name"
      if [ "$tmpl" != "$dst" ]; then
        cp "$tmpl" "$dst"
      fi
      echo -e "  ${GREEN}✓${NC} tracker/$tmpl_name"
    done
  fi
else
  echo -e "  ${YELLOW}⚠ templates/ directory not found, skipping${NC}"
fi

# ── Copy tracker validator + template (no overwrite of history) ──
echo ""
echo -e "${BOLD}→ Checking tracker files ${CYAN}(MILESTONES/CURRENT_PLAN)${NC}"
if [ -f "$SCRIPT_DIR/tools/check-tracker.sh" ]; then
  mkdir -p "$PROJECT_DIR/tools"
  if [ ! -f "$PROJECT_DIR/tools/check-tracker.sh" ]; then
    cp "$SCRIPT_DIR/tools/check-tracker.sh" "$PROJECT_DIR/tools/check-tracker.sh"
    chmod +x "$PROJECT_DIR/tools/check-tracker.sh"
    echo -e "  ${GREEN}✓${NC} tools/check-tracker.sh copied"
  else
    echo -e "  ${GREEN}✓${NC} tools/check-tracker.sh already exists — skipping"
  fi
fi
if [ -f "$SCRIPT_DIR/templates/tracker/TEMPLATE.md" ]; then
  mkdir -p "$PROJECT_DIR/tracker-template"
  if [ ! -f "$PROJECT_DIR/tracker-template/TEMPLATE.md" ]; then
    cp "$SCRIPT_DIR/templates/tracker/TEMPLATE.md" "$PROJECT_DIR/tracker-template/TEMPLATE.md"
    echo -e "  ${GREEN}✓${NC} tracker-template/TEMPLATE.md copied"
  else
    echo -e "  ${GREEN}✓${NC} tracker-template/TEMPLATE.md already exists — skipping"
  fi
fi
# NOTE: MILESTONES.md / CURRENT_PLAN.md / PLAN.MD are created by phaseflow-planner
# from templates/tracker/*-starter.md (never overwritten here to protect history).

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
  echo -e "  ${GREEN}✓${NC} opencode.json already exists — merging PhaseFlow definitions..."
  # Migrate the existing config to the native V2 shape and merge the PhaseFlow
  # definitions into it, preserving every unrelated setting.
  if command -v node &>/dev/null; then
    node "$SCRIPT_DIR/tools/merge-phaseflow-config.js" "$OPENCODE_JSON" "$REPO_JSON" || \
      echo -e "  ${YELLOW}⚠ Could not merge config automatically. Check $OPENCODE_JSON manually.${NC}"
  else
    echo -e "  ${YELLOW}⚠ node not found. Cannot merge config automatically.${NC}"
    echo -e "  ${YELLOW}  Verify opencode.json includes agents, commands, and AGENTS.md.${NC}"
  fi
fi

# ── Plugin installation ──────────────────────
if [ "$INSTALL_PLUGIN" = true ]; then
  echo ""
  echo -e "${BOLD}→ Installing model-inheritance plugin${NC}"

  PLUGIN_SRC="$SCRIPT_DIR/.opencode/plugins/model-inheritance"
  if [ "$INSTALL_GLOBAL" = true ]; then
    PLUGIN_DST="$HOME/.config/opencode/plugins/model-inheritance"
  else
    PLUGIN_DST="$OPENCODE_DIR/plugins/model-inheritance"
  fi

  if [ ! -d "$PLUGIN_SRC" ]; then
    echo -e "  ${YELLOW}⚠ Plugin source not found at ${CYAN}$PLUGIN_SRC${NC}"
  elif [ "$PLUGIN_SRC" = "$PLUGIN_DST" ]; then
    echo -e "  ${YELLOW}⏭ plugin already in place (self-install)${NC}"
  else
    mkdir -p "$PLUGIN_DST"
    # Copy the plugin sources only — never node_modules or lockfiles.
    for file in "$PLUGIN_SRC"/*.js "$PLUGIN_SRC"/*.json; do
      [ -f "$file" ] || continue
      cp "$file" "$PLUGIN_DST/"
    done
    echo -e "  ${GREEN}✓${NC} Plugin files copied to ${CYAN}$PLUGIN_DST${NC}"
  fi

  # OpenCode V2 auto-discovers local plugins under `.opencode/plugins/`
  # (and `~/.config/opencode/plugins/`), so neither a config registration nor
  # an npm dependency is required — adding one would make OpenCode try to
  # install the package from the public registry.
  echo -e "  ${GREEN}✓${NC} Plugin auto-discovered by OpenCode V2 (no registration needed)"
fi

# ── Global install ──
if [ "$INSTALL_GLOBAL" = true ]; then
  GLOBAL_AGENTS_DIR="$HOME/.config/opencode/agents"
  GLOBAL_COMMANDS_DIR="$HOME/.config/opencode/commands"
  GLOBAL_CONFIG="$HOME/.config/opencode/opencode.json"
  [ -f "$GLOBAL_CONFIG" ] || GLOBAL_CONFIG="$HOME/.config/opencode/opencode.jsonc"

  echo ""
  echo -e "${BOLD}→ Installing agents globally → ${CYAN}$GLOBAL_AGENTS_DIR${NC}"
  mkdir -p "$GLOBAL_AGENTS_DIR"
for agent in phaseflow-explorer phaseflow-planner phaseflow-builder phaseflow-builder-REFERENCE phaseflow-builder-visual phaseflow-reviewer phaseflow-orchestrator phaseflow-refiner phaseflow-doctor; do
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
    src="$SCRIPT_DIR/.opencode/commands/$cmd.md"
    if [ -f "$src" ]; then
      cp "$src" "$GLOBAL_COMMANDS_DIR/$cmd.md"
      echo -e "  ${GREEN}✓${NC} $cmd (global)"
    fi
  done

  remove_legacy_commands "$HOME/.config/opencode/command" "$GLOBAL_COMMANDS_DIR"

  # Merge into global opencode.json
  echo ""
  echo -e "${BOLD}→ Checking global ${CYAN}$GLOBAL_CONFIG${NC}"
  if [ ! -f "$GLOBAL_CONFIG" ]; then
    if [ -f "$REPO_JSON" ]; then
      cp "$REPO_JSON" "$GLOBAL_CONFIG"
      echo -e "  ${GREEN}✓${NC} Created global opencode.json"
    fi
  else
    # `--skip-instructions`: PhaseFlow's AGENTS.md must not leak into every project.
    node "$SCRIPT_DIR/tools/merge-phaseflow-config.js" "$GLOBAL_CONFIG" "$REPO_JSON" --skip-instructions || \
      echo -e "  ${YELLOW}⚠ Could not update global config. Check manually.${NC}"
  fi
fi

# ── Verify installed permissions ─────────────
echo ""
echo -e "${BOLD}→ Verifying installed files${NC}"
VERIFY_ERRORS=0

# Check orchestrator may launch sub-agents and the inherit-task tool
ORCH_FILE="$OPENCODE_DIR/agents/phaseflow-orchestrator.md"
if [ -f "$ORCH_FILE" ]; then
  if grep -q "inherit-task" "$ORCH_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator: inherit-task allowed"
  else
    echo -e "  ${RED}✖${NC} Orchestrator: missing inherit-task permission!"
    VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
  fi
  if grep -qE "action: subagent" "$ORCH_FILE" 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Orchestrator: subagent allowed (fallback)"
  else
    echo -e "  ${YELLOW}⚠${NC} Orchestrator: missing subagent allow (recommended as fallback)"
  fi
fi

# Check builder cannot launch sub-agents
BUILDER_FILE="$OPENCODE_DIR/agents/phaseflow-builder.md"
if [ -f "$BUILDER_FILE" ]; then
  # `grep -A` without `-q`: the quiet flag would suppress the piped output.
  if grep -A2 "action: subagent" "$BUILDER_FILE" 2>/dev/null | grep -q "effect: deny"; then
    echo -e "  ${GREEN}✓${NC} Builder: subagent denied"
  else
    echo -e "  ${YELLOW}⚠${NC} Builder: missing subagent deny (recommended)"
  fi
fi

# Check the commands live in the V2 directory
if [ -d "$OPENCODE_DIR/commands" ]; then
  COMMAND_COUNT=$(find "$OPENCODE_DIR/commands" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
  echo -e "  ${GREEN}✓${NC} ${COMMAND_COUNT} command(s) in .opencode/commands/"
else
  echo -e "  ${RED}✖${NC} Missing .opencode/commands/ directory!"
  VERIFY_ERRORS=$((VERIFY_ERRORS + 1))
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
    echo -e "    ${CYAN}•${NC} 9 agents        → ${CYAN}.opencode/agents/${NC}"
    echo -e "    ${CYAN}•${NC} 8 commands      → ${CYAN}.opencode/commands/${NC}"
    echo -e "    ${CYAN}•${NC} 6 phase + 5 tracker templates → ${CYAN}templates/${NC}"
    echo -e "    ${CYAN}•${NC} Tracker validator + entry template → ${CYAN}tools/check-tracker.sh${NC}, ${CYAN}tracker-template/TEMPLATE.md${NC}"
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
echo -e "    ${CYAN}/phaseflow-close-hito${NC}    Close a HITO — MILESTONES + CURRENT_PLAN update"
echo -e "    ${CYAN}/phaseflow-stop${NC}          Pause the current phase safely"
echo ""
echo -e "  ${YELLOW}💡 Tip:${NC} OpenCode V2 reloads config, agents, commands and plugins automatically."
echo -e "  ${YELLOW}💡 Tip:${NC} Use ${CYAN}--global${NC} to install system-wide from any project."
echo -e "  ${YELLOW}💡 Tip:${NC} Use ${CYAN}--plugin${NC} to install the model-inheritance plugin."
echo -e "  ${YELLOW}💡 Tip:${NC} Use ${CYAN}/phaseflow-orchestrate --gsd${NC} to sync results to GSD .planning/ files."
echo ""
