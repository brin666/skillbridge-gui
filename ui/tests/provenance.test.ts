import test from "node:test";
import assert from "node:assert/strict";
import { sourceEnvironments, sourceNames } from "../src/workspace/provenance";
import { presentationSearch } from "../src/workspace/presentation";
import type { Asset } from "../src/workspace/types";

const asset = {id: "shared", title: "Shared instructions", kind: "rule", scope: {type: "personal"},
  source: {type: "path", path: "D:/fixture/AGENTS.md"}, files: [],
  environment: {harness: "Codex", sources: [{harness: "Codex", agent: "local"}, {harness: "Pi", agent: "local"}]},
} as Asset;

test("shared asset is visible under each source without creating a new identity", () => {
  assert.deepEqual(sourceNames(asset), ["Codex", "Pi"]);
  assert.equal(sourceEnvironments(asset).length, 2);
  assert.ok(presentationSearch(asset).includes("pi"));
  assert.equal(asset.id, "shared");
});

test("old and malformed source metadata remain usable", () => {
  assert.deepEqual(sourceNames({...asset, environment: {harness: "Claude Code"}}), ["Claude Code"]);
  assert.deepEqual(sourceNames({...asset, environment: {harness: "Hermes", sources: [null, {}, "Pi"]}}), ["Hermes"]);
  assert.deepEqual(sourceNames({...asset, environment: null}), ["未标明应用"]);
});
