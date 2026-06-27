/**
 * model-inheritance — OpenCode plugin
 *
 * Registers the `inherit-task` custom tool, which behaves like the
 * built-in `task` tool but passes the parent session's model to the
 * sub-agent.  This means sub-agents use whatever model you have
 * selected in the TUI instead of falling back to a different default.
 */

export default function plugin(input) {
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
          const { data: msgs, error: msgsErr } = await client.session.messages({
            path: { id: context.sessionID },
            query: { limit: 30 },
          });

          if (msgsErr) {
            return `[inherit-task] Cannot read parent messages: ${JSON.stringify(msgsErr)}`;
          }

          let providerID;
          let modelID;
          if (msgs) {
            // Walk backwards — most recent assistant message has the model
            for (let i = msgs.length - 1; i >= 0; i--) {
              const m = msgs[i];
              if (m.info?.role === "assistant" && m.info?.providerID) {
                providerID = m.info.providerID;
                modelID   = m.info.modelID;
                break;
              }
            }
          }

          if (!providerID) {
            return (
              "[inherit-task] ERROR: Could not determine parent model. " +
              "Make sure the session has at least one assistant response."
            );
          }

          // ── 2. Create child session ───────────────────────────────
          const { data: child, error: createErr } = await client.session.create({
            body: { parentID: context.sessionID, title: childTitle },
            query: { directory: context.directory },
          });

          if (createErr || !child) {
            return `[inherit-task] Session creation failed: ${JSON.stringify(createErr)}`;
          }

          const childID = child.id;

          // ── 3. Send prompt — explicitly pass parent model ──────────
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

          // ── 4. Poll until child session is idle ────────────────────
          const POLL_MS   = 600;  // check every 600 ms
          const MAX_POLLS = 600;  // ~6 minutes ceiling
          let polls = 0;

          while (polls < MAX_POLLS) {
            if (context.abort.aborted) {
              return "[inherit-task] ABORTED by user";
            }

            await new Promise((r) => setTimeout(r, POLL_MS));

            const { data: statusMap } = await client.session.status({
              query: { directory: context.directory },
            });

            const st = statusMap?.[childID];
            // Break on idle (completed), error, or missing session — don't wait for timeout
            if (!st || st.type === "idle" || st.type === "error") break;

            polls++;
          }

          if (polls >= MAX_POLLS) {
            return "[inherit-task] TIMEOUT — child session did not finish in time";
          }

          // ── 5. Collect final output ────────────────────────────────
          const { data: finalMsgs } = await client.session.messages({
            path: { id: childID },
          });

          let output = "";
          if (finalMsgs) {
            for (let i = finalMsgs.length - 1; i >= 0; i--) {
              const m = finalMsgs[i];
              if (m.info?.role === "assistant") {
                output = m.parts
                  .filter((p) => p.type === "text" && p.text)
                  .map((p) => p.text)
                  .join("\n");
                if (output) break;
              }
            }
          }

          return output || "(task completed, no text output)";
        },
      },
    },
  };
}
