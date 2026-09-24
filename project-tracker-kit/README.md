# Kit de seguimiento de proyecto (tracker v2)

Plantilla reutilizable extraída de Coffreaks. Contenido del proyecto origen **no incluido**:
los starters de `MILESTONES.md` / `CURRENT_PLAN.md` están vacíos y `AGENTS.md` lleva
marcas `[EDITAR]`.

## Qué hay

| Fichero | Origen | Estado |
|---------|--------|--------|
| `AGENTS.md` | adaptado de Coffreaks | plantilla con `[EDITAR]`; protocolo de registro verbatim |
| `MILESTONES.md` | starter vacío | listo para el HITO 1 |
| `CURRENT_PLAN.md` | starter vacío | declara `HITO 1` como siguiente ID libre |
| `PLAN.MD` | copia verbatim | stub de redirección, no añadir contenido |
| `tracker-template/TEMPLATE.md` | copia verbatim | bloques de ejemplo para cada registro |
| `tools/check-tracker.sh` | copia verbatim | validador del tracker |
| `.gitignore` | adaptado | ignora los repos de producto |

## Reutilizar en un proyecto nuevo (5 pasos)

1. Copia el contenido de este kit a la raíz contenedora del proyecto nuevo
   (la raíz es contenedor local; cada repo de producto es su propio git).
2. Edita `AGENTS.md` (todo lo marcado `[EDITAR]`) y `.gitignore` (nombres de los repos).
3. Adapta `CURRENT_PLAN.md`: objetivo, tareas activas y próxima verificación.
4. Tras cada tarea importante, aplica el protocolo (`AGENTS.md` §Cómo registrar avances)
   usando los bloques de `tracker-template/TEMPLATE.md`.
5. Valida con `tools/check-tracker.sh` → debe imprimir `OK`.

## No forma parte del tracker de ningún proyecto

Este kit es material auxiliar: registrar avances aquí no aplica; no se versiona
con los repos de producto ni modifica sus `MILESTONES.md` / `CURRENT_PLAN.md`.
