import test from "node:test";
import assert from "node:assert/strict";
import { displayTitle, presentationOf, presentationSearch } from "../src/workspace/presentation";
import type { Asset } from "../src/workspace/types";

const asset = {
  id: "fixture", kind: "skill", title: "original-name", source: {type: "path", path: "D:/fixture"},
  scope: {type: "personal"}, files: [{path: "SKILL.md", size: 8, sha256: "source-hash"}],
  environment: {harness: "Codex", presentation: {schemaVersion: 1, title: "前端设计", summary: "制作页面与交互",
    sourceFile: "SKILL.md", sourceSha256: "source-hash", originalName: "frontend-design"}},
} as Asset;

test("Chinese display and search preserve the asset identity and source name", () => {
  assert.equal(displayTitle(asset), "前端设计");
  assert.ok(presentationSearch(asset).includes("制作页面"));
  assert.ok(presentationSearch(asset).includes("frontend-design"));
  assert.equal(asset.title, "original-name");
  assert.equal(asset.id, "fixture");
});

test("a refreshed source does not keep a stale translation", () => {
  const changed = {...asset, files: [{...asset.files[0], sha256: "new-source"}]};
  assert.equal(presentationOf(changed), null);
  assert.equal(displayTitle(changed), "original-name");
  assert.equal(presentationSearch(changed).includes("制作页面"), false);
});

test("disabled skill status remains visible and malformed metadata is ignored", () => {
  assert.equal(displayTitle({...asset, environment: {...asset.environment, enabled: false}}), "前端设计 · 已禁用");
  assert.equal(presentationOf({...asset, environment: {presentation: {title: "unsupported"}}}), null);
});
