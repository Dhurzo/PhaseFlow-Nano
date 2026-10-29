/**
 * test-jsonc-edit.js — tests for the comment-preserving JSONC edits
 *
 * Run with: node --test tests/test-jsonc-edit.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  findTopLevelKey,
  findValueEnd,
  listArrayStrings,
  removePluginEntries,
  renameTopLevelKey,
  skipTrivia,
} from "../tools/jsonc-edit.js";

// ── Tests ───────────────────────────────────────────────

describe("jsonc-edit", () => {
  describe("skipTrivia", () => {
    it("skips whitespace, commas and comments", () => {
      const text = '{ /* a */ "a": 1, // b\n "b": 2 }';
      const index = skipTrivia(text, 1);
      assert.equal(text[index], '"');
    });
  });

  describe("findTopLevelKey", () => {
    it("finds a top-level key and its value span", () => {
      const text = '{\n  "model": "x",\n  "plugin": ["model-inheritance"]\n}';
      const found = findTopLevelKey(text, "plugin");
      assert.ok(found);
      assert.equal(text.slice(found.keyStart, found.keyEnd), '"plugin"');
      assert.equal(text.slice(found.valueStart, found.valueEnd), '["model-inheritance"]');
    });

    it("ignores nested keys with the same name", () => {
      const text = '{\n  "mcp": { "plugin": { "x": 1 } },\n  "plugin": ["a"]\n}';
      const found = findTopLevelKey(text, "plugin");
      assert.equal(text.slice(found.valueStart, found.valueEnd), '["a"]');
    });

    it("skips over comments between members", () => {
      const text = '{\n  // comment\n  "plugin": ["a"]\n}';
      const found = findTopLevelKey(text, "plugin");
      assert.ok(found);
      assert.equal(text.slice(found.valueStart, found.valueEnd), '["a"]');
    });

    it("returns null for a missing key", () => {
      assert.equal(findTopLevelKey('{"a": 1}', "plugin"), null);
    });
  });

  describe("findValueEnd", () => {
    it("handles strings with escaped quotes", () => {
      const text = '"a\\"b" tail';
      assert.equal(text.slice(0, findValueEnd(text, 0)), '"a\\"b"');
    });

    it("handles nested objects and arrays", () => {
      const text = '{"a": [1, {"b": 2}]} tail';
      const end = findValueEnd(text, 0);
      assert.equal(text.slice(0, end), '{"a": [1, {"b": 2}]}');
      assert.equal(text.slice(end), " tail");
    });
  });

  describe("listArrayStrings", () => {
    it("lists the string elements", () => {
      const text = '["a", "b", "c"]';
      const elements = listArrayStrings(text, 0);
      assert.deepEqual(
        elements.map((e) => e.value),
        ["a", "b", "c"],
      );
    });

    it("ignores non-string elements", () => {
      const text = '["a", {"b": 1}, "c"]';
      const elements = listArrayStrings(text, 0);
      assert.deepEqual(
        elements.map((e) => e.value),
        ["a", "c"],
      );
    });
  });

  describe("renameTopLevelKey", () => {
    it("renames the key and keeps the rest", () => {
      const text = '{\n  // keep me\n  "plugin": ["a"]\n}';
      const { text: result, renamed } = renameTopLevelKey(text, "plugin", "plugins");
      assert.ok(renamed);
      assert.ok(result.includes('"plugins": ["a"]'));
      assert.ok(result.includes("// keep me"));
    });

    it("reports no rename for a missing key", () => {
      const { renamed } = renameTopLevelKey('{"a": 1}', "plugin", "plugins");
      assert.equal(renamed, false);
    });
  });

  describe("removePluginEntries", () => {
    it("removes a named entry and keeps the comments", () => {
      const text = '{\n  // keep me\n  "plugin": ["model-inheritance", "other"]\n}';
      const { text: result, removed } = removePluginEntries(text, ["model-inheritance"]);
      assert.deepEqual(removed, ["model-inheritance"]);
      assert.ok(result.includes("// keep me"));
      assert.ok(result.includes('"other"'));
      assert.ok(!result.includes("model-inheritance"));
    });

    it("removes the whole key when the array becomes empty", () => {
      const text = '{\n  "model": "x",\n  "plugin": ["model-inheritance"]\n}';
      const { text: result, removed } = removePluginEntries(text, ["model-inheritance"]);
      assert.deepEqual(removed, ["model-inheritance"]);
      assert.ok(!result.includes("plugin"));
      assert.ok(result.includes('"model": "x"'));
    });

    it("handles the last element without a trailing comma", () => {
      const text = '{\n  "plugin": [\n    "other",\n    "model-inheritance"\n  ]\n}';
      const { text: result, removed } = removePluginEntries(text, ["model-inheritance"]);
      assert.deepEqual(removed, ["model-inheritance"]);
      assert.ok(result.includes('"other"'));
      assert.ok(!result.includes("model-inheritance"));
    });

    it("leaves the file untouched when there is nothing to remove", () => {
      const text = '{\n  "plugin": ["other"]\n}';
      const { text: result, removed } = removePluginEntries(text, ["model-inheritance"]);
      assert.deepEqual(removed, []);
      assert.equal(result, text);
    });
  });
});
