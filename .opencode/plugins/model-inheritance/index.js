/**
 * model-inheritance — OpenCode plugin (V2 plugin API)
 *
 * Registers the `inherit-task` custom tool, which behaves like the
 * built-in `subagent` tool but passes the parent session's model to the
 * child session.  This means sub-agents use whatever model you have
 * selected in the TUI instead of falling back to a different default.
 *
 * V2 plugin API notes:
 * - A V2 plugin default-exports a definition with an `id` and a `setup(ctx)`.
 *   `Plugin.define()` from `@opencode/plugin` is an identity helper used for
 *   type inference only, so this plain-JS plugin exports the definition
 *   directly and stays dependency-free (no build step, no 170MB install).
 * - `setup(ctx)` registers the tool through `ctx.tool.transform(...)`.
 * - The plugin context is the OpenCode client: sessions live under
 *   `ctx.session`, and tool definitions use JSON Schema for `input`.
 *
 * Improvements over v1:
 * - Uses `ctx.session.get()` to read the parent session's selected model
 *   (authoritative), with a message scan as fallback
 * - Uses `ctx.session.wait()` to await completion, with a polling fallback
 * - Honours the tool `AbortSignal` (`context.signal`) for cancellation
 * - Configurable timeout via INHERIT_TASK_TIMEOUT_MS env var (default: 360000 = 6 min)
 */

/** Default timeout: 6 minutes in milliseconds */
const DEFAULT_TIMEOUT_MS = 360_000;
const POLL_INITIAL_MS = 400;
const POLL_MAX_MS = 2_000;

/**
 * Resolve the timeout from environment or default.
 * Accepts seconds (e.g. "600") or milliseconds (e.g. "360000").
 */
function resolveTimeoutMs() {
  const raw = process.env.INHERIT_TASK_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  // If value < 1000, assume seconds; otherwise assume ms
  return n < 1000 ? n * 1000 : n;
}

/**
 * Resolve the parent session's model.
 *
 * Strategy 1 (authoritative): the session records its selected model.
 * Strategy 2 (fallback): walk assistant messages backwards looking for the
 * most recent provider/model reference.
 *
 * @param {object} ctx - OpenCode plugin context
 * @param {string} sessionID - Parent session ID
 * @returns {Promise<{ providerID: string, modelID: string } | null>}
 */
async function discoverParentModel(ctx, sessionID) {
  // Strategy 1: the session's own selected model
  try {
    const session = await ctx.session.get({ sessionID });
    const model = session?.model;
    if (model?.providerID && model?.id) {
      return { providerID: model.providerID, modelID: model.id };
    }
  } catch {
    // Strategy 1 failed, continue to fallback
  }

  // Strategy 2: walk assistant messages backwards (most reliable transcript source)
  try {
    const msgs = await ctx.session.context({ sessionID });
    if (Array.isArray(msgs)) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m?.type === "assistant" && m?.model?.providerID && m?.model?.id) {
          return { providerID: m.model.providerID, modelID: m.model.id };
        }
      }
    }
  } catch {
    // Strategy 2 failed
  }

  return null;
}

/**
 * Collect the final output from a child session.
 * Walks messages backwards to find the last assistant response.
 *
 * @param {object} ctx - OpenCode plugin context
 * @param {string} childID - Child session ID
 * @returns {Promise<string>} The assistant's text output
 */
async function collectOutput(ctx, childID) {
  try {
    const msgs = await ctx.session.context({ sessionID: childID });
    if (Array.isArray(msgs)) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m?.type === "assistant") {
          const text = (m.content || [])
            .filter((p) => p.type === "text" && p.text)
            .map((p) => p.text)
            .join("\n");
          if (text) return text;
        }
      }
    }
  } catch {
    // Fall through to empty output
  }

  return "";
}

/**
 * Poll a session until it reports an outcome (used when `session.wait` is
 * unavailable on the running server).
 *
 * @returns {Promise<"done" | "abort">}
 */
async function pollUntilIdle(ctx, sessionID, signal) {
  let interval = POLL_INITIAL_MS;
  while (true) {
    if (signal?.aborted) return "abort";
    const session = await ctx.session.get({ sessionID });
    if (session?.outcome || session?.time?.idle !== undefined) return "done";
    await sleep(interval, signal);
    interval = Math.min(interval * 2, POLL_MAX_MS);
  }
}

/**
 * Sleep that wakes up early when the signal aborts, so no timer is left
 * pending on the event loop after the wait finishes.
 */
function sleep(ms, signal) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Wait for the child session to finish, honouring timeout and cancellation.
 *
 * @returns {Promise<"done" | "timeout" | "abort">}
 */
async function waitForCompletion(ctx, sessionID, signal, timeoutMs) {
  // Already cancelled before we even started — bail out before racing.
  if (signal?.aborted) return "abort";

  // Internal cancellation so the polling fallback stops as soon as the race settles.
  const internal = new AbortController();

  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  const aborted = new Promise((resolve) => {
    if (!signal) return;
    signal.addEventListener("abort", () => resolve("abort"), { once: true });
  });

  const completion = (async () => {
    try {
      await ctx.session.wait({ sessionID });
      return "done";
    } catch {
      // `session.wait` unavailable on this server — fall back to polling
      return pollUntilIdle(ctx, sessionID, internal.signal);
    }
  })();

  const result = await Promise.race([completion, timeout, aborted]);
  // Release the timeout timer and stop the polling fallback, otherwise a
  // pending timer would keep the event loop alive for the whole timeout window.
  clearTimeout(timer);
  internal.abort();
  return result;
}

/**
 * V2 plugin definition.
 *
 * @type {{ id: string, setup: (ctx: object) => Promise<void> }}
 */
export default {
  id: "model-inheritance",

  async setup(ctx) {
    await ctx.tool.transform((editor) => {
      editor.add({
        name: "inherit-task",
        description:
          "Run a sub-agent that inherits the parent session's model. " +
          "Use exactly like `subagent` but the child will use the same model " +
          "as the current session.",
        input: {
          type: "object",
          properties: {
            agent: {
              type: "string",
              description: "Agent to invoke (e.g. phaseflow-builder, phaseflow-reviewer)",
            },
            description: {
              type: "string",
              description: "Brief human-readable task description",
            },
            prompt: {
              type: "string",
              description: "Detailed instructions for the sub-agent",
            },
          },
          // V2's built-in `subagent` tool uses the same field names, so this
          // tool is a drop-in replacement for it.
          required: ["agent", "description", "prompt"],
          additionalProperties: false,
        },
        // Register a dedicated permission action so `inherit-task` can be
        // allowed/denied independently from the built-in `subagent` action.
        options: { permission: "inherit-task" },

        async execute(input, context) {
          const sessionID = context.sessionID;
          // `agent` is the V2 field name (same as the built-in `subagent`
          // tool). `subagent_type` is accepted defensively for callers that
          // still use the V1 name.
          const agentName = input.agent || input.subagent_type;
          const childTitle = `${input.description} (@${agentName})`;

          if (!agentName) {
            return {
              content:
                "[inherit-task] ERROR: Missing 'agent' — pass the agent id " +
                "(e.g. agent=\"phaseflow-builder\").",
            };
          }

          // ── 1. Discover parent model ──────────────────────────────
          const model = await discoverParentModel(ctx, sessionID);

          if (!model) {
            return {
              content:
                "[inherit-task] ERROR: Could not determine parent model. " +
                "Make sure the session has at least one assistant response. " +
                "Tried: session.model, assistant message scan.",
            };
          }

          const { providerID, modelID } = model;

          // ── 2. Create child session (agent + model set at creation) ─
          let child;
          try {
            child = await ctx.session.create({
              parentID: sessionID,
              title: childTitle,
              agent: agentName,
              model: { providerID, id: modelID },
            });
            if (!child?.id) {
              return { content: "[inherit-task] Session creation failed: no session id returned" };
            }
          } catch (err) {
            return { content: `[inherit-task] Session creation failed: ${err.message}` };
          }

          const childID = child.id;

          // ── 3. Send the prompt ────────────────────────────────────
          try {
            await ctx.session.prompt({ sessionID: childID, text: input.prompt });
          } catch (err) {
            return { content: `[inherit-task] Prompt failed: ${err.message}` };
          }

          // ── 4. Wait until the child session is idle ────────────────
          const timeoutMs = resolveTimeoutMs();
          const result = await waitForCompletion(ctx, childID, context.signal, timeoutMs);

          if (result === "abort") {
            return { content: "[inherit-task] ABORTED by user" };
          }

          if (result === "timeout") {
            const timeoutSec = Math.round(timeoutMs / 1000);
            return {
              content:
                `[inherit-task] TIMEOUT — child session did not finish in ${timeoutSec}s. ` +
                `Increase with INHERIT_TASK_TIMEOUT_MS env var (current: ${timeoutMs}ms).`,
            };
          }

          // ── 5. Collect final output ────────────────────────────────
          const output = await collectOutput(ctx, childID);
          return { content: output || "(task completed, no text output)" };
        },
      });
    });
  },
};
