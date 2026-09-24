# Plantilla — entradas del tracker v2
# Copia verbatim de project-tracker-kit/tracker-template/TEMPLATE.md

Copiar/adaptar estos bloques al registrar una tarea importante (protocolo completo en `AGENTS.md` §Cómo registrar avances).
Verificar con: `tools/check-tracker.sh`.

## 1) Fila nueva del Índice (`MILESTONES.md`, sección *Índice* — encima de las anteriores)

```markdown
| <id> | YYYY-MM-DD | repo-a,repo-b | <título corto> | <gate cumplido en una frase> | <evidencia resumen: métricas/comandos clave> |
```

- Varios hitos cerrados por la misma entrega: IDs separados por coma (p. ej. `| 15, 16, 17 | ...`).
- Trabajo sin numerar: primera celda `(sin hito)`.

## 2) Entrada nueva del Registro (`MILESTONES.md`, sección *Registro* — ARRIBA de las anteriores)

```markdown
## <id> o "a, b, c" — <título corto y concreto> | YYYY-MM-DD | repos: a,b,c

- **Qué se hizo** ✅: bullets cortos, uno por cambio relevante (qué ficheros/ámbito, decisiones).
  - Bug fixes del camino con causa→efecto en el mismo bullet.
- **Evidencia ejecutada**: comando → salida literal (cifras reales, no adjetivos); rutas de artefactos si aplica.
- **Límites honestos / pendiente**: lo que NO se verificó y por qué; deuda para V2/seguida.
```

Reglas: fecha real o `—` si el trabajo es histórico sin fecha conocida; append-only (esto no se reescribe después);
sin ✅ sin evidencia ejecutada + gate verificado.

## 3) Reescritura de `CURRENT_PLAN.md` (siempre completo, nunca incremental)

- *Tareas activas*: quitar lo terminado (con su evidencia final), añadir lo nuevo en curso.
- *Próximo trabajo*: ordenar por prioridad; el primer punto es lo que se hace a continuación.
- *Última verificación por repo*: tabla `repo | comando → salida | fecha` con las corridas de esta entrega.
- Última línea: `Siguiente ID libre de hito: **HITO <max+1>**.` (lo valida `tools/check-tracker.sh`).

## 4) Variante PhaseFlow (1 HITO = N fases)

- Fuente de la evidencia: `outputs/phase-X/SUMMARY.md ## TL;DR` de cada fase del HITO + `REVIEW.md ## Final Verdict`.
- Solo la fase con `Closes-HITO: yes` ejecuta este protocolo (cuando llega a `REVIEWED`).
- Fases intermedias: solo actualizan `CURRENT_PLAN.md → Última verificación por repo`, no tocan `MILESTONES.md`.
