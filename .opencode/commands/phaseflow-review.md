---
description: Audit the code generated in a phase (bugs, security, quality, compliance) — optional phase number
---

Reviews the deliverables of a completed phase to detect issues before continuing.

Call the `phaseflow-reviewer` sub-agent via `inherit-task` (preferred) or `subagent` (fallback) with `agent="phaseflow-reviewer"`. Do NOT review directly — delegate to the sub-agent.

The sub-agent audits:
- ✅ Plan compliance (expected outputs)
- 🐛 Logic, type, and flow bugs
- 🔒 Security vulnerabilities
- 📊 Code quality (duplication, readability, coupling)
- 🔄 Consistency with the rest of the project

Generates `outputs/phase-X/REVIEW.md` with findings classified by severity:
- 🔴 Critical (blocks next phase)
- 🟡 Important (should be fixed)
- 🔵 Minor (suggestions)

**Run automatically after each completed phase.**
