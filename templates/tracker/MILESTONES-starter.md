# MILESTONES.md — [EDITAR: proyecto] · Registro histórico de hitos
# Starter copiado de project-tracker-kit. Ver project-tracker-kit/README.md y tracker-template/TEMPLATE.md.

Reglas (inamovibles):

1. **Append-only**: las entradas nuevas van arriba en el *Registro*; lo escrito no se reescribe (solo erratas).
2. **Done = evidencia ejecutada** (tests/build/curl con salida) + gate verificado. Sin eso, no hay ✅.
3. Los IDs de hito son globales e inmutables; el siguiente ID libre es el que indique `CURRENT_PLAN.md`.
4. El trabajo activo (no terminado) NO va aquí: vive en `CURRENT_PLAN.md`.
5. **Con PhaseFlow:** 1 HITO = N fases. La entrada se crea solo cuando la fase con `Closes-HITO: yes` llega a `REVIEWED`. Fuente de la evidencia: `outputs/phase-X/SUMMARY.md ## TL;DR`.

Leyenda: ✅ done · 🔶 in progress · ⬜ pending · ❌ blocked

Formato de entrada: `## <ids> — <título> | fecha YYYY-MM-DD o — | repos: a,b,c`
(ids separados por coma si una entrega cierra varios hitos; `(sin hito)` para trabajo sin numerar).

## Índice

| ID | Fecha | Repos | Hito | Gate cumplido | Evidencia resumen |
|----|-------|-------|------|---------------|-------------------|

## Registro

_(Entradas nuevas arriba. Cada entrega con evidencia ejecutada tiene su entrada.
Ver ejemplos de formato en `tracker-template/TEMPLATE.md`.)_
