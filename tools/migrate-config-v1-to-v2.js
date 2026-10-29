#!/usr/bin/env node
/**
 * migrate-config-v1-to-v2.js — migrate an OpenCode config file to the native V2 shape.
 *
 * Usage:
 *   node tools/migrate-config-v1-to-v2.js <config.json> [--dry-run] [--json]
 *
 * OpenCode V2 keeps reading the V1 forms, but a native V2 config is explicit and
 * avoids silent deprecation warnings. This script rewrites the keys PhaseFlow
 * cares about while preserving every unrelated setting:
 *
 *   permission            → permissions   (ordered rule array)
 *   command               → commands      (subtask → subagent)
 *   agent                 → agents        (permission → permissions, prompt → system, …)
 *   plugin                → plugins
 *   reference             → references
 *   provider              → providers     (npm → package, api → settings.baseURL)
 *   snapshot              → snapshots
 *   attachment            → media
 *   mcp.<name>            → mcp.servers.<name>   (enabled → disabled)
 *   skills.paths/urls     → skills (single ordered array)
 *
 * A JSONC file that contains comments is never rewritten — the comments would be
 * lost. The script reports what it would do and exits with code 2 instead.
 */

import { readFileSync, writeFileSync } from "node:fs";

/** V1 permission key → V2 permission action. */
const ACTION_ALIASES = {
  bash: "shell",
  task: "subagent",
  write: "edit",
  patch: "edit",
};

/**
 * Convert a V1 permission map into the V2 ordered rule array.
 *
 * @param {Record<string, unknown>} map
 * @returns {Array<{ action: string, resource: string, effect: string }>}
 */
export function permissionMapToRules(map) {
  if (!map || typeof map !== "object") return [];

  /** @type {Map<string, { action: string, resource: string, effect: string }>} */
  const rules = new Map();

  for (const [rawKey, rawValue] of Object.entries(map)) {
    const action = ACTION_ALIASES[rawKey] ?? rawKey;
    const entries =
      rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)
        ? Object.entries(rawValue)
        : [["*", rawValue]];

    for (const [resource, effect] of entries) {
      if (typeof effect !== "string") continue;
      // `todowrite` has no V2 action — todos are enabled via experimental.todo
      // and the default `*` allow rule already covers the tool.
      if (action === "todowrite") continue;
      const key = `${action}\u0000${resource}`;
      // Last matching rule wins, so re-insert to keep the newest position.
      rules.delete(key);
      rules.set(key, { action, resource, effect });
    }
  }

  return [...rules.values()];
}

/**
 * Deduplicate permission rules by action and resource, keeping the last one.
 *
 * In V2 the last matching rule wins, so keeping only the newest occurrence
 * preserves the behaviour while dropping redundant entries.
 *
 * @param {Array<{ action: string, resource: string, effect: string }>} rules
 * @returns {Array<{ action: string, resource: string, effect: string }>}
 */
export function dedupeRules(rules) {
  /** @type {Map<string, { action: string, resource: string, effect: string }>} */
  const byKey = new Map();
  for (const rule of rules) {
    if (!rule || typeof rule.action !== "string") continue;
    const key = `${rule.action}|${rule.resource}`;
    byKey.delete(key);
    byKey.set(key, rule);
  }
  return [...byKey.values()];
}

/**
 * Convert a V1 agent definition to the V2 native shape.
 *
 * @param {Record<string, any>} agent
 * @returns {Record<string, any>}
 */
export function migrateAgent(agent) {
  if (!agent || typeof agent !== "object") return agent;
  const out = { ...agent };

  if (out.permission !== undefined) {
    const rules = permissionMapToRules(out.permission);
    delete out.permission;
    if (rules.length) {
      out.permissions = [...(Array.isArray(out.permissions) ? out.permissions : []), ...rules];
    }
  }
  if (out.prompt !== undefined) {
    const prompt = out.prompt;
    delete out.prompt;
    if (out.system === undefined) out.system = prompt;
  }
  if (out.disable !== undefined) {
    const disabled = Boolean(out.disable);
    delete out.disable;
    if (out.disabled === undefined) out.disabled = disabled;
  }
  if (out.maxSteps !== undefined) {
    const steps = out.maxSteps;
    delete out.maxSteps;
    if (out.steps === undefined) out.steps = steps;
  }
  if (typeof out.model === "string" && typeof out.variant === "string") {
    out.model = `${out.model}#${out.variant}`;
    delete out.variant;
  }
  return out;
}

/**
 * Convert a V1 command definition to the V2 native shape.
 *
 * @param {Record<string, any>} command
 * @returns {Record<string, any>}
 */
export function migrateCommand(command) {
  if (!command || typeof command !== "object") return command;
  const out = { ...command };
  if (out.subtask !== undefined) {
    const subagent = out.subtask;
    delete out.subtask;
    if (out.subagent === undefined) out.subagent = subagent;
  }
  if (typeof out.model === "string" && typeof out.variant === "string") {
    out.model = `${out.model}#${out.variant}`;
    delete out.variant;
  }
  return out;
}

/**
 * Migrate a whole V1 config object to the native V2 shape.
 *
 * @param {Record<string, any>} config
 * @returns {{ config: Record<string, any>, changed: boolean }}
 */
export function migrateConfig(config) {
  if (!config || typeof config !== "object") return { config, changed: false };

  const out = { ...config };
  let changed = false;

  /**
   * Move a V1 key to its V2 counterpart.
   * @param {string} from
   * @param {string} to
   * @param {(value: any, current: any) => any} combine
   */
  const take = (from, to, combine) => {
    if (out[from] === undefined) return;
    const value = out[from];
    delete out[from];
    changed = true;
    out[to] = out[to] === undefined ? value : combine(value, out[to]);
  };

  take("permission", "permissions", (v1, v2) =>
    dedupeRules([...permissionMapToRules(v1), ...(Array.isArray(v2) ? v2 : [])]),
  );
  take("command", "commands", (v1, v2) => ({
    ...Object.fromEntries(Object.entries(v1).map(([name, def]) => [name, migrateCommand(def)])),
    ...v2,
  }));
  take("agent", "agents", (v1, v2) => ({
    ...Object.fromEntries(Object.entries(v1).map(([name, def]) => [name, migrateAgent(def)])),
    ...v2,
  }));
  take("plugin", "plugins", (v1, v2) => [...v1, ...v2]);
  take("reference", "references", (v1, v2) => ({ ...v1, ...v2 }));
  take("provider", "providers", (v1, v2) => ({ ...v1, ...v2 }));
  take("snapshot", "snapshots", (v1, v2) => v2);
  take("attachment", "media", (v1, v2) => ({ ...v1, ...v2 }));

  if (out.permissions && !Array.isArray(out.permissions)) {
    const rules = permissionMapToRules(out.permissions);
    out.permissions = rules.length ? rules : undefined;
    if (!rules.length) delete out.permissions;
    changed = true;
  } else if (Array.isArray(out.permissions)) {
    const deduped = dedupeRules(out.permissions);
    if (JSON.stringify(deduped) !== JSON.stringify(out.permissions)) {
      out.permissions = deduped;
      changed = true;
    }
  }

  if (out.commands && typeof out.commands === "object") {
    const migrated = Object.fromEntries(
      Object.entries(out.commands).map(([name, def]) => [name, migrateCommand(def)]),
    );
    if (JSON.stringify(migrated) !== JSON.stringify(out.commands)) changed = true;
    out.commands = migrated;
  }

  if (out.agents && typeof out.agents === "object") {
    const migrated = Object.fromEntries(
      Object.entries(out.agents).map(([name, def]) => [name, migrateAgent(def)]),
    );
    if (JSON.stringify(migrated) !== JSON.stringify(out.agents)) changed = true;
    out.agents = migrated;
  }

  if (out.providers && typeof out.providers === "object") {
    for (const provider of Object.values(out.providers)) {
      if (!provider || typeof provider !== "object") continue;
      if (provider.npm !== undefined) {
        const npm = String(provider.npm);
        provider.package = npm.startsWith("aisdk:") ? npm : `aisdk:${npm}`;
        delete provider.npm;
        changed = true;
      }
      if (provider.api !== undefined) {
        provider.settings = { ...(provider.settings || {}), baseURL: provider.api };
        delete provider.api;
        changed = true;
      }
    }
  }

  if (out.mcp && typeof out.mcp === "object") {
    const servers = {};
    let hasServers = false;
    for (const [name, server] of Object.entries(out.mcp)) {
      if (name === "servers" || name === "timeout") continue;
      if (!server || typeof server !== "object") continue;
      const migrated = { ...server };
      if (migrated.enabled !== undefined) {
        migrated.disabled = !migrated.enabled;
        delete migrated.enabled;
        changed = true;
      }
      servers[name] = migrated;
      hasServers = true;
    }
    if (hasServers) {
      out.mcp = { ...out.mcp, servers: { ...(out.mcp.servers || {}), ...servers } };
      for (const name of Object.keys(servers)) delete out.mcp[name];
    }
  }

  if (out.skills && typeof out.skills === "object" && !Array.isArray(out.skills)) {
    const paths = Array.isArray(out.skills.paths) ? out.skills.paths : [];
    const urls = Array.isArray(out.skills.urls) ? out.skills.urls : [];
    if (paths.length || urls.length) {
      out.skills = [...paths, ...urls];
      changed = true;
    }
  }

  return { config: out, changed };
}

/**
 * Detect whether a file contains JSONC comments.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function hasComments(text) {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") return true;
    if (ch === "/" && text[i + 1] === "*") return true;
  }
  return false;
}

// ── CLI ────────────────────────────────────────────────

function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const file = args[0];

  if (!file) {
    console.error("Usage: node tools/migrate-config-v1-to-v2.js <config.json> [--dry-run] [--json]");
    process.exit(1);
  }

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    console.error(`✖ Cannot read ${file}: ${err.message}`);
    process.exit(1);
  }

  let config;
  try {
    config = JSON.parse(text);
  } catch {
    if (hasComments(text)) {
      console.error(`✖ ${file} contains JSONC comments — it was not rewritten.`);
      console.error("  Migrate it manually to the OpenCode V2 shape (see opencode.ai/v2/docs/migrate-v1).");
      process.exit(2);
    }
    console.error(`✖ ${file} is not valid JSON — it was not rewritten.`);
    process.exit(1);
  }

  const { config: migrated, changed } = migrateConfig(config);

  if (flags.has("--json")) {
    console.log(JSON.stringify({ changed, config: migrated }, null, 2));
    return;
  }

  if (!changed) {
    console.log(`✓ ${file} already uses the native V2 shape — no changes needed.`);
    return;
  }

  if (!flags.has("--dry-run")) {
    writeFileSync(file, `${JSON.stringify(migrated, null, 2)}\n`);
  }

  console.log(`✓ ${file} migrated to the native V2 shape${flags.has("--dry-run") ? " (dry run, not written)" : ""}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
