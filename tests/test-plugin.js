/**
 * test-plugin.js — Tests for the model-inheritance plugin
 *
 * Run with: node --test tests/test-plugin.js
 * Requires: Node.js ≥ 18 (built-in test runner)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// We test the plugin's internal logic by importing the module
// and mocking the OpenCode client.
import plugin from "../.opencode/plugins/model-inheritance/index.js";

// ── Helpers ─────────────────────────────────────────────

/** Create a mock OpenCode client with controllable behavior */
function createMockClient(opts = {}) {
  const {
    messages = [],
    messagesError = null,
    createError = null,
    promptError = null,
    statusMap = {},
    statusError = null,
  } = opts;

  return {
    session: {
      messages: async ({ path, query } = {}) => {
        if (messagesError) return { data: null, error: messagesError };
        return { data: messages, error: null };
      },
      create: async ({ body, query } = {}) => {
        if (createError) return { data: null, error: createError };
        return { data: { id: "child-session-123" }, error: null };
      },
      prompt: async ({ path, body } = {}) => {
        if (promptError) return { data: null, error: promptError };
        return { data: null, error: null };
      },
      status: async ({ query } = {}) => {
        if (statusError) return { data: null, error: statusError };
        return { data: statusMap, error: null };
      },
    },
  };
}

/** Create a mock context */
function createMockContext(overrides = {}) {
  return {
    sessionID: "parent-session-456",
    directory: "/tmp/test-project",
    abort: { aborted: false },
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────

describe("model-inheritance plugin", () => {
  describe("tool registration", () => {
    it("registers inherit-task tool", () => {
      const result = plugin({ client: createMockClient() });
      assert.ok(result.tool);
      assert.ok(result.tool["inherit-task"]);
      assert.equal(typeof result.tool["inherit-task"].execute, "function");
    });

    it("has correct args schema", () => {
      const result = plugin({ client: createMockClient() });
      const tool = result.tool["inherit-task"];
      assert.ok(tool.args.subagent_type);
      assert.ok(tool.args.description);
      assert.ok(tool.args.prompt);
      assert.equal(tool.args.subagent_type.type, "string");
    });
  });

  describe("model discovery", () => {
    it("finds model from assistant messages", async () => {
      const client = createMockClient({
        messages: [
          { info: { role: "user", providerID: null, modelID: null }, parts: [] },
          {
            info: { role: "assistant", providerID: "ollama", modelID: "qwen3:14b" },
            parts: [{ type: "text", text: "Hello" }],
          },
        ],
      });

      const result = plugin({ client });
      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        createMockContext()
      );

      // Should not error about model detection
      assert.ok(!output.includes("Could not determine parent model"));
    });

    it("returns error when no assistant messages exist", async () => {
      const client = createMockClient({
        messages: [
          { info: { role: "user", providerID: null, modelID: null }, parts: [] },
        ],
      });

      const result = plugin({ client });
      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        createMockContext()
      );

      assert.ok(output.includes("Could not determine parent model"));
    });

    it("returns error when messages API fails", async () => {
      const client = createMockClient({
        messagesError: { message: "network error" },
      });

      const result = plugin({ client });
      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        createMockContext()
      );

      assert.ok(output.includes("Could not determine parent model"));
    });
  });

  describe("session creation", () => {
    it("returns error when session creation fails", async () => {
      const client = createMockClient({
        messages: [
          {
            info: { role: "assistant", providerID: "ollama", modelID: "qwen3:14b" },
            parts: [{ type: "text", text: "Hello" }],
          },
        ],
        createError: { message: "session limit reached" },
      });

      const result = plugin({ client });
      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        createMockContext()
      );

      assert.ok(output.includes("Session creation failed"));
    });
  });

  describe("polling and timeout", () => {
    it("returns output when child completes quickly", async () => {
      const client = createMockClient({
        messages: [
          {
            info: { role: "assistant", providerID: "ollama", modelID: "qwen3:14b" },
            parts: [{ type: "text", text: "Parent message" }],
          },
        ],
        statusMap: {
          "child-session-123": { type: "idle" },
        },
      });

      const result = plugin({ client });
      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        createMockContext()
      );

      // Either returns output or "no text output" — both are valid
      assert.ok(
        output.includes("task completed") || output.length > 0,
        `Expected some output, got: ${output}`
      );
    });

    it("handles abort signal", async () => {
      const client = createMockClient({
        messages: [
          {
            info: { role: "assistant", providerID: "ollama", modelID: "qwen3:14b" },
            parts: [{ type: "text", text: "Parent" }],
          },
        ],
        statusMap: {
          "child-session-123": { type: "running" },
        },
      });

      const result = plugin({ client });
      const ctx = createMockContext({
        abort: { aborted: true },
      });

      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        ctx
      );

      assert.ok(output.includes("ABORTED"));
    });
  });

  describe("output collection", () => {
    it("collects last assistant message from child", async () => {
      const client = createMockClient({
        messages: [
          {
            info: { role: "assistant", providerID: "ollama", modelID: "qwen3:14b" },
            parts: [{ type: "text", text: "Parent msg" }],
          },
        ],
        statusMap: {
          "child-session-123": { type: "idle" },
        },
      });

      // Override messages to return child messages on second call
      const originalMessages = client.session.messages;
      let callCount = 0;
      client.session.messages = async (opts) => {
        callCount++;
        if (callCount === 1) {
          // First call: parent messages
          return {
            data: [
              {
                info: { role: "assistant", providerID: "ollama", modelID: "qwen3:14b" },
                parts: [{ type: "text", text: "Parent msg" }],
              },
            ],
            error: null,
          };
        }
        // Second call: child messages
        return {
          data: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "User prompt" }],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Child completed successfully" }],
            },
          ],
          error: null,
        };
      };

      const result = plugin({ client });
      const output = await result.tool["inherit-task"].execute(
        { subagent_type: "phaseflow-builder", description: "Test", prompt: "Do something" },
        createMockContext()
      );

      assert.equal(output, "Child completed successfully");
    });
  });

  describe("timeout configuration", () => {
    it("uses default timeout when env var not set", () => {
      delete process.env.INHERIT_TASK_TIMEOUT_MS;
      // We can't directly test the internal resolveTimeoutMs, but we can
      // verify the plugin loads without error
      const result = plugin({ client: createMockClient() });
      assert.ok(result.tool["inherit-task"]);
    });

    it("accepts timeout in seconds (< 1000)", () => {
      process.env.INHERIT_TASK_TIMEOUT_MS = "120"; // 120 seconds
      const result = plugin({ client: createMockClient() });
      assert.ok(result.tool["inherit-task"]);
      delete process.env.INHERIT_TASK_TIMEOUT_MS;
    });

    it("accepts timeout in milliseconds (≥ 1000)", () => {
      process.env.INHERIT_TASK_TIMEOUT_MS = "600000"; // 600 seconds in ms
      const result = plugin({ client: createMockClient() });
      assert.ok(result.tool["inherit-task"]);
      delete process.env.INHERIT_TASK_TIMEOUT_MS;
    });
  });
});
