/**
 * test-state-machine.js — Tests for PhaseFlow state machine logic
 *
 * Tests the file-based state transitions that the orchestrator/builder/reviewer use:
 * - .phase file reads/writes
 * - .retry-count increment logic
 * - .loop-count increment logic
 * - State transition rules
 *
 * Run with: node --test tests/test-state-machine.js
 * Requires: Node.js ≥ 18 (built-in test runner)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

const TEST_DIR = join(import.meta.dirname, ".test-tmp");

// ── Helpers ─────────────────────────────────────────────

function setupTestDir() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTestDir() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
}

function createPhaseDir(id, state = "pending") {
  const dir = join(TEST_DIR, `phase-${id}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".phase"), state);
  return dir;
}

function readPhaseState(id) {
  const file = join(TEST_DIR, `phase-${id}`, ".phase");
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf8").trim();
}

function writePhaseState(id, state) {
  const file = join(TEST_DIR, `phase-${id}`, ".phase");
  writeFileSync(file, state);
}

function readCounter(id, name) {
  const file = join(TEST_DIR, `phase-${id}`, name);
  if (!existsSync(file)) return null;
  return parseInt(readFileSync(file, "utf8").trim(), 10);
}

function writeCounter(id, name, value) {
  const dir = join(TEST_DIR, `phase-${id}`);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), String(value));
}

// ── Tests ───────────────────────────────────────────────

describe("PhaseFlow state machine", () => {
  beforeEach(() => setupTestDir());
  afterEach(() => cleanupTestDir());

  describe(".phase file operations", () => {
    it("writes and reads phase state", () => {
      createPhaseDir(1, "pending");
      assert.equal(readPhaseState(1), "pending");

      writePhaseState(1, "in_progress");
      assert.equal(readPhaseState(1), "in_progress");
    });

    it("returns null for missing phase", () => {
      assert.equal(readPhaseState(99), null);
    });

    it("valid states are single lowercase words", () => {
      const validStates = ["pending", "in_progress", "completed", "reviewed", "requires_fix", "blocked", "error"];
      for (const state of validStates) {
        createPhaseDir(1, state);
        const read = readPhaseState(1);
        assert.equal(read, state, `State "${state}" should be read back correctly`);
      }
    });
  });

  describe("retry-count logic", () => {
    it("defaults to 0 when file doesn't exist", () => {
      createPhaseDir(1);
      assert.equal(readCounter(1, ".retry-count"), null);
    });

    it("increments retry count: read N → write N+1", () => {
      createPhaseDir(1, "requires_fix");

      // First retry: 0 → 1
      let count = readCounter(1, ".retry-count") || 0;
      assert.equal(count, 0);
      writeCounter(1, ".retry-count", count + 1);
      assert.equal(readCounter(1, ".retry-count"), 1);

      // Second retry: 1 → 2
      count = readCounter(1, ".retry-count") || 0;
      assert.equal(count, 1);
      writeCounter(1, ".retry-count", count + 1);
      assert.equal(readCounter(1, ".retry-count"), 2);

      // Third retry: 2 → 3
      count = readCounter(1, ".retry-count") || 0;
      assert.equal(count, 2);
      writeCounter(1, ".retry-count", count + 1);
      assert.equal(readCounter(1, ".retry-count"), 3);
    });

    it("marks ERROR when retry count >= 3", () => {
      createPhaseDir(1, "requires_fix");
      writeCounter(1, ".retry-count", 3);

      const count = readCounter(1, ".retry-count") || 0;
      assert.ok(count >= 3, "Should trigger ERROR when retry count >= 3");

      // Simulate orchestrator marking ERROR
      writePhaseState(1, "error");
      assert.equal(readPhaseState(1), "error");
    });

    it("cleans up retry-count on terminal state", () => {
      createPhaseDir(1, "reviewed");
      writeCounter(1, ".retry-count", 2);

      // Simulate Step 6 housekeeping
      const state = readPhaseState(1);
      if (["reviewed", "blocked", "error"].includes(state)) {
        const counterFile = join(TEST_DIR, "phase-1", ".retry-count");
        rmSync(counterFile);
      }

      assert.equal(existsSync(join(TEST_DIR, "phase-1", ".retry-count")), false);
    });
  });

  describe("loop-count logic", () => {
    it("defaults to 0 when file doesn't exist", () => {
      createPhaseDir(1);
      assert.equal(readCounter(1, ".loop-count"), null);
    });

    it("increments loop count: read N → write N+1", () => {
      createPhaseDir(1, "pending");

      // First dispatch: 0 → 1
      let count = readCounter(1, ".loop-count") || 0;
      writeCounter(1, ".loop-count", count + 1);
      assert.equal(readCounter(1, ".loop-count"), 1);

      // Second dispatch: 1 → 2
      count = readCounter(1, ".loop-count") || 0;
      writeCounter(1, ".loop-count", count + 1);
      assert.equal(readCounter(1, ".loop-count"), 2);
    });

    it("marks ERROR when loop count >= 8", () => {
      createPhaseDir(1, "in_progress");
      writeCounter(1, ".loop-count", 8);

      const count = readCounter(1, ".loop-count") || 0;
      assert.ok(count >= 8, "Should trigger ERROR when loop count >= 8");

      writePhaseState(1, "error");
      assert.equal(readPhaseState(1), "error");
    });
  });

  describe("state transitions", () => {
    it("pending → in_progress → completed → reviewed (happy path)", () => {
      createPhaseDir(1, "pending");

      // Builder starts
      writePhaseState(1, "in_progress");
      assert.equal(readPhaseState(1), "in_progress");

      // Builder finishes
      writePhaseState(1, "completed");
      assert.equal(readPhaseState(1), "completed");

      // Reviewer approves
      writePhaseState(1, "reviewed");
      assert.equal(readPhaseState(1), "reviewed");
    });

    it("completed → requires_fix → completed → reviewed (fix cycle)", () => {
      createPhaseDir(1, "completed");

      // Reviewer finds issues
      writePhaseState(1, "requires_fix");
      assert.equal(readPhaseState(1), "requires_fix");

      // Builder fixes
      writePhaseState(1, "completed");
      assert.equal(readPhaseState(1), "completed");

      // Reviewer approves
      writePhaseState(1, "reviewed");
      assert.equal(readPhaseState(1), "reviewed");
    });

    it("in_progress → blocked (missing dependency)", () => {
      createPhaseDir(2, "pending");
      writePhaseState(2, "blocked");
      assert.equal(readPhaseState(2), "blocked");
    });

    it("in_progress → error (unrecoverable failure)", () => {
      createPhaseDir(1, "in_progress");
      writePhaseState(1, "error");
      assert.equal(readPhaseState(1), "error");
    });

    it("terminal states stop processing", () => {
      const terminalStates = ["reviewed", "blocked", "error"];
      for (const state of terminalStates) {
        createPhaseDir(1, state);
        // Simulate orchestrator check: if terminal, skip
        const current = readPhaseState(1);
        const isTerminal = ["reviewed", "blocked", "error"].includes(current);
        assert.ok(isTerminal, `State "${current}" should be terminal`);
      }
    });
  });

  describe("orchestrator dispatch logic", () => {
    it("picks in_progress first (resume)", () => {
      createPhaseDir(1, "completed");
      createPhaseDir(2, "in_progress");
      createPhaseDir(3, "pending");

      // Orchestrator priority: in_progress > requires_fix > completed > pending
      const phases = [1, 2, 3];
      let next = null;
      for (const id of phases) {
        const state = readPhaseState(id);
        if (state === "in_progress") { next = id; break; }
      }
      assert.equal(next, 2);
    });

    it("picks requires_fix before pending", () => {
      createPhaseDir(1, "pending");
      createPhaseDir(2, "requires_fix");
      createPhaseDir(3, "pending");

      const phases = [1, 2, 3];
      let next = null;
      for (const id of phases) {
        const state = readPhaseState(id);
        if (state === "requires_fix") { next = id; break; }
      }
      assert.equal(next, 2);
    });

    it("picks completed (needs review) before pending", () => {
      createPhaseDir(1, "pending");
      createPhaseDir(2, "completed");
      createPhaseDir(3, "pending");

      const phases = [1, 2, 3];
      let next = null;
      for (const id of phases) {
        const state = readPhaseState(id);
        if (state === "completed") { next = id; break; }
      }
      assert.equal(next, 2);
    });

    it("picks pending when no other non-terminal states", () => {
      createPhaseDir(1, "reviewed");
      createPhaseDir(2, "pending");
      createPhaseDir(3, "reviewed");

      const phases = [1, 2, 3];
      let next = null;
      for (const id of phases) {
        const state = readPhaseState(id);
        if (state === "pending") { next = id; break; }
      }
      assert.equal(next, 2);
    });

    it("returns null when all phases are terminal", () => {
      createPhaseDir(1, "reviewed");
      createPhaseDir(2, "reviewed");
      createPhaseDir(3, "error");

      const phases = [1, 2, 3];
      let next = null;
      for (const id of phases) {
        const state = readPhaseState(id);
        if (["pending", "in_progress", "completed", "requires_fix"].includes(state)) {
          next = id;
          break;
        }
      }
      assert.equal(next, null);
    });
  });

  describe("pre-dispatch integrity check", () => {
    it("rejects dispatch for terminal state", () => {
      createPhaseDir(1, "reviewed");
      const state = readPhaseState(1);
      const isTerminal = ["reviewed", "blocked", "error"].includes(state);
      assert.ok(isTerminal, "Should reject dispatch for reviewed state");
    });

    it("allows dispatch for pending state", () => {
      createPhaseDir(1, "pending");
      const state = readPhaseState(1);
      const isTerminal = ["reviewed", "blocked", "error"].includes(state);
      assert.ok(!isTerminal, "Should allow dispatch for pending state");
    });

    it("allows dispatch for in_progress state (resume)", () => {
      createPhaseDir(1, "in_progress");
      const state = readPhaseState(1);
      const isTerminal = ["reviewed", "blocked", "error"].includes(state);
      assert.ok(!isTerminal, "Should allow dispatch for in_progress state");
    });
  });
});
