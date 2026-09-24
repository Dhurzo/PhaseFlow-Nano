/**
 * test-tracker.js — Tests for PhaseFlow + project-tracker-kit v2 integration
 *
 * Covers the contract both systems share (no fixtures in repo root):
 * - 1 HITO = N fases (Mapa HITO ↔ Fases parsing)
 * - ## HITO block in phase templates (Part-Of / Closes-HITO / Gate-HITO)
 * - MILESTONES entry header format (ENTRY_RE from tools/check-tracker.sh)
 * - Siguiente ID libre == max(Registro IDs)+1
 * - Templates + validator files exist
 *
 * Run with: node --test tests/test-tracker.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY_RE =
  /^## ([0-9]+(, [0-9]+)*|\(sin hito\)) — .+ \| ([0-9]{4}-[0-9]{2}-[0-9]{2}|—) \| repos: [a-z][a-z0-9]*(,[a-z][a-z0-9]*)*$/;

function entryIds(registroText) {
  const ids = [];
  let inRegistro = false;
  for (const line of registroText.split("\n")) {
    if (/^## Registro$/.test(line)) { inRegistro = true; continue; }
    if (!inRegistro) continue;
    const m = line.match(/^## ([0-9]+(, [0-9]+)*) — /);
    if (m) for (const id of m[1].split(",")) ids.push(parseInt(id.trim(), 10));
  }
  return ids;
}

describe("tracker integration", () => {
  it("templates/tracker/ starters exist", () => {
    for (const f of ["MILESTONES-starter.md", "CURRENT_PLAN-starter.md", "PLAN.MD.stub", "TEMPLATE.md", "AGENTS-tracker-snippet.md"]) {
      assert.ok(existsSync(join(ROOT, "templates/tracker", f)), `missing templates/tracker/${f}`);
    }
  });

  it("tools/check-tracker.sh exists and is executable logic (ENTRY_RE present)", () => {
    const p = join(ROOT, "tools/check-tracker.sh");
    assert.ok(existsSync(p), "missing tools/check-tracker.sh");
    const src = readFileSync(p, "utf8");
    assert.ok(src.includes("ENTRY_RE="), "validator must define ENTRY_RE");
    assert.ok(src.includes("Siguiente ID libre"), "validator must check Siguiente ID libre");
  });

  it("all phase templates contain ## HITO block", () => {
    const files = readdirSync(join(ROOT, "templates")).filter((f) => f.startsWith("phase-") && f.endsWith(".md"));
    assert.ok(files.length >= 6, `expected >=6 phase templates, got ${files.length}`);
    for (const f of files) {
      const src = readFileSync(join(ROOT, "templates", f), "utf8");
      assert.ok(/^## HITO$/m.test(src), `${f} missing ## HITO`);
      assert.ok(/Part-Of: HITO/.test(src), `${f} missing Part-Of`);
      assert.ok(/Closes-HITO:/.test(src), `${f} missing Closes-HITO`);
    }
  });

  it("MILESTONES entry header format accepts valid / rejects invalid", () => {
    assert.ok(ENTRY_RE.test("## 1 — Auth backend | 2026-09-24 | repos: api,web"));
    assert.ok(ENTRY_RE.test("## 2, 3 — Pagos + webhooks | 2026-09-24 | repos: api"));
    assert.ok(ENTRY_RE.test("## (sin hito) — Spike auth | — | repos: api"));
    assert.ok(!ENTRY_RE.test("## HITO 1 — Auth | 2026-09-24 | repos: api"), "HITO prefix not allowed in entry header");
    assert.ok(!ENTRY_RE.test("## 1 - Auth | 2026-09-24 | repos: api"), "must use em-dash —");
    assert.ok(!ENTRY_RE.test("## 1 — Auth | 24/09/2026 | repos: api"), "date must be YYYY-MM-DD or —");
  });

  it("Siguiente ID libre rule: max(ids)+1", () => {
    const sample = [
      "## Registro",
      "## 2 — B | 2026-09-24 | repos: api",
      "## 1 — A | 2026-09-23 | repos: api",
    ].join("\n");
    const ids = entryIds(sample);
    assert.deepEqual(ids.sort((a, b) => a - b), [1, 2]);
    assert.equal(Math.max(...ids) + 1, 3);
    assert.deepEqual(entryIds("## Registro\n_(vacío)_"), []);
  });

  it("planner/builder/reviewer/doctor mention tracker protocol", () => {
    const checks = [
      ["phaseflow-planner.md", /Mapa HITO ↔ Fases/],
      ["phaseflow-builder.md", /Closes-HITO/],
      ["phaseflow-reviewer.md", /Closes-HITO: yes/],
      ["phaseflow-doctor.md", /check-tracker/],
    ];
    for (const [f, re] of checks) {
      const src = readFileSync(join(ROOT, ".opencode/agents", f), "utf8");
      assert.ok(re.test(src), `${f} must mention tracker (${re})`);
    }
  });

  it("opencode.json has phaseflow-close-hito + tracker-aware status", () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, "opencode.json"), "utf8"));
    assert.ok(cfg.command["phaseflow-close-hito"], "missing command phaseflow-close-hito");
    assert.ok(/Mapa HITO/.test(cfg.command["phaseflow-status"].template), "status must include HITO map");
  });
});
