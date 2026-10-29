# AGENTS.md — Punto de entrada para agentes/LLMs

Lee este fichero antes que cualquier otro: es el mapa. No leas todos los repos; ve solo a lo enlazado.

> Plantilla del kit de seguimiento (tracker v2). Todo lo marcado con **[EDITAR]**
> debe adaptarse al proyecto nuevo antes de empezar. El protocolo de
> §Cómo registrar avances se mantiene tal cual.

## Qué es [EDITAR: nombre del proyecto]

[EDITAR: 3–5 líneas — qué es el producto, para quién, objetivo medible.]

- **[EDITAR: área 1]**: [qué hace / objetivo].
- **[EDITAR: área 2]**: [qué hace / objetivo].

## Repos [EDITAR: N repos git INDEPENDIENTES; la raíz es solo contenedor local]

| Repo | Stack | Rol |
|------|-------|-----|
| `[EDITAR: repo-1]` | [EDITAR: stack] | [EDITAR: rol] |
| `[EDITAR: repo-2]` | [EDITAR: stack] | [EDITAR: rol] |

Reglas anti-monorepo: sin imports cruzados por path relativo, sin CI compartidos; paridad
entre clientes solo vía [EDITAR: mecanismo — p. ej. semver API + feature flags + compat ≥2 versiones].

## Local [EDITAR: estado verificado YYYY-MM-DD]

[EDITAR: puertos, recetas de arranque por repo, perfiles/envs.]

## Verificación (la evidencia que exige la regla "done")

| Repo | Comandos |
|------|----------|
| [EDITAR: repo-1] | `[EDITAR: comando de tests/build]` |
| [EDITAR: repo-2] | `[EDITAR: comando de tests/build]` |

## Mapa de documentación (lee solo lo que necesites)

| Necesitas… | Ve a |
|------------|------|
| Histórico de hitos (todo lo hecho, append-only) | `MILESTONES.md` |
| Trabajo activo / próximo paso (estado vivo) | `CURRENT_PLAN.md`, se reescribe con cada avance |
| [EDITAR: arquitectura/decisiones] | [EDITAR: ruta] |
| [EDITAR: contrato API / fuente de verdad] | [EDITAR: ruta] |

## Reglas del proyecto

1. **Done = evidencia ejecutada** (tests/build/curl con salida), nunca intención.
2. [EDITAR: resto de reglas del proyecto — convenciones de código, i18n, secrets, arquitectura.]

## Cómo registrar avances (protocolo tracker v2 — mantenerlo siempre)

Tras terminar una **tarea importante** (cierra un gate, cambia producto/infra o entrega feature), en este orden:

1. `MILESTONES.md`: entrada **nueva arriba** en el Registro con formato
   `## <ids> — <título> | fecha YYYY-MM-DD | repos: a,b,c`, bullets cortos: qué se hizo, evidencia
   (comando → salida literal), notas honestas de límites/bugfixes. Append-only: nunca reescribir entradas pasadas (solo erratas).
2. `CURRENT_PLAN.md`: **reescribirlo** — quitar lo terminado, actualizar *Tareas activas*, *Próximo trabajo* y la tabla de
   *Última verificación por repo*. Si la tarea cierra un hito nuevo, asignarle el siguiente ID global libre (ver "Siguiente ID libre" del fichero).
3. Los dos ficheros deben poder leerse de forma independiente; `PLAN.MD` quedó como stub de redirección (no añadir contenido).

Regla "done" invariable: evidencia ejecutada (tests/build/curl con salida) + gate verificado. Sin eso, no hay ✅.

## Estado rápido [EDITAR: fecha]

[EDITAR: 2–4 líneas — dónde está el proyecto, próximo hito. Detalle y evidencia: `MILESTONES.md` / `CURRENT_PLAN.md`.]
