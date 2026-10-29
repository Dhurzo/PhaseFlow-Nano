# Snippet tracker para AGENTS.md fusionado
# El planner copia estas secciones al AGENTS.md del proyecto usuario.
# Fuente: project-tracker-kit/AGENTS.md (protocolo verbatim) + adaptación PhaseFlow.

## Mapa del producto [EDITAR]

> Todo lo marcado con **[EDITAR]** debe adaptarse al proyecto nuevo antes de empezar.

### Qué es [EDITAR: nombre del proyecto]

[EDITAR: 3–5 líneas — qué es el producto, para quién, objetivo medible.]

- **[EDITAR: área 1]**: [qué hace / objetivo].
- **[EDITAR: área 2]**: [qué hace / objetivo].

### Repos [EDITAR]

| Repo | Stack | Rol |
|------|-------|-----|
| `[EDITAR: repo-1]` | [EDITAR: stack] | [EDITAR: rol] |

Reglas anti-monorepo: sin imports cruzados por path relativo, sin CI compartidos.

### Local [EDITAR: estado verificado YYYY-MM-DD]

[EDITAR: puertos, recetas de arranque por repo, perfiles/envs.]

### Verificación (la evidencia que exige la regla "done")

| Repo | Comandos |
|------|----------|
| [EDITAR: repo-1] | `[EDITAR: comando de tests/build]` |
| [EDITAR: repo-2] | `[EDITAR: comando de tests/build]` |

### Mapa de documentación (lee solo lo que necesites)

| Necesitas… | Ve a |
|------------|------|
| Histórico de hitos (todo lo hecho, append-only) | `MILESTONES.md` |
| Trabajo activo / próximo paso (estado vivo) | `CURRENT_PLAN.md`, se reescribe con cada avance |
| Plan de fases PhaseFlow (cómo se ejecuta) | `plan.md` + `phases/phase-X.md` |
| Estado máquina de fases | `outputs/phase-X/.phase` (canónico), `plan.md` (vista derivada) |
| [EDITAR: arquitectura/decisiones] | [EDITAR: ruta] |

## Reglas del proyecto

1. **Done = evidencia ejecutada** (tests/build/curl con salida), nunca intención.
2. [EDITAR: resto de reglas — convenciones de código, i18n, secrets, arquitectura.]

## Cómo registrar avances (protocolo tracker v2 — mantenerlo siempre)

Tras terminar una **tarea importante** — con PhaseFlow: al cerrar un **HITO** (la fase con `Closes-HITO: yes` llega a `REVIEWED`) — en este orden:

1. `MILESTONES.md`: entrada **nueva arriba** en el Registro con formato
   `## <ids> — <título> | fecha YYYY-MM-DD | repos: a,b,c`, bullets cortos: qué se hizo, evidencia
   (comando → salida literal), notas honestas de límites/bugfixes. Append-only: nunca reescribir entradas pasadas (solo erratas).
   Fuente: `outputs/phase-*/SUMMARY.md ## TL;DR` + `REVIEW.md ## Final Verdict`. Formato exacto: `tracker-template/TEMPLATE.md`.
2. `CURRENT_PLAN.md`: **reescribirlo** — quitar lo terminado, actualizar *Tareas activas*, *Próximo trabajo*,
   *Mapa HITO ↔ Fases* y la tabla de *Última verificación por repo*. Si la tarea cierra un hito nuevo, asignarle el siguiente ID global libre.
3. Los dos ficheros deben poder leerse de forma independiente; `PLAN.MD` quedó como stub de redirección (no añadir contenido).

Regla "done" invariable: evidencia ejecutada (tests/build/curl con salida) + gate verificado. Sin eso, no hay ✅.

### Correspondencia Fase ↔ HITO (PhaseFlow + tracker)

- 1 HITO = 1–4 fases contiguas. Ver `plan.md → ## Mapa HITO ↔ Fases`.
- Fase intermedia (`Closes-HITO: no`): solo actualiza `CURRENT_PLAN.md → Última verificación por repo`.
- Fase cierre (`Closes-HITO: yes` + `REVIEWED`): ejecuta el protocolo completo de arriba.
- `DECISIONS.md` (append por fase) → `CURRENT_PLAN.md Decisiones recientes` (1 línea por HITO, nuevas arriba).

## Estado rápido [EDITAR: fecha]

[EDITAR: 2–4 líneas — dónde está el proyecto, próximo hito. Detalle y evidencia: `MILESTONES.md` / `CURRENT_PLAN.md`.]
