#!/usr/bin/env bash
# check-tracker.sh — valida la integridad del tracker v2 (MILESTONES.md + CURRENT_PLAN.md).
# Uso: tools/check-tracker.sh   → salida "OK" si todo cuadra; lista de fallos y exit 1 en caso contrario.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
M="$ROOT/MILESTONES.md"
C="$ROOT/CURRENT_PLAN.md"
P="$ROOT/PLAN.MD"

fail() { printf 'FAIL: %s\n' "$1"; }

errs=0
if [[ ! -f $M ]]; then fail "falta MILESTONES.md"; exit 1; fi
if [[ ! -f $C ]]; then fail "falta CURRENT_PLAN.md"; exit 1; fi
if [[ ! -f $P ]] || ! grep -q "MOVIDO" "$P"; then fail "PLAN.MD debe existir como stub de redirección (contiene 'MOVIDO')"; errs=1; fi

# Cabeceras válidas del Registro:
#   ## <ids> — <título> | <YYYY-MM-DD|—> | repos: a,b[,c]      (ids = números separados por ", ")
#   ## (sin hito) — <título> | <YYYY-MM-DD|—> | repos: a,b[,c]
ENTRY_RE='^## ([0-9]+(, [0-9]+)*|\(sin hito\)) — .+ \| ([0-9]{4}-[0-9]{2}-[0-9]{2}|—) \| repos: [a-z][a-z0-9]*(,[a-z][a-z0-9]*)*$'

# 1) Toda cabecera bajo "## Registro" cumple el formato (los títulos llevan acentos, se valida por estructura).
bad_headings=$(awk '/^## Registro$/{r=1;next} r && /^## /{print}' "$M" | grep -Ev "$ENTRY_RE" || true)
if [[ -n $bad_headings ]]; then errs=1; while IFS= read -r l; do fail "cabecera de entrada malformada: $l"; done <<<"$bad_headings"; fi

# Extrae solo los IDs numéricos de las entradas del Registro (una línea por entrada).
entry_ids() { awk '/^## Registro$/{r=1;next} r && /^## [0-9]+(, [0-9]+)* — /{s=$0; sub(/^## /,"",s); sub(/ — .*$/,"",s); gsub(/,/," ",s); print s}' "$M"; }

# 2) Todo ID usado en una entrada existe como fila del Índice (| <id> | ...).
ids=$(entry_ids | tr ' ' '\n' || true)
for id in $ids; do
  if ! grep -q "^| ${id} |" "$M"; then errs=1; fail "ID $id usado en el Registro pero sin fila en el Índice"; fi
done

# 3) (sin hito): si hay entradas sin ID debe existir la fila "| (sin hito) |" en el Índice.
if grep -q '^## (sin hito) — ' "$M" && ! awk '/^## Índice$/,/^## Registro$/' "$M" | grep -q '^| (sin hito) |'; then
  errs=1; fail "hay entradas '(sin hito)' en el Registro pero sin fila en el Índice"; fi

# 4) Sin entradas duplicadas (mismos ids + mismo título).
dups=$(awk '/^## Registro$/{r=1;next} r && /^## /{print $0}' "$M" | sort | uniq -d || true)
if [[ -n $dups ]]; then errs=1; while IFS= read -r l; do fail "entrada duplicada: $l"; done <<<"$dups"; fi

# 5) "Siguiente ID libre" en CURRENT_PLAN == max(IDs del Registro)+1.
max_id=$(entry_ids | tr ' ' '\n' | sort -n | tail -1 || true)
expected=$(( ${max_id:-0} + 1 ))
declared=$(grep -oE 'Siguiente ID libre de hito: \*\*HITO [0-9]+\*\*' "$C" | grep -oE '[0-9]+' | head -1 || true)
if [[ -z $declared ]]; then errs=1; fail "CURRENT_PLAN.md no declara 'Siguiente ID libre de hito: **HITO N**'"
elif [[ $declared != $expected ]]; then errs=1; fail "Siguiente ID libre declarado ($declared) ≠ esperado ($expected = max($max_id)+1)"; fi

if ((errs)); then exit 1; fi
echo "OK — IDs del Registro hasta $max_id, siguiente ID libre $expected verificado"
