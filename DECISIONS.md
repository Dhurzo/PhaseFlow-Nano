# Project Decisions Log

> Key technical decisions made during execution.
> Updated by each builder after phase completion.
> Read by builders and reviewers for cross-phase context.

## Tracker Integration (2026-09-24)
- **[Architecture]:** 1 HITO = N fases (1–4 contiguas); MILESTONES solo en cierre-HITO REVIEWED para no saturar modelos locales.
- **[Convention]:** Tracker en raíz (MILESTONES/CURRENT_PLAN junto a plan.md); project-tracker-kit/ queda como fuente verbatim, templates/tracker/ como copia adaptada.
- **[Pattern]:** AGENTS.md fusionado (cabecera PhaseFlow + snippet tracker); builder toca solo Última verificación, reviewer cierra el HITO.
- **[Tooling]:** doctor --fix absorbe check-tracker.sh (5 checks + autofix Siguiente ID); MILESTONES append-only nunca se reescribe.