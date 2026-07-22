/**
 * model-inheritance — OpenCode plugin (v2)
 *
 * Registers the `inherit-task` custom tool, which behaves like the
 * built-in `task` tool but passes the parent session's model to the
 * sub-agent.  This means sub-agents use whatever model you have
 * selected in the TUI instead of falling back to a different default.
 *
 * Improvements over v1:
 * - Configurable timeout via INHERIT_TASK_TIMEOUT_MS env var (default: 360000 = 6 min)
 * - Robust model detection with multiple fallback strategies
 * - Exponential backoff polling (400ms → 2000ms)
 * - Detailed error messages for debugging
 * - Graceful abort handling
 */

/** Default timeout: 6 minutes in milliseconds */
const DEFAULT_TIMEOUT_MS = 360_000;
const POLL_INITIAL_MS = 400;
const POLL_MAX_MS = 2000;

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
 * Discover the parent session's model by walking messages.
 * Strategy: walk backwards through messages looking for an assistant
 * message with providerID/modelID. Tries multiple fallback strategies.
 *
 * @param {object} client - OpenCode client
 * @param {string} sessionID - Parent session ID
 * @returns {{ providerID: string, modelID: string } | null}
 */
async function discoverParentModel(client, sessionID) {
  // Strategy 1: Walk assistant messages backwards (most reliable)
  try {
    const { data: msgs, error } = await client.session.messages({
      path: { id: sessionID },
      query: { limit: 50 },
    });

    if (!error && msgs) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.info?.role === "assistant" && m.info?.providerID && m.info?.modelID) {
          return { providerID: m.info.providerID, modelID: m.info.modelID };
        }
      }
    }
  } catch {
    // Strategy 1 failed, continue to fallback
  }

  // Strategy 2: Look for user messages with model hints
  try {
    const { data: msgs } = await client.session.messages({
      path: { id: sessionID },
      query: { limit: 10 },
    });

    if (msgs) {
      // Check if any message has model metadata
      for (const m of msgs) {
        if (m.info?.modelID && m.info?.providerID) {
          return { providerID: m.info.providerID, modelID: m.info.modelID };
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
 * @param {object} client - OpenCode client
 * @param {string} childID - Child session ID
 * @returns {string} The assistant's text output
 */
async function collectOutput(client, childID) {
  try {
    const { data: finalMsgs } = await client.session.messages({
      path: { id: childID },
    });

    if (finalMsgs) {
      for (let i = finalMsgs.length - 1; i >= 0; i--) {
        const m = finalMsgs[i];
        if (m.info?.role === "assistant") {
          const text = m.parts
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

export default function plugin(input) {
  const timeoutMs = resolveTimeoutMs();

  return {
    tool: {
      "inherit-task": {
        description:
          "Run a sub-agent that inherits the parent session's model. " +
          "Use exactly like `task` but the child will use the same model " +
          "as the current session.",
        args: {
          subagent_type: {
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

        async execute(args, context) {
          const client = input.client;
          const childTitle = `${args.description} (@${args.subagent_type})`;

          // ── 1. Discover parent model ──────────────────────────────
          const model = await discoverParentModel(client, context.sessionID);

          if (!model) {
            return (
              "[inherit-task] ERROR: Could not determine parent model. " +
              "Make sure the session has at least one assistant response. " +
              "Tried: assistant message scan, user message scan."
            );
          }

          const { providerID, modelID } = model;

          // ── 2. Create child session ───────────────────────────────
          let child;
          try {
            const result = await client.session.create({
              body: { parentID: context.sessionID, title: childTitle },
              query: { directory: context.directory },
            });
            child = result.data;
            if (result.error || !child) {
              return `[inherit-task] Session creation failed: ${JSON.stringify(result.error || "no data")}`;
            }
          } catch (err) {
            return `[inherit-task] Session creation exception: ${err.message}`;
          }

          const childID = child.id;

          // ── 3. Send prompt — explicitly pass parent model ──────────
          try {
            const { error: promptErr } = await client.session.prompt({
              path: { id: childID },
              body: {
                agent: args.subagent_type,
                model: { providerID, modelID },
                parts: [{ type: "text", text: args.prompt }],
              },
            });

            if (promptErr) {
              return `[inherit-task] Prompt failed: ${JSON.stringify(promptErr)}`;
            }
          } catch (err) {
            return `[inherit-task] Prompt exception: ${err.message}`;
          }

          // ── 4. Poll until child session is idle ────────────────────
          const maxPolls = Math.ceil(timeoutMs / POLL_INITIAL_MS);
          let polls = 0;
          let pollInterval = POLL_INITIAL_MS;

          while (polls < maxPolls) {
            if (context.abort?.aborted) {
              return "[inherit-task] ABORTED by user";
            }

            await new Promise((r) => setTimeout(r, pollInterval));

            try {
              const { data: statusMap } = await client.session.status({
                query: { directory: context.directory },
              });

              const st = statusMap?.[childID];
              // Break on idle (completed), error, or missing session
              if (!st || st.type === "idle" || st.type === "error") break;
            } catch {
              // Status check failed — continue polling (session might still be running)
            }

            polls++;
            // Exponential backoff: 400 → 800 → 1600 → 2000 (cap)
            pollInterval = Math.min(pollInterval * 2, POLL_MAX_MS);
          }

          if (polls >= maxPolls) {
            const timeoutSec = Math.round(timeoutMs / 1000);
            return `[inherit-task] TIMEOUT — child session did not finish in ${timeoutSec}s. Increase with INHERIT_TASK_TIMEOUT_MS env var (current: ${timeoutMs}ms).`;
          }

          // ── 5. Collect final output ────────────────────────────────
          const output = await collectOutput(client, childID);
          return output || "(task completed, no text output)";
        },
      },
    },
  };
}
