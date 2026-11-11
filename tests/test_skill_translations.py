"""Exercise the offline all-Harness Skill translation handoff with synthetic assets."""
import json
from pathlib import Path
import tempfile
import unittest

from backend.workspace.router import dispatch
from backend.workspace.service import Workspace
from scripts import codex_inventory
from scripts.catalog_presentation import description_hash
from scripts.skill_translations import apply, prepare


class SkillTranslationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.ws = Workspace(self.root / "profile")

    def tearDown(self):
        self.tmp.cleanup()

    def add(self, harness, description, name="same-skill", folder_name=None):
        folder = self.root / harness / "skills" / (folder_name or name)
        folder.mkdir(parents=True)
        (folder / "SKILL.md").write_text(f"---\nname: {name}\ndescription: {description}\n---\n", encoding="utf-8")
        return self.ws.register_asset({"kind": "skill", "path": str(folder), "title": name,
            "environment": {"harness": harness, "sources": [harness]}, "ownership": "user"})

    def test_four_harnesses_prepare_translate_apply_and_preserve_draft_and_preferences(self):
        assets = [self.add(harness, f"{harness} purpose") for harness in ("Codex", "Claude Code", "Hermes", "Pi")]
        pref = self.ws.set_preference(assets[0]["id"], {"scope": "harness:codex:agent:local", "frequent": True})
        cart = self.ws.create_cart({})
        for asset in assets:
            cart = dispatch(self.ws, "POST", f"/api/v1/carts/{cart['id']}/items", {
                "expectedVersion": cart["version"], "assetId": asset["id"]})[1]
        before_items = list(cart["items"])
        request = self.root / "translate.json"
        result = prepare(self.ws, request)
        self.assertEqual(result["prepared"], 4)
        payload = json.loads(request.read_text(encoding="utf-8"))
        for item in payload["items"]:
            item["titleZh"] = "跨应用技能"
            item["summaryZh"] = f"整理 {item['originalDescription']}。"
        request.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        outcome = apply(self.ws, request)
        self.assertEqual(outcome["updated"], 4)
        for asset in assets:
            current = self.ws.get_asset(asset["id"])
            self.assertEqual(current["revisionId"], asset["revisionId"])
            self.assertEqual(current["environment"]["sources"], [current["environment"]["harness"]])
            self.assertEqual(current["environment"]["presentation"]["originalName"], "same-skill")
            self.assertIn("中文", current["environment"]["presentation"]["translation"])
        self.assertEqual(self.ws.get_asset(assets[0]["id"])["preferences"][0]["id"], pref["id"])
        self.assertEqual(dispatch(self.ws, "GET", f"/api/v1/carts/{cart['id']}")[1]["items"], before_items)
        again = prepare(self.ws, request)
        self.assertEqual(again["prepared"], 0)
        self.assertEqual(again["alreadyTranslated"], 4)
        # Names are content-bound: the same name with a different description stays a separate row.
        cached_asset = self.add("Pi", "Codex purpose", folder_name="cached-copy")
        result = prepare(self.ws, request)
        self.assertEqual(result["prepared"], 1)
        self.assertEqual(result["prefilledFromCache"], 1)
        self.assertEqual(json.loads(request.read_text(encoding="utf-8"))["items"][0]["titleZh"], "跨应用技能")
        # A same-name Skill with a different description receives no stale cache hit.
        different = self.add("Pi", "different purpose", name="same-skill-2")
        result = prepare(self.ws, request)
        rows = {item["assetId"]: item for item in json.loads(request.read_text(encoding="utf-8"))["items"]}
        self.assertEqual(rows[different["id"]]["titleZh"], "")
        self.assertEqual(rows[cached_asset["id"]]["titleZh"], "跨应用技能")

    def test_refresh_reuses_matching_cache_and_changed_description_invalidates_it(self):
        asset = self.add("Codex", "Original purpose")
        path = self.root / "translations.json"
        prepare(self.ws, path)
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["items"][0].update(titleZh="原文工具", summaryZh="处理原始用途说明。")
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(apply(self.ws, path)["updated"], 1)
        saved = self.ws.get_asset(asset["id"])
        unchanged = self.skill_request(saved, "Original purpose")
        _, errors = codex_inventory.register(self.ws, [unchanged])
        self.assertEqual(errors, [])
        refreshed = self.ws.get_asset(asset["id"])
        self.assertEqual(refreshed["environment"]["presentation"]["summary"], "处理原始用途说明。")

        skill_file = Path(asset["source"]["path"]) / "SKILL.md"
        skill_file.write_text("---\nname: same-skill\ndescription: New purpose\n---\n", encoding="utf-8")
        stale = self.skill_request(refreshed, "New purpose")
        _, errors = codex_inventory.register(self.ws, [stale])
        self.assertEqual(errors, [])
        updated = self.ws.get_asset(asset["id"])
        self.assertEqual(updated["environment"]["presentation"]["summary"], "New purpose")
        self.assertNotEqual(description_hash("same-skill", "New purpose"),
                            description_hash("same-skill", "Original purpose"))

    def skill_request(self, asset, description):
        path = Path(asset["source"]["path"])
        skill_file = path / "SKILL.md"
        digest = __import__("hashlib").sha256(skill_file.read_bytes()).hexdigest()
        return {"kind": "skill", "path": str(path), "title": asset["title"], "scope": asset["scope"],
            "ownership": asset["ownership"], "environment": {"harness": "Codex", "agent": "local",
                "presentation": {"schemaVersion": 1, "sourceFile": skill_file.name, "sourceSha256": digest,
                    "originalName": "same-skill", "originalDescription": description,
                    "title": "same-skill", "summary": description, "titleSource": "Skill 原名",
                    "translation": "尚未准备中文简介"}}}

    def test_changed_source_and_asset_version_are_refused(self):
        asset = self.add("Hermes", "old purpose")
        path = self.root / "translate.json"
        prepare(self.ws, path)
        data = json.loads(path.read_text(encoding="utf-8"))
        row = data["items"][0]
        row.update(titleZh="中文名称", summaryZh="中文用途")
        (Path(asset["source"]["path"]) / "SKILL.md").write_text(
            "---\nname: same-skill\ndescription: new purpose\n---\n", encoding="utf-8")
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        result = apply(self.ws, path)
        self.assertEqual(result["errors"][0]["reason"], "SOURCE_CHANGED")
        asset = self.add("Pi", "stable purpose")
        prepare(self.ws, path)
        data = json.loads(path.read_text(encoding="utf-8"))
        data["items"] = [row for row in data["items"] if row["assetId"] == asset["id"]]
        row = data["items"][0]
        row.update(titleZh="中文名称", summaryZh="中文用途")
        self.ws.register_asset({"kind": "skill", "path": asset["source"]["path"], "title": asset["title"],
                                "environment": asset["environment"], "ownership": asset["ownership"]})
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        result = apply(self.ws, path)
        self.assertEqual(result["errors"][0]["reason"], "VERSION_CONFLICT")

    def test_blank_translation_is_not_applied(self):
        asset = self.add("Codex", "A clear useful purpose")
        self.ws.register_asset({"kind": "skill", "path": asset["source"]["path"],
            "title": asset["title"], "ownership": asset["ownership"], "scope": asset["scope"],
            "environment": {"harness": "Codex", "presentation": ["malformed legacy metadata"]}})
        path = self.root / "translate.json"
        prepare(self.ws, path)
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["items"][0]["titleZh"] = ""
        payload["items"][0]["summaryZh"] = ""
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        self.assertEqual(apply(self.ws, path)["errors"][0]["reason"], "TRANSLATION_INCOMPLETE")


if __name__ == "__main__":
    unittest.main()
