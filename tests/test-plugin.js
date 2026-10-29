/**
 * test-plugin.js — Tests for the model-inheritance plugin (OpenCode V2 API)
 *
 * Run with: node --test tests/test-plugin.js
 * Requires: Node.js ≥ 18 (built-in test runner)
 *
 * The V2 plugin API has no `client` argument: `setup(ctx)` receives the
 * OpenCode plugin context, and tools are registered through
 * `ctx.tool.transform(...)`. These tests mock that context.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import plugin from "../.opencode/plugins/model-inheritance/index.js";

// ── Helpers ─────────────────────────────────────────────

/** Mock tool editor that records registered tools. */
function createMockEditor() {
  const tools = new Map();
  return {
    tools,
    add(tool) {
      tools.set(tool.name, tool);
    },
    list() {
      return [...tools.values()];
    },
    get(id) {
      return tools.get(id);
    },
    namespace() {},
    update() {},
    remove() {},
  };
}

/**
 * Create a mock OpenCode V2 plugin context.
 * @param {object} opts - controllable behaviour
 */
function createMockCtx(opts = {}) {
  const {
    sessionModel = null,
    getError = null,
    messages = [],
    messagesError = null,
    createError = null,
    promptError = null,
    waitError = null,
  } = opts;

  const calls = { create: [], prompt: [], wait: [], get: [], context: [] };

  const ctx = {
    calls,
    tool: {
      transform: async (callback) => {
        const editor = createMockEditor();
        callback(editor);
        ctx.__editor = editor;
        return { dispose: async () => {} };
      },
      reload: async () => {},
      list: async () => [],
      hook: () => {},
    },
    session: {
      get: async (input) => {
        calls.get.push(input);
        if (getError) throw getError;
        return {
          id: input.sessionID,
          model: sessionModel,
          outcome: "succeeded",
          time: { created: 0, updated: 0 },
        };
      },
      context: async (input) => {
        calls.context.push(input);
        if (messagesError) throw messagesError;
        return messages;
      },
      create: async (input) => {
        calls.create.push(input);
        if (createError) throw createError;
        return { id: "child-session-123" };
      },
      prompt: async (input) => {
        calls.prompt.push(input);
        if (promptError) throw promptError;
        return { id: "msg-1" };
      },
      wait: async (input) => {
        calls.wait.push(input);
        if (waitError) throw waitError;
      },
    },
  };

  return ctx;
}

/** Mock tool execution context (V2 shape). */
function createToolContext(overrides = {}) {
  const controller = new AbortController();
  return {
    sessionID: "parent-session-456",
    agent: "build",
    messageID: "msg-parent-1",
    id: "call-1",
    signal: controller.signal,
    controller,
    ...overrides,
  };
}

/** Register the plugin against a mock ctx and return the registered tool. */
async function loadTool(ctx) {
  await plugin.setup(ctx);
  return ctx.__editor.get("inherit-task");
}

/** Run the tool and return its text content. */
async function runTool(tool, input = {}, context = createToolContext()) {
  const result = await tool.execute(
    {
      agent: "phaseflow-builder",
      description: "Test",
      prompt: "Do something",
      ...input,
    },
    context,
  );
  return result?.content ?? "";
}

// ── Tests ───────────────────────────────────────────────

describe("model-inheritance plugin (V2)", () => {
  describe("plugin definition", () => {
    it("exports a V2 plugin definition with id and setup", () => {
      assert.equal(typeof plugin, "object");
      assert.equal(plugin.id, "model-inheritance");
      assert.equal(typeof plugin.setup, "function");
    });

    it("registers the inherit-task tool", async () => {
      const ctx = createMockCtx();
      const tool = await loadTool(ctx);
      assert.ok(tool, "inherit-task tool should be registered");
      assert.equal(tool.name, "inherit-task");
      assert.equal(typeof tool.execute, "function");
    });

    it("declares a JSON Schema input with the expected properties", async () => {
      const tool = await loadTool(createMockCtx());
      assert.equal(tool.input.type, "object");
      assert.ok(tool.input.properties.agent);
      assert.ok(tool.input.properties.description);
      assert.ok(tool.input.properties.prompt);
      assert.equal(tool.input.properties.agent.type, "string");
      assert.deepEqual(tool.input.required, ["agent", "description", "prompt"]);
      assert.equal(tool.input.additionalProperties, false);
    });

    it("accepts the legacy `subagent_type` field at runtime", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      await runTool(tool, {
        agent: undefined,
        subagent_type: "phaseflow-reviewer",
        description: "Legacy call",
      });

      assert.equal(ctx.calls.create[0].agent, "phaseflow-reviewer");
    });

    it("reports a clear error when no agent is given", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool, { agent: undefined });

      assert.ok(output.includes("Missing 'agent'"));
      assert.equal(ctx.calls.create.length, 0);
    });

    it("asserts its own permission action", async () => {
      const tool = await loadTool(createMockCtx());
      assert.equal(tool.options.permission, "inherit-task");
    });
  });

  describe("model discovery", () => {
    it("uses the session's selected model", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(!output.includes("Could not determine parent model"));
      assert.deepEqual(ctx.calls.create[0].model, { providerID: "ollama", id: "qwen3:14b" });
    });

    it("falls back to assistant messages when the session has no model", async () => {
      const ctx = createMockCtx({
        sessionModel: null,
        messages: [
          { type: "user", text: "hi" },
          {
            type: "assistant",
            model: { providerID: "ollama", id: "qwen3:14b" },
            content: [{ type: "text", text: "Hello" }],
          },
        ],
      });
      const tool = await loadTool(ctx);
      await runTool(tool);

      assert.deepEqual(ctx.calls.create[0].model, { providerID: "ollama", id: "qwen3:14b" });
    });

    it("returns an error when no model can be determined", async () => {
      const ctx = createMockCtx({ sessionModel: null, messages: [{ type: "user", text: "hi" }] });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(output.includes("Could not determine parent model"));
      assert.equal(ctx.calls.create.length, 0);
    });

    it("returns an error when both session and messages fail", async () => {
      const ctx = createMockCtx({
        getError: new Error("network error"),
        messagesError: new Error("network error"),
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(output.includes("Could not determine parent model"));
    });
  });

  describe("child session creation", () => {
    it("creates the child with parent, agent and model", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      await runTool(tool, { agent: "phaseflow-builder", description: "Build it" });

      const created = ctx.calls.create[0];
      assert.equal(created.parentID, "parent-session-456");
      assert.equal(created.agent, "phaseflow-builder");
      assert.equal(created.title, "Build it (@phaseflow-builder)");
    });

    it("returns an error when session creation fails", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
        createError: new Error("session limit reached"),
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(output.includes("Session creation failed"));
      assert.ok(output.includes("session limit reached"));
    });

    it("returns an error when the prompt fails", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
        promptError: new Error("agent not found"),
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(output.includes("Prompt failed"));
      assert.ok(output.includes("agent not found"));
    });

    it("sends the prompt to the child session", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      await runTool(tool, { prompt: "Build the thing" });

      assert.equal(ctx.calls.prompt[0].sessionID, "child-session-123");
      assert.equal(ctx.calls.prompt[0].text, "Build the thing");
    });
  });

  describe("completion and output", () => {
    it("waits for the child session to finish", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      await runTool(tool);

      assert.equal(ctx.calls.wait.length, 1);
      assert.equal(ctx.calls.wait[0].sessionID, "child-session-123");
    });

    it("collects the last assistant message from the child", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
        messages: [
          { type: "user", text: "Build the thing" },
          {
            type: "assistant",
            model: { providerID: "ollama", id: "qwen3:14b" },
            content: [{ type: "text", text: "Child completed successfully" }],
          },
        ],
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.equal(output, "Child completed successfully");
    });

    it("reports completion when the child produced no text", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
        messages: [{ type: "user", text: "Build the thing" }],
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(output.includes("task completed"));
    });

    it("falls back to polling when session.wait is unavailable", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
        waitError: new Error("endpoint not found"),
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.equal(ctx.calls.wait.length, 1);
      // The polling fallback asks the session for its state.
      assert.ok(ctx.calls.get.length >= 2);
      assert.ok(!output.includes("TIMEOUT"));
    });

    it("handles an already-aborted signal", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      const toolCtx = createToolContext();
      toolCtx.controller.abort();

      const output = await runTool(tool, {}, toolCtx);
      assert.ok(output.includes("ABORTED"));
    });
  });

  describe("timeout configuration", () => {
    beforeEach(() => {
      delete process.env.INHERIT_TASK_TIMEOUT_MS;
    });

    afterEach(() => {
      delete process.env.INHERIT_TASK_TIMEOUT_MS;
    });

    it("uses the default timeout when the env var is not set", async () => {
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
      });
      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(!output.includes("TIMEOUT"));
    });

    it("reports a timeout when the child exceeds it", async () => {
      process.env.INHERIT_TASK_TIMEOUT_MS = "1"; // 1 second
      const ctx = createMockCtx({
        sessionModel: { providerID: "ollama", id: "qwen3:14b" },
        waitError: new Error("never resolves"),
        getError: null,
      });
      // Make wait() hang so only the timeout can end the wait.
      ctx.session.wait = async () => new Promise(() => {});
      // The polling fallback must not resolve either: report the model (needed by
      // model discovery) but never an outcome or an idle timestamp.
      ctx.session.get = async (input) => {
        ctx.calls.get.push(input);
        return {
          id: input.sessionID,
          model: { providerID: "ollama", id: "qwen3:14b" },
          time: { created: 0, updated: 0 },
        };
      };

      const tool = await loadTool(ctx);
      const output = await runTool(tool);

      assert.ok(output.includes("TIMEOUT"), `Expected a timeout, got: ${output}`);
      assert.ok(output.includes("INHERIT_TASK_TIMEOUT_MS"));
    });
  });
});
