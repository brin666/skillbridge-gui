"""Verify source provenance and stale-translation handling with synthetic files."""
import copy
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from types import SimpleNamespace

from scripts.catalog_presentation import apply_existing, build, description_hash, thread_names
from backend.workspace.service import Workspace
from backend.workspace.router import dispatch


class CatalogPresentationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def asset(self, kind, path, identifier="asset"):
        return {"id": identifier, "kind": kind, "title": "database-like-name",
                "source": {"path": str(path)}, "scope": {"type": "personal"},
                "confirmation": "draft", "updatedAt": "2026-11-11T00:00:00Z"}

    def test_database_names_precede_raw_titles_and_unrelated_threads_are_excluded(self):
        path = self.root / "state_5.sqlite"
        with closing(sqlite3.connect(path)) as db, db:
            db.execute("CREATE TABLE threads (id TEXT, name TEXT, title TEXT)")
            db.executemany("INSERT INTO threads VALUES (?,?,?)", [
                ("linked", "可读的会话名", "raw first message"),
                ("unlinked", "不应被读取的会话", "unrelated"),
            ])
        before = path.read_bytes()
        names, errors = thread_names(self.root, {"linked"})
        self.assertEqual(names, {"linked": {"title": "可读的会话名", "source": "Codex 会话名称"}})
        self.assertEqual(errors, [])
        self.assertEqual(path.read_bytes(), before)

    def test_missing_database_uses_named_index_with_explicit_provenance(self):
        (self.root / "session_index.jsonl").write_text(
            "invalid line\n" + json.dumps({"id": "linked", "thread_name": "索引名称"}) + "\n",
            encoding="utf-8")
        names, errors = thread_names(self.root, {"linked"})
        self.assertEqual(names["linked"], {"title": "索引名称", "source": "Codex 会话索引"})
        self.assertEqual(errors, [])

    def test_memory_fallback_uses_document_heading_without_renaming_source(self):
        path = self.root / "2026-11-11-uuid.md"
        path.write_text("thread_id: unavailable\nupdated_at: 2026-11-10\n\n# 页面动效讨论\n", encoding="utf-8")
        before = path.read_bytes()
        asset = self.asset("memory", path)
        original = copy.deepcopy(asset)
        output = build(SimpleNamespace(assets=lambda: [asset]), self.root, {"data": []}, {})
        self.assertEqual(output["items"][0]["title"], "页面动效讨论")
        self.assertEqual(output["items"][0]["titleSource"], "记忆文档标题")
        self.assertEqual(output["matchedMemoryTitles"], 0)
        self.assertEqual(asset, original)
        self.assertEqual(path.read_bytes(), before)

    def test_changed_description_does_not_reuse_stale_chinese_translation(self):
        folder = self.root / "skills" / "test"
        skill = {"path": str(folder / "SKILL.md"), "name": "test", "description": "Old purpose"}
        catalog = {"data": [{"skills": [skill]}]}
        labels = {"test": {"titleZh": "中文名称", "summaryZh": "中文用途",
                           "sourceHashes": [description_hash("test", "Old purpose")]}}
        workspace = SimpleNamespace(assets=lambda: [self.asset("skill", folder)])
        self.assertEqual(build(workspace, self.root, catalog, labels)["translatedSkills"], 1)
        skill["description"] = "New purpose"
        output = build(workspace, self.root, catalog, labels)
        self.assertEqual(output["translatedSkills"], 0)
        self.assertEqual(output["items"][0]["summary"], "New purpose")
        self.assertEqual(output["items"][0]["translation"], "尚未准备中文简介")

    def test_persisted_metadata_preserves_cart_preference_and_revision_and_skips_changed_sources(self):
        workspace = Workspace(self.root / "profile")
        folder = self.root / "skill"
        folder.mkdir()
        source = folder / "SKILL.md"
        source.write_text("# Test\n", encoding="utf-8")
        extra = folder / "helper.py"
        extra.write_text("print('fixture')", encoding="utf-8")
        asset = workspace.register_asset({"kind": "skill", "path": str(folder), "title": "用户命名"})
        preference = workspace.set_preference(asset["id"], {"scope": "personal", "frequent": True})
        cart = workspace.create_cart({})
        cart = dispatch(workspace, "POST", f"/api/v1/carts/{cart['id']}/items", {
            "expectedVersion": cart["version"], "assetId": asset["id"]})[1]
        catalog = {"data": [{"skills": [{"path": str(source), "name": "test", "description": "Example"}]}]}
        result = apply_existing(workspace, self.root, catalog, {})
        self.assertEqual(result, {"updated": 1, "unchanged": 0, "errors": []})
        current = workspace.get_asset(asset["id"])
        self.assertEqual(current["title"], "用户命名")
        self.assertEqual(current["revisionId"], asset["revisionId"])
        self.assertEqual(current["preferences"][0], preference)
        self.assertEqual(dispatch(workspace, "GET", f"/api/v1/carts/{cart['id']}")[1], cart)
        self.assertEqual(apply_existing(workspace, self.root, catalog, {})["unchanged"], 1)
        # A changed accompanying file blocks metadata re-registration too.
        extra.write_text("print('changed')", encoding="utf-8")
        catalog["data"][0]["skills"][0]["description"] = "New description"
        result = apply_existing(workspace, self.root, catalog, {})
        self.assertEqual(result["updated"], 0)
        self.assertEqual(result["errors"][0]["code"], "SOURCE_CHANGED")
        self.assertEqual(workspace.get_asset(asset["id"])["version"], current["version"])


if __name__ == "__main__":
    unittest.main()
