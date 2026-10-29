# Project Decisions Log

> Key technical decisions made during execution.
> Updated by each builder after phase completion.
> Read by builders and reviewers for cross-phase context.

## OpenCode V2 Migration (2026-10-29)
- **[Target]:** OpenCode V2 (>= 2.0, tested on v2.2.1). Config, permissions, commands, agents and the plugin API are now V2-native.
- **[Config]:** `command`→`commands`, `agent`→`agents`, `permission` (map)→`permissions` (ordered rule array: action/resource/effect, last match wins), `subtask`→`subagent`, `plugin`→`plugins`.
- **[Actions]:** `bash`→`shell`, `task`→`subagent`, `write`/`patch`→`edit` (edit covers all three). Command frontmatter `tools:`/`argument-hint:` removed — rejected by `Config.CommandEncoded`.
- **[Layout]:** `.opencode/command/`→`.opencode/commands/` (legacy dir is still read by V2 and would shadow the new files, so `install.sh` removes it).
- **[Plugin]:** V2 plugin API (`ctx.tool.transform`, JSON-Schema `input`, `{content}` result, `ctx.session.get/context/create/prompt/wait`, `context.signal`). Zero dependencies — the definition object is exported directly instead of using `Plugin.define` (identity helper) or an npm package. Local plugins under `.opencode/plugins/` are auto-discovered, so no npm dependency or `plugins` entry is needed (adding one makes OpenCode try to fetch the package from the public registry → 404).
- **[Tool schema]:** `inherit-task` mirrors V2's built-in `subagent` field names (`agent`, `description`, `prompt`); the legacy `subagent_type` is still accepted at runtime.
- **[Config]:** `experimental.todo: true` (todos are off by default in V2) and `experimental.subagent_depth: 2` (the orchestrator is a subagent that launches subagents).
- **[Tooling]:** new `tools/migrate-config-v1-to-v2.js` (V1→V2 migration preserving unrelated settings) and `tools/merge-phaseflow-config.js` (PhaseFlow merge, `--dry-run`, `--skip-instructions`, JSONC comment preserving via `tools/jsonc-edit.js`).

## Tracker Integration (2026-09-24)
- **[Architecture]:** 1 HITO = N fases (1–4 contiguas); MILESTONES solo en cierre-HITO REVIEWED para no saturar modelos locales.
- **[Convention]:** Tracker en raíz (MILESTONES/CURRENT_PLAN junto a plan.md); project-tracker-kit/ queda como fuente verbatim, templates/tracker/ como copia adaptada.
- **[Pattern]:** AGENTS.md fusionado (cabecera PhaseFlow + snippet tracker); builder toca solo Última verificación, reviewer cierra el HITO.
- **[Tooling]:** doctor --fix absorbe check-tracker.sh (5 checks + autofix Siguiente ID); MILESTONES append-only nunca se reescribe.