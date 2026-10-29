#!/usr/bin/env node
/**
 * merge-phaseflow-config.js — merge the PhaseFlow definitions into a project config.
 *
 * Usage:
 *   node tools/merge-phaseflow-config.js <target-config.json> <template-config.json> [--dry-run] [--skip-instructions]
 *
 * Steps:
 *   1. Migrate the target config from the V1 shape to the native V2 shape.
 *   2. Add the PhaseFlow agents, commands, permissions and experimental flags.
 *   3. Write the result back, preserving every unrelated setting.
 *
 * `--skip-instructions` leaves the `instructions` list untouched — used for the
 * global install, where PhaseFlow's AGENTS.md must not leak into every project.
 *
 * A JSONC file that contains comments is never rewritten — the comments would be
 * lost. The script reports the problem and exits with code 2 instead.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { hasComments, migrateConfig } from "./migrate-config-v1-to-v2.js";
import { removePluginEntries, renameTopLevelKey } from "./jsonc-edit.js";

/**
 * Plugin entries that must not stay in the config.
 *
 * OpenCode V2 auto-discovers local plugins under `.opencode/plugins/` and
 * `~/.config/opencode/plugins/`. Leaving the package name in the config makes
 * OpenCode try to install it from the public registry, which fails.
 */
const OBSOLETE_PLUGIN_ENTRIES = ["model-inheritance"];

/**
 * Ensure a permission rule exists in an ordered rule array.
 *
 * @param {Array<{ action: string, resource: string, effect: string }>} rules
 * @param {{ action: string, resource: string, effect: string }} rule
 * @returns {boolean} whether the array changed
 */
function ensureRule(rules, rule) {
  const exists = rules.some(
    (r) => r && r.action === rule.action && r.resource === rule.resource && r.effect === rule.effect,
  );
  if (exists) return false;
  rules.push(rule);
  return true;
}

/**
 * Root permission rules PhaseFlow itself needs.
 *
 * The rest of the template's root rules belong to the PhaseFlow agent
 * definitions and are only applied to the agents PhaseFlow creates. Merging
 * them into an existing config would override the user's own rules, because in
 * V2 the last matching rule wins.
 */
const PHASEFLOW_ROOT_RULES = [{ action: "inherit-task", resource: "*", effect: "allow" }];

/**
 * Merge the PhaseFlow template into a target config.
 *
 * @param {Record<string, any>} target
 * @param {Record<string, any>} template
 * @returns {{ config: Record<string, any>, changed: boolean }}
 */
export function mergePhaseFlow(target, template, options = {}) {
  const { config, changed: migrated } = migrateConfig(target || {});
  const out = { ...config };
  let changed = migrated;

  // ── Instructions ───────────────────────────────────────
  if (!options.skipInstructions) {
    if (!Array.isArray(out.instructions)) out.instructions = [];
    if (!out.instructions.includes("AGENTS.md")) {
      out.instructions.push("AGENTS.md");
      changed = true;
    }
  }

  // ── Commands ───────────────────────────────────────────
  if (!out.commands || typeof out.commands !== "object") out.commands = {};
  for (const [name, definition] of Object.entries(template.commands || {})) {
    if (!out.commands[name]) {
      out.commands[name] = definition;
      changed = true;
    }
  }

  // ── Agents ─────────────────────────────────────────────
  if (!out.agents || typeof out.agents !== "object") out.agents = {};
  for (const [name, definition] of Object.entries(template.agents || {})) {
    if (!out.agents[name]) {
      out.agents[name] = definition;
      changed = true;
      continue;
    }
    // Existing definition: keep the user's own tweaks but guarantee the
    // PhaseFlow-critical permission rules are present.
    const agent = { ...out.agents[name] };
    const rules = Array.isArray(agent.permissions) ? [...agent.permissions] : [];
    for (const rule of definition.permissions || []) {
      if (ensureRule(rules, rule)) changed = true;
    }
    if (rules.length) agent.permissions = rules;
    out.agents[name] = agent;
  }

  // ── Permissions ────────────────────────────────────────
  if (!Array.isArray(out.permissions)) out.permissions = [];
  for (const rule of PHASEFLOW_ROOT_RULES) {
    if (ensureRule(out.permissions, rule)) changed = true;
  }

  // ── Plugins ────────────────────────────────────────────
  // V2 auto-discovers local plugins under `.opencode/plugins/`, so no explicit
  // registration is required. Drop the obsolete entries — leaving them in the
  // config makes OpenCode try to install them from the public registry.
  if (out.plugins !== undefined) {
    if (!Array.isArray(out.plugins)) {
      out.plugins = [];
      changed = true;
    }
    const kept = out.plugins.filter(
      (entry) =>
        typeof entry !== "string" || !OBSOLETE_PLUGIN_ENTRIES.includes(entry),
    );
    if (kept.length !== out.plugins.length) {
      out.plugins = kept;
      changed = true;
    }
  }

  // ── Experimental ───────────────────────────────────────
  if (!out.experimental || typeof out.experimental !== "object") out.experimental = {};
  for (const [key, value] of Object.entries(template.experimental || {})) {
    if (out.experimental[key] === undefined) {
      out.experimental[key] = value;
      changed = true;
    }
  }

  return { config: out, changed };
}

// ── CLI ────────────────────────────────────────────────

function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const [targetFile, templateFile] = args;

  if (!targetFile || !templateFile) {
    console.error(
      "Usage: node tools/merge-phaseflow-config.js <target-config.json> <template-config.json> [--dry-run]",
    );
    process.exit(1);
  }

  let targetText;
  let templateText;
  try {
    targetText = readFileSync(targetFile, "utf8");
    templateText = readFileSync(templateFile, "utf8");
  } catch (err) {
    console.error(`✖ Cannot read config: ${err.message}`);
    process.exit(1);
  }

  let target;
  let template;
  try {
    template = JSON.parse(templateText);
  } catch {
    console.error(`✖ ${templateFile} is not valid JSON.`);
    process.exit(1);
  }

  try {
    target = JSON.parse(targetText);
  } catch {
    if (!hasComments(targetText)) {
      console.error(`✖ ${targetFile} is not valid JSON — it was not rewritten.`);
      process.exit(1);
    }

    // JSONC with comments: a full rewrite would lose the comments, so only
    // apply the surgical edits that OpenCode V2 actually needs.
    console.log(`→ ${targetFile} contains JSONC comments — applying targeted edits only.`);
    let text = targetText;
    const { text: cleaned, removed } = removePluginEntries(text, OBSOLETE_PLUGIN_ENTRIES);
    text = cleaned;
    if (removed.length) {
      console.log(`  ✓ Removed obsolete plugin entries: ${removed.join(", ")}`);
    }
    const renamed = renameTopLevelKey(text, "plugin", "plugins");
    if (renamed.renamed) {
      text = renamed.text;
      console.log("  ✓ Renamed the `plugin` key to `plugins`.");
    }

    if (text === targetText) {
      console.log("  ✓ No changes needed.");
      return;
    }
    if (!flags.has("--dry-run")) {
      writeFileSync(targetFile, text);
    }
    console.log(
      `✓ ${targetFile} updated${flags.has("--dry-run") ? " (dry run, not written)" : ""}.`,
    );
    console.log("  Note: the remaining V1 fields are still read by OpenCode V2.");
    console.log("  Migrate the rest manually if you want the native V2 shape.");
    return;
  }

  const { config, changed } = mergePhaseFlow(target, template, {
    skipInstructions: flags.has("--skip-instructions"),
  });

  if (!changed) {
    console.log(`✓ ${targetFile} already contains the PhaseFlow definitions — no changes needed.`);
    return;
  }

  if (!flags.has("--dry-run")) {
    writeFileSync(targetFile, `${JSON.stringify(config, null, 2)}\n`);
  }

  console.log(
    `✓ ${targetFile} updated with the PhaseFlow definitions${flags.has("--dry-run") ? " (dry run, not written)" : ""}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
