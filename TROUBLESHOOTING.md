# 🩺 Troubleshooting

---

### Phase paused with "Token bailout — context low"

The agent detected its context window was nearly full (≤25%) and stopped to avoid
silent overflow / hallucination. This is expected for large phases on small models.

**To resume:**
1. Run the builder again on the same phase — it will read `outputs/phase-X/CHECKPOINT.md`
   to find where it left off.
2. If it happens repeatedly, split the phase into smaller sub-phases in `plan.md`.

The bailout mechanism saves progress in `CHECKPOINT.md` so no work is lost.

---

### Builder created a nested project (e.g. `smb3_clone/` inside my project)

This happens when the planner generates ambiguous Phase 1 tasks or when a small model
misinterprets `cargo init` vs `cargo new`.

**Fix (planner side):** Ensure Phase 1 tasks say explicitly:
- "Run `cargo init` in the current directory (NO subdirectory)"
- Not "Initialize a new Rust project"

**Fix (builder side):** The builder now runs **Step 4.8 — Detect Existing Project Structure**
before any init command. If `Cargo.toml` / `package.json` / `pyproject.toml` already exist,
it skips initialization entirely.

*See agent prompts for the full logic:*
- `phaseflow-planner.md` → Step 6, Anti-Patterns, Small Model Adaptation sections
- `phaseflow-builder.md` → Step 4.8, Step 6 preconditions, Small Model Adaptation sections

---

### Sub-agents still use the wrong model

1. Verify the plugin is installed:
   ```bash
   node -e "require('model-inheritance'); console.log('✅')"
   ```
2. Check the orchestrator permissions — should have `"task": "allow"` and `"inherit-task": "allow"`:
   ```bash
   node -e "const c=require('./opencode.json'); console.log(JSON.stringify(c.agent['phaseflow-orchestrator']?.permission))"
   ```
3. Make sure the command file uses `inherit-task` (not `task`):
   ```bash
   head -7 .opencode/command/phaseflow-orchestrate.md
   ```

---

### Manual commands still use the wrong model (`/phaseflow-build`, `/phaseflow-plan`, etc.)

Manual commands (`/phaseflow-build`, `/phaseflow-plan`, `/phaseflow-review`) use the built-in `task` tool by default, which may not inherit the parent session's model.

**Fix:** Install the model-inheritance plugin, then edit each command file in `.opencode/command/` to enable `inherit-task` alongside `task`:

```yaml
tools:
  task: true
  inherit-task: true
```

Then update the command text to prefer `inherit-task`. The command template will then use `inherit-task` when available (inheriting your model) and fall back to `task` otherwise. See the [orchestrate command](.opencode/command/phaseflow-orchestrate.md) for reference.

Alternatively, use `/phaseflow-orchestrate` to run phases automatically — it always uses `inherit-task` correctly.

### Commands not showing up

- Commands must be in `.opencode/command/` (project), `~/.config/opencode/command/` (global), or defined inline in `opencode.json` under the `command` key
- Restart OpenCode after adding new commands
- Verify the command file has valid YAML frontmatter (for file-based commands) or valid JSON (for inline commands in `opencode.json`)

---

### Config validation errors

OpenCode supports these permission values:
- `"allow"` — always allowed
- `"ask"` — ask the user
- `"deny"` — always denied

Invalid values (like `"forbid"`) will cause OpenCode to reject the entire config.

---

### Some models start to do random things while executing the plan in orchestrator mode

Use a model with more parameters and less quantization if possible. If not, try to use the builder and build phase by phase.