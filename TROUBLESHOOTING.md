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

1. Verify the plugin is installed and active:
   ```bash
   opencode api get "/api/plugin?location%5Bdirectory%5D=$(pwd)"
   ```
   It should list `model-inheritance | local | active`.
2. Check the orchestrator permissions — should have a `subagent` allow **and** an `inherit-task` allow:
   ```bash
   node -e "const c=require('./opencode.json'); console.log(JSON.stringify(c.agents['phaseflow-orchestrator']?.permissions))"
   ```
3. Make sure the command file uses `inherit-task` (not `subagent`):
   ```bash
   head -7 .opencode/commands/phaseflow-orchestrate.md
   ```

> 💡 In OpenCode V2 the built-in `subagent` tool already inherits the parent
> session's model when the agent defines no `model` of its own. If a sub-agent
> still uses a different model, check whether that agent pins a `model` in
> `opencode.json` or in its `.md` frontmatter.

---

### Manual commands still use the wrong model (`/phaseflow-build`, `/phaseflow-plan`, etc.)

Manual commands (`/phaseflow-build`, `/phaseflow-plan`, `/phaseflow-review`) delegate
to the built-in `subagent` tool, which inherits the parent model unless the target
agent pins its own.

**Fix:** Remove any `model:` pin from the agent definition, or install the
model-inheritance plugin and let the command prefer `inherit-task`:

```bash
/path/to/phaseflow-nano/install.sh --plugin
```

Then update the command text in `.opencode/commands/` to prefer `inherit-task`.
See the [orchestrate command](.opencode/commands/phaseflow-orchestrate.md) for reference.

> ⚠️ **V1 leftovers:** the `tools:` frontmatter block (e.g. `task: true`) was
> removed in V2 — `Config.CommandEncoded` rejects unknown fields. If OpenCode
> reports a command validation error, delete the `tools:` block from the
> command's frontmatter.

Alternatively, use `/phaseflow-orchestrate` to run phases automatically — it always uses `inherit-task` correctly.

### Commands not showing up

- Commands must be in `.opencode/commands/` (project), `~/.config/opencode/commands/` (global), or defined inline in `opencode.json` under the `commands` key
- OpenCode V2 reloads command files automatically — **no restart needed** (V1 required one)
- Only `.md` files are discovered
- Verify the command file has valid YAML frontmatter (for file-based commands) or valid JSON (for inline commands in `opencode.json`)
- The legacy singular `command/` directory is still read by V2, but stale copies there shadow the new ones — delete it (`install.sh` removes it automatically)

---

### Config validation errors

OpenCode V2 permissions are an **ordered array of rules** with three string fields:

```jsonc
{ "action": "shell", "resource": "*", "effect": "allow" }
```

- `action` — permission action (`read`, `edit`, `glob`, `grep`, `shell`, `subagent`, `skill`, `question`, `webfetch`, `websearch`, `external_directory`, `<server>_<tool>`)
- `resource` — path, command, URL, query, skill id or agent id (`*` wildcards supported)
- `effect` — `allow`, `ask` or `deny`

The **last matching rule wins**, so put broad rules first and exceptions last.

Invalid values (like `"forbid"`, or a V1 `"permission": { ... }` map) will cause OpenCode to reject the entire config. Migrate with:

```bash
node tools/migrate-config-v1-to-v2.js opencode.json --dry-run
```

---

### "Missing key at ['description']" when dispatching a sub-agent

Both the built-in `subagent` tool and the `inherit-task` plugin require
`description`. The orchestrator prompt enforces this, but a manual call may not.

```text
inherit-task(
  agent: "phaseflow-builder",     # V2 field name — not `subagent_type`
  description: "Execute phase 2", # required
  prompt: "Execute phase 2 from plan.md."
)
```

---

### "subagent_depth" error — the orchestrator cannot launch builders

OpenCode V2 allows one level of subagent nesting by default. The orchestrator is
itself a subagent and launches builders/reviewers, so two levels are required:

```jsonc
{
  "experimental": {
    "subagent_depth": 2
  }
}
```

---

### Some models start to do random things while executing the plan in orchestrator mode

Use a model with more parameters and less quantization if possible. If not, try to use the builder and build phase by phase.