#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# PhaseFlow Nano Updater
# Pulls latest changes and reinstalls
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
echo -e "${CYAN}${BOLD}║        PhaseFlow Nano Updater               ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Parse flags ──────────────────────
TARGET_DIR=""
INSTALL_PLUGIN=false
INSTALL_GLOBAL=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --help|-h)
      echo -e "${BOLD}Usage:${NC} $0 [--plugin] [--global] [--force] [target-directory]"
      echo ""
      echo -e "  ${BOLD}Flags:${NC}"
      echo -e "    ${CYAN}--plugin${NC}    Also update the model-inheritance plugin"
      echo -e "    ${CYAN}--global${NC}    Update global installation (~/.config/opencode/)"
      echo -e "    ${CYAN}--force${NC}     Skip confirmation prompt"
      echo -e "    ${CYAN}--help${NC}      Show this help message"
      echo ""
      echo -e "  ${BOLD}Examples:${NC}"
      echo -e "    $0                          # Update current directory"
      echo -e "    $0 /path/to/project         # Update another project"
      echo -e "    $0 --global                # Update global installation"
      echo -e "    $0 --plugin               # Update + plugin"
      echo -e "    $0 --force                # Skip confirmation"
      exit 0
      ;;
    --plugin) INSTALL_PLUGIN=true ;;
    --global) INSTALL_GLOBAL=true ;;
    --force)  FORCE=true ;;
    *)        TARGET_DIR="$arg" ;;
  esac
done

# ── Verify we're in a git repo ────────
if [ ! -d "$SCRIPT_DIR/.git" ]; then
  echo -e "${RED}✖ Error: PhaseFlow Nano directory is not a git repository.${NC}"
  echo -e "  ${YELLOW}If you installed via copy, re-download from GitHub instead.${NC}"
  exit 1
fi

# ── Show current version ─────────────
CURRENT_BRANCH=$(git -C "$SCRIPT_DIR" branch --show-current 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git -C "$SCRIPT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "  ${BOLD}Branch:${NC}   $CURRENT_BRANCH"
echo -e "  ${BOLD}Commit:${NC}   $CURRENT_COMMIT"
echo ""

# ── Confirm update ────────────────────
if [ "$FORCE" != true ]; then
  echo -e "  ${YELLOW}This will pull the latest changes and reinstall.${NC}"
  echo -e "  ${YELLOW}Your project files will be updated.${NC}"
  echo ""
  read -p "  Continue? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "  ${YELLOW}Update cancelled.${NC}"
    exit 0
  fi
fi

# ── Pull latest changes ───────────────
echo ""
echo -e "${BOLD}→ Pulling latest changes from git${NC}"

CURRENT_COMMIT_BEFORE=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null)

if ! git -C "$SCRIPT_DIR" pull --rebase --autostash 2>/dev/null; then
  echo -e "  ${YELLOW}⚠ git pull failed. Trying git fetch + reset...${NC}"
  if ! git -C "$SCRIPT_DIR" fetch origin 2>/dev/null; then
    echo -e "${RED}✖ Error: Could not fetch from remote. Check your network.${NC}"
    exit 1
  fi
  # Try to reset to remote branch
  REMOTE_BRANCH=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref @{u} 2>/dev/null || echo "origin/$CURRENT_BRANCH")
  if ! git -C "$SCRIPT_DIR" reset --hard "$REMOTE_BRANCH" 2>/dev/null; then
    echo -e "${RED}✖ Error: Could not reset to remote. Resolve conflicts manually.${NC}"
    exit 1
  fi
fi

CURRENT_COMMIT_AFTER=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null)

if [ "$CURRENT_COMMIT_BEFORE" = "$CURRENT_COMMIT_AFTER" ]; then
  echo -e "  ${GREEN}✓${NC} Already up to date (${CURRENT_COMMIT_AFTER:0:7})"
else
  echo -e "  ${GREEN}✓${NC} Updated: ${CURRENT_COMMIT_BEFORE:0:7} → ${CURRENT_COMMIT_AFTER:0:7}"
fi

# ── Run installer ─────────────────────
echo ""
echo -e "${BOLD}→ Reinstalling updated files${NC}"
echo ""

INSTALL_ARGS=""
if [ "$INSTALL_PLUGIN" = true ]; then
  INSTALL_ARGS="$INSTALL_ARGS --plugin"
fi
if [ "$INSTALL_GLOBAL" = true ]; then
  INSTALL_ARGS="$INSTALL_ARGS --global"
fi
if [ -n "$TARGET_DIR" ]; then
  INSTALL_ARGS="$INSTALL_ARGS $TARGET_DIR"
fi

# Run install.sh from the repo
if ! bash "$SCRIPT_DIR/install.sh" $INSTALL_ARGS; then
  echo ""
  echo -e "${RED}✖ Installer encountered errors. Check output above.${NC}"
  exit 1
fi

# ── Summary ──────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅  PhaseFlow Nano updated successfully!   ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Updated to:${NC} ${CURRENT_COMMIT_AFTER:0:7}"
echo -e "  ${YELLOW}💡 Tip:${NC} Restart OpenCode for changes to take effect."
echo ""
