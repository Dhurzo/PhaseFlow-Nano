/**
 * test-config-migration.js — tests for the V1 → V2 config migration and merge tools
 *
 * Run with: node --test tests/test-config-migration.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hasComments,
  migrateAgent,
  migrateCommand,
  migrateConfig,
  permissionMapToRules,
} from "../tools/migrate-config-v1-to-v2.js";
import { mergePhaseFlow } from "../tools/merge-phaseflow-config.js";

// ── Tests ───────────────────────────────────────────────

describe("config migration V1 → V2", () => {
  describe("permissionMapToRules", () => {
    it("renames bash → shell and task → subagent", () => {
      const rules = permissionMapToRules({ bash: "allow", task: "deny" });
      assert.deepEqual(rules, [
        { action: "shell", resource: "*", effect: "allow" },
        { action: "subagent", resource: "*", effect: "deny" },
      ]);
    });

    it("collapses write and patch into the edit action", () => {
      const rules = permissionMapToRules({ edit: "allow", write: "allow", patch: "allow" });
      assert.equal(rules.length, 1);
      assert.deepEqual(rules[0], { action: "edit", resource: "*", effect: "allow" });
    });

    it("expands object values into one rule per resource", () => {
      const rules = permissionMapToRules({ external_directory: { "*": "allow", "/tmp/*": "deny" } });
      assert.deepEqual(rules, [
        { action: "external_directory", resource: "*", effect: "allow" },
        { action: "external_directory", resource: "/tmp/*", effect: "deny" },
      ]);
    });

    it("keeps custom tool actions such as inherit-task", () => {
      const rules = permissionMapToRules({ "inherit-task": "allow" });
      assert.deepEqual(rules, [{ action: "inherit-task", resource: "*", effect: "allow" }]);
    });

    it("drops todowrite, which has no V2 action", () => {
      const rules = permissionMapToRules({ todowrite: "allow", read: "allow" });
      assert.ok(!rules.some((r) => r.action === "todowrite"));
      assert.ok(rules.some((r) => r.action === "read"));
    });

    it("lets the last matching rule win", () => {
      const rules = permissionMapToRules({ subagent: "deny", subagent: "allow" });
      assert.equal(rules.length, 1);
      assert.equal(rules[0].effect, "allow");
    });

    it("returns an empty array for a missing map", () => {
      assert.deepEqual(permissionMapToRules(undefined), []);
      assert.deepEqual(permissionMapToRules(null), []);
    });
  });

  describe("migrateAgent", () => {
    it("converts permission → permissions", () => {
      const agent = migrateAgent({ description: "x", permission: { edit: "deny" } });
      assert.equal(agent.permission, undefined);
      assert.deepEqual(agent.permissions, [{ action: "edit", resource: "*", effect: "deny" }]);
    });

    it("converts prompt → system and disable → disabled", () => {
      const agent = migrateAgent({ prompt: "be nice", disable: true });
      assert.equal(agent.prompt, undefined);
      assert.equal(agent.system, "be nice");
      assert.equal(agent.disable, undefined);
      assert.equal(agent.disabled, true);
    });

    it("joins model and variant", () => {
      const agent = migrateAgent({ model: "ollama/qwen3", variant: "high" });
      assert.equal(agent.model, "ollama/qwen3#high");
      assert.equal(agent.variant, undefined);
    });

    it("keeps unrelated fields", () => {
      const agent = migrateAgent({ description: "x", mode: "subagent", color: "#fff" });
      assert.equal(agent.description, "x");
      assert.equal(agent.mode, "subagent");
      assert.equal(agent.color, "#fff");
    });
  });

  describe("migrateCommand", () => {
    it("converts subtask → subagent", () => {
      const command = migrateCommand({ description: "x", subtask: true });
      assert.equal(command.subtask, undefined);
      assert.equal(command.subagent, true);
    });

    it("lets subagent win over subtask", () => {
      const command = migrateCommand({ subtask: true, subagent: false });
      assert.equal(command.subagent, false);
      assert.equal(command.subtask, undefined);
    });
  });

  describe("migrateConfig", () => {
    it("moves the V1 singular maps to their V2 plural names", () => {
      const { config } = migrateConfig({
        permission: { edit: "allow" },
        command: { a: { template: "x" } },
        agent: { b: { description: "y" } },
        plugin: ["p"],
      });
      assert.equal(config.permission, undefined);
      assert.equal(config.command, undefined);
      assert.equal(config.agent, undefined);
      assert.equal(config.plugin, undefined);
      assert.ok(Array.isArray(config.permissions));
      assert.ok(config.commands.a);
      assert.ok(config.agents.b);
      assert.deepEqual(config.plugins, ["p"]);
    });

    it("preserves unrelated settings", () => {
      const { config } = migrateConfig({
        model: "anthropic/claude-sonnet-5-5",
        formatter: true,
        permission: { edit: "allow" },
      });
      assert.equal(config.model, "anthropic/claude-sonnet-5-5");
      assert.equal(config.formatter, true);
    });

    it("migrates nested command and agent definitions", () => {
      const { config } = migrateConfig({
        command: { a: { subtask: true } },
        agent: { b: { permission: { task: "deny" } } },
      });
      assert.equal(config.commands.a.subagent, true);
      assert.deepEqual(config.agents.b.permissions, [
        { action: "subagent", resource: "*", effect: "deny" },
      ]);
    });

    it("keeps the native V2 value when both forms are present", () => {
      const { config } = migrateConfig({
        permission: { edit: "allow" },
        permissions: [{ action: "edit", resource: "*", effect: "deny" }],
      });
      assert.equal(config.permission, undefined);
      assert.deepEqual(config.permissions, [{ action: "edit", resource: "*", effect: "deny" }]);
    });

    it("converts provider npm → package and api → settings.baseURL", () => {
      const { config } = migrateConfig({
        provider: { acme: { npm: "@ai-sdk/openai-compatible", api: "http://localhost/v1" } },
      });
      assert.equal(config.provider, undefined);
      assert.equal(config.providers.acme.package, "aisdk:@ai-sdk/openai-compatible");
      assert.equal(config.providers.acme.settings.baseURL, "http://localhost/v1");
      assert.equal(config.providers.acme.npm, undefined);
      assert.equal(config.providers.acme.api, undefined);
    });

    it("moves mcp servers under mcp.servers and flips enabled → disabled", () => {
      const { config } = migrateConfig({
        mcp: { playwright: { type: "local", command: ["npx", "@playwright/mcp"], enabled: true } },
      });
      assert.equal(config.mcp.playwright, undefined);
      assert.equal(config.mcp.servers.playwright.disabled, false);
      assert.equal(config.mcp.servers.playwright.enabled, undefined);
    });

    it("flattens skills paths and urls into one array", () => {
      const { config } = migrateConfig({
        skills: { paths: ["./team-skills"], urls: ["https://example.com/skills/"] },
      });
      assert.deepEqual(config.skills, ["./team-skills", "https://example.com/skills/"]);
    });
  });

  describe("hasComments", () => {
    it("detects line and block comments outside strings", () => {
      assert.ok(hasComments('{ // note\n "a": 1 }'));
      assert.ok(hasComments('{ /* note */ "a": 1 }'));
      assert.ok(!hasComments('{ "url": "http://x" }'));
      assert.ok(!hasComments('{ "a": 1 }'));
    });
  });
});

describe("mergePhaseFlow", () => {
  const template = {
    commands: { "phaseflow-status": { template: "status" } },
    agents: {
      "phaseflow-orchestrator": {
        mode: "subagent",
        permissions: [
          { action: "subagent", resource: "*", effect: "allow" },
          { action: "inherit-task", resource: "*", effect: "allow" },
        ],
      },
    },
    permissions: [{ action: "edit", resource: "*", effect: "allow" }],
    experimental: { todo: true, subagent_depth: 2 },
  };

  it("adds the missing PhaseFlow commands and agents", () => {
    const { config, changed } = mergePhaseFlow({ model: "x" }, template);
    assert.ok(changed);
    assert.ok(config.commands["phaseflow-status"]);
    assert.ok(config.agents["phaseflow-orchestrator"]);
    assert.equal(config.model, "x");
  });

  it("keeps a user-defined command with the same name", () => {
    const { config } = mergePhaseFlow(
      { commands: { "phaseflow-status": { template: "mine" } } },
      template,
    );
    assert.equal(config.commands["phaseflow-status"].template, "mine");
  });

  it("does not override the user's own root permissions", () => {
    const { config } = mergePhaseFlow(
      { permissions: [{ action: "subagent", resource: "*", effect: "deny" }] },
      template,
    );
    const subagent = config.permissions.find((r) => r.action === "subagent");
    assert.equal(subagent.effect, "deny");
  });

  it("adds the inherit-task permission the plugin needs", () => {
    const { config } = mergePhaseFlow({ permissions: [] }, template);
    assert.ok(
      config.permissions.some(
        (r) => r.action === "inherit-task" && r.resource === "*" && r.effect === "allow",
      ),
    );
  });

  it("guarantees the PhaseFlow permission rules on an existing agent", () => {
    const { config } = mergePhaseFlow(
      { agents: { "phaseflow-orchestrator": { mode: "subagent", permissions: [] } } },
      template,
    );
    const rules = config.agents["phaseflow-orchestrator"].permissions;
    assert.ok(rules.some((r) => r.action === "subagent" && r.effect === "allow"));
    assert.ok(rules.some((r) => r.action === "inherit-task" && r.effect === "allow"));
  });

  it("adds the experimental flags", () => {
    const { config } = mergePhaseFlow({}, template);
    assert.equal(config.experimental.todo, true);
    assert.equal(config.experimental.subagent_depth, 2);
  });

  it("adds AGENTS.md to the instructions by default", () => {
    const { config } = mergePhaseFlow({}, template);
    assert.ok(config.instructions.includes("AGENTS.md"));
  });

  it("leaves the instructions untouched when told to skip them", () => {
    const { config } = mergePhaseFlow({}, template, { skipInstructions: true });
    assert.equal(config.instructions, undefined);
  });

  it("reports no change when everything is already in place", () => {
    const first = mergePhaseFlow({}, template).config;
    const second = mergePhaseFlow(first, template);
    assert.equal(second.changed, false);
  });
});
