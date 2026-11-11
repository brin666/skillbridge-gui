"""Behavioral coverage of profile, selection and immutable handoff exports."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
import json
import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backend.workspace.errors import WorkspaceError
from backend.workspace.exporter import verify_package
from backend.workspace.service import Workspace


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.data = self.root / "profile"
        self.workspace = Workspace(self.data)

    def tearDown(self):
        for worker in self.workspace._threads.values():
            worker.join(5)
        self.tmp.cleanup()

    def asset(self, name="demo"):
        source = self.root / name
        source.mkdir()
        (source / "SKILL.md").write_text("---\nname: demo\ndescription: Demo\n---\nUse scripts/run.py.\n", encoding="utf-8")
        (source / "scripts").mkdir()
        (source / "scripts" / "run.py").write_text("print('demo')\n", encoding="utf-8")
        (source / "assets").mkdir()
        (source / "assets" / "sample.bin").write_bytes(bytes(range(256)))
        return self.workspace.register_asset({"kind": "skill", "path": str(source)})

    def cart(self, asset):
        cart = self.workspace.create_cart({"task": {"description": "继续示例项目"}, "targetHint": {"harness": "unknown-new-harness"}})
        return self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"], "assetId": asset["id"]}, "add")

    def export(self, cart, request="example"):
        return self.workspace.export(cart["id"], {"expectedVersion": cart["version"], "requestId": request}, False)

    def assert_code(self, code, action):
        with self.assertRaises(WorkspaceError) as raised:
            action()
        self.assertEqual(raised.exception.code, code)

    def test_full_bundle_no_legacy_compatibility_calls_and_snapshot_survives_source_removal(self):
        asset = self.asset()
        cart = self.cart(asset)
        with patch("backend.core.preflight.PreflightChecker.check", side_effect=AssertionError("not allowed")):
            job = self.export(cart)
        self.assertEqual(job["status"], "complete", job)
        package = self.workspace.package(job["packageId"])
        relative = {f["path"] for f in package["manifest"]["files"]}
        self.assertTrue(any(p.endswith("scripts/run.py") for p in relative))
        self.assertTrue(any(p.endswith("assets/sample.bin") for p in relative))
        self.assertIn(str(Path(package["path"]) / "README.md"), package["prompt"])
        self.assertTrue(verify_package(self.workspace, package["id"])["valid"])
        Path(asset["source"]["path"]).rename(self.root / "moved")
        self.assertTrue(verify_package(self.workspace, package["id"])["valid"])
        self.assertEqual(package["receiptStatus"], "unknown")

    def test_non_frequent_selection_does_not_change_preferences_or_source(self):
        asset = self.asset()
        cart = self.cart(asset)
        duplicate = self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"], "assetId": asset["id"]}, "add")
        self.assertEqual(duplicate["version"], cart["version"])
        self.assertEqual(self.workspace.assets(frequent=True), [])
        removed = self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"]}, "remove", asset["id"])
        self.assertEqual(removed["items"], [])
        self.assertTrue(Path(asset["source"]["path"]).exists())
        self.assertFalse(self.workspace.preview(cart["id"])["canExport"])
        self.assert_code("EMPTY_CART", lambda: self.export(removed))

    def test_persistence_and_report_dedup_without_implicit_favorite(self):
        asset = self.asset()
        report = {"id": "report-1", "type": "recommendation", "source": "agent-a",
                  "assetIds": [asset["id"]], "evidence": "用户在当前任务中明确提及"}
        self.workspace.submit_report(report)
        other = Workspace(self.data)
        self.assertTrue(other.submit_report(report)["duplicate"])
        self.assertEqual(len(other.store.list("report")), 1)
        self.assertEqual(other.assets(frequent=True), [])
        self.assert_code("REQUEST_MISMATCH", lambda: other.submit_report({**report, "evidence": "changed"}))
        other.set_preference(asset["id"], {"frequent": True})
        self.assertEqual(len(self.workspace.assets(frequent=True)), 1)
        self.assertIn(asset["id"], (self.data / "COMMON_SKILLS.md").read_text(encoding="utf-8"))

    def test_cart_compare_and_swap_across_instances(self):
        one, two = self.asset("one"), self.asset("two")
        cart = self.workspace.create_cart({})
        other = Workspace(self.data)
        def add(workspace, asset):
            try:
                workspace.edit_cart(cart["id"], {"expectedVersion": 1, "assetId": asset["id"]}, "add")
                return "ok"
            except WorkspaceError as exc:
                return exc.code
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda pair: add(*pair), [(self.workspace, one), (other, two)]))
        self.assertCountEqual(results, ["ok", "VERSION_CONFLICT"])
        self.assertEqual(len(self.workspace.store.get("cart", cart["id"])["items"]), 1)

    def test_same_name_different_sources_not_merged(self):
        one, two = self.asset("one"), self.asset("two")
        self.assertNotEqual(one["id"], two["id"])
        self.assertEqual(len(self.workspace.assets()), 2)

    def test_source_change_requires_refresh_and_reselection(self):
        asset = self.asset()
        cart = self.cart(asset)
        (Path(asset["source"]["path"]) / "scripts" / "run.py").write_text("print('changed')", encoding="utf-8")
        preview = self.workspace.preview(cart["id"])
        self.assertEqual(preview["errors"][0]["code"], "SOURCE_CHANGED")
        failed = self.export(cart)
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(self.workspace.store.list("package"), [])
        updated = self.workspace.refresh_asset(asset["id"])
        self.assertNotEqual(updated["revisionId"], asset["revisionId"])
        cart = self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"], "assetId": asset["id"]}, "add")
        self.assertEqual(self.export(cart, "new-request")["status"], "complete")

    def test_export_request_idempotency_and_request_conflicts(self):
        cart = self.cart(self.asset())
        first = self.export(cart)
        second = self.export(cart)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.workspace.store.list("package")), 1)
        cart = self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"], "task": {"description": "change"}})
        self.assert_code("REQUEST_MISMATCH", lambda: self.export(cart))

    def test_missing_source_does_not_clear_cart_or_publish(self):
        asset = self.asset()
        cart = self.cart(asset)
        (Path(asset["source"]["path"]) / "SKILL.md").unlink()
        self.assertEqual(self.export(cart)["status"], "failed")
        self.assertEqual(len(self.workspace.store.get("cart", cart["id"])["items"]), 1)
        self.assertEqual(list((self.data / "handoffs").iterdir()), [])

    def test_inline_memory_and_rules_keep_scope_and_confirmation(self):
        asset = self.workspace.register_asset({"kind": "memory", "sourceKey": "project-notes",
                                              "title": "项目记忆", "content": "已选择蓝色主题。",
                                              "scope": {"type": "project", "projectId": "example"}})
        self.assertEqual(asset["confirmation"], "draft")
        confirmed = self.workspace.update_asset(asset["id"], {"expectedVersion": asset["version"], "confirmation": "confirmed"})
        self.assertEqual(confirmed["confirmation"], "confirmed")
        changed = self.workspace.register_asset({"kind": "memory", "sourceKey": "project-notes",
                                                "content": "已改为绿色主题。", "expectedVersion": confirmed["version"]})
        self.assertEqual(changed["confirmation"], "draft")
        self.workspace.update_asset(changed["id"], {"expectedVersion": changed["version"], "archived": True})
        self.assert_code("ASSET_ARCHIVED", lambda: self.workspace.submit_report({
            "id": "old-report", "type": "memory_draft", "source": "old-agent", "assetIds": [changed["id"]]}))

    def test_mcp_sanitization_persists_and_exports_without_credentials(self):
        secret = "private-value-for-local-env"
        config = {"mcpServers": {"demo": {"command": "node", "args": ["run.js", "--token", secret],
                                         "env": {"API_TOKEN": secret, "MODE": "prod"},
                                         "headers": {"Authorization": "Bearer " + secret},
                                         "url": "https://example.test/mcp?token=" + secret}}}
        asset = self.workspace.register_asset({"kind": "mcp", "content": config, "serverName": "demo", "sourceKey": "mcp-demo"})
        self.assertNotIn(secret, json.dumps(asset))
        self.assertTrue(asset["followUps"])
        job = self.export(self.cart(asset))
        self.assertEqual(job["status"], "complete", job)
        package = self.workspace.package(job["packageId"])
        for file in Path(package["path"]).rglob("*"):
            if file.is_file():
                self.assertNotIn(secret.encode(), file.read_bytes())
        self.assertNotIn(secret.encode(), (self.data / "profile.sqlite3").read_bytes())
        self.assertEqual(package["status"], "ready_with_followups")

    def test_mcp_multi_server_requires_explicit_selection(self):
        self.assert_code("MCP_SERVER_REQUIRED", lambda: self.workspace.register_asset({
            "kind": "mcp", "content": {"mcpServers": {"one": {}, "two": {}}}}))

    def test_system_assets_are_not_selected_but_unknown_sources_are(self):
        asset = self.asset()
        self.assertEqual(asset["ownership"], "unknown")
        system = self.workspace.register_asset({"kind": "skill", "path": asset["source"]["path"], "ownership": "system"})
        self.assertEqual(self.workspace.assets(), [])
        self.assertEqual(len(self.workspace.assets(include_system=True)), 1)
        self.assert_code("ASSET_UNAVAILABLE", lambda: self.cart(system))

    def test_credential_files_excluded_with_disclosure(self):
        asset = self.asset()
        source = Path(asset["source"]["path"])
        (source / ".env").write_text("TOKEN=local-only", encoding="utf-8")
        (source / "node_modules").mkdir()
        (source / "node_modules" / "library.js").write_text("ignored", encoding="utf-8")
        updated = self.workspace.refresh_asset(asset["id"])
        job = self.export(self.cart(updated))
        package = self.workspace.package(job["packageId"])
        names = [f["path"] for f in package["manifest"]["files"]]
        self.assertFalse(any(p.endswith(".env") or "node_modules" in p for p in names))
        self.assertEqual(len(package["manifest"]["omissions"]), 2)

    def test_selected_secret_content_blocks_without_echoing_value(self):
        token = "sk-" + "A" * 36
        self.assert_code("SENSITIVE_CONTENT", lambda: self.workspace.register_asset({"kind": "rule", "content": "key: " + token}))
        self.assertEqual(self.workspace.assets(), [])

    def test_receipt_requires_exported_items_and_keeps_reported_evidence(self):
        asset = self.asset()
        job = self.export(self.cart(asset))
        report = {"id": "receipt-1", "packageId": job["packageId"], "source": "agent-b",
                  "target": {"harness": "manual-target"},
                  "items": [{"assetId": asset["id"], "status": "read", "evidence": "Read README and Skill files."}]}
        receipt = self.workspace.receipt(report)
        self.assertEqual(receipt["verification"], "reported")
        self.assertTrue(self.workspace.receipt(report)["duplicate"])
        report["id"] = "receipt-2"
        report["items"][0]["assetId"] = "not-selected"
        self.assert_code("RECEIPT_ITEM_INVALID", lambda: self.workspace.receipt(report))

    def test_manifest_integrity_detects_changed_payload(self):
        job = self.export(self.cart(self.asset()))
        package = self.workspace.package(job["packageId"])
        path = Path(package["path"]) / package["manifest"]["files"][0]["path"]
        path.write_bytes(b"changed")
        result = verify_package(self.workspace, package["id"])
        self.assertFalse(result["valid"])
        self.assertFalse(result["runtimeVerified"])

    def test_existing_corrupt_profile_is_not_replaced(self):
        bad = self.root / "bad"
        bad.mkdir()
        database = bad / "profile.sqlite3"
        database.write_bytes(b"not-a-database")
        self.assert_code("PROFILE_UNREADABLE", lambda: Workspace(bad))
        self.assertEqual(database.read_bytes(), b"not-a-database")

    def test_newer_schema_is_rejected_and_data_unchanged(self):
        with closing(sqlite3.connect(self.data / "profile.sqlite3")) as db:
            db.execute("PRAGMA user_version=99")
        self.assert_code("PROFILE_VERSION_UNSUPPORTED", lambda: Workspace(self.data))
        with closing(sqlite3.connect(self.data / "profile.sqlite3")) as db:
            self.assertEqual(db.execute("PRAGMA user_version").fetchone()[0], 99)

    def test_explicit_invalid_home_never_falls_back(self):
        self.assert_code("DATA_HOME_INVALID", lambda: Workspace("relative"))
        with patch.dict(os.environ, {"SKILLBRIDGE_HOME": ""}):
            self.assert_code("DATA_HOME_INVALID", lambda: Workspace())

    def test_scan_reports_partial_failure_without_compatibility(self):
        self.asset()
        result = self.workspace.scan({"roots": [str(self.root / "demo"), str(self.root / "missing")]})
        self.assertEqual(result["scanned"], 1)
        self.assertEqual(len(result["errors"]), 1)

    def test_inline_update_preserves_scope_title_and_environment(self):
        original = self.workspace.register_asset({
            "kind": "memory", "content": "first", "title": "项目记忆",
            "scope": {"type": "project", "path": str(self.root)},
            "environment": {"harness": "source-agent"}})
        updated = self.workspace.register_asset({
            "kind": "memory", "content": "second", "sourceKey": original["source"]["sourceKey"],
            "expectedVersion": original["version"]})
        for field in ("id", "title", "scope", "environment", "ownership"):
            self.assertEqual(original[field], updated[field])
        self.assertNotEqual(original["revisionId"], updated["revisionId"])

    def test_frequent_preferences_can_be_scoped_to_each_agent(self):
        asset = self.asset()
        self.workspace.set_preference(asset["id"], {"frequent": True, "scope": "harness:codex:agent-a"})
        self.workspace.set_preference(asset["id"], {"frequent": False, "scope": "harness:claude:agent-b"})
        from backend.workspace.router import dispatch
        _, items = dispatch(self.workspace, "GET", "/api/v1/assets?frequent=true&preferenceScope=harness:codex:agent-a")
        self.assertEqual([i["id"] for i in items["items"]], [asset["id"]])
        _, items = dispatch(self.workspace, "GET", "/api/v1/assets?frequent=true&preferenceScope=harness:claude:agent-b")
        self.assertEqual(items["items"], [])
        self.assertEqual(len(self.cart(asset)["items"]), 1)

    def test_cart_retains_selected_metadata_and_inline_revision(self):
        original = self.workspace.register_asset({"kind": "memory", "content": "first", "sourceKey": "memory",
                                                  "title": "original", "scope": {"type": "project", "path": str(self.root)}})
        cart = self.cart(original)
        changed = self.workspace.register_asset({"kind": "memory", "content": "second", "sourceKey": "memory",
                                                 "title": "changed", "scope": {"type": "personal"}, "expectedVersion": 1})
        self.workspace.update_asset(changed["id"], {"expectedVersion": changed["version"], "confirmation": "confirmed"})
        job = self.export(cart)
        package = self.workspace.package(job["packageId"])
        selected = package["manifest"]["items"][0]
        self.assertEqual(selected["title"], "original")
        self.assertEqual(selected["confirmation"], "draft")
        self.assertEqual(selected["scope"]["type"], "project")
        payload = Path(package["path"]) / package["manifest"]["files"][0]["path"]
        self.assertEqual(payload.read_text(encoding="utf-8"), "first")

    def test_package_metadata_tamper_is_rejected_before_serving_prompt(self):
        job = self.export(self.cart(self.asset()))
        package = self.workspace.package(job["packageId"])
        path = Path(package["path"]) / "HANDOFF.md"
        path.write_text("changed prompt", encoding="utf-8")
        self.assert_code("PACKAGE_CHANGED", lambda: self.workspace.package(package["id"]))
        self.assertFalse(verify_package(self.workspace, package["id"])["valid"])

    def test_mcp_embedded_headers_and_command_credentials_are_not_saved(self):
        secret = "only-on-source-device"
        asset = self.workspace.register_asset({"kind": "mcp", "content": {
            "command": "node server.js --token " + secret,
            "args": ["--header", "Authorization: Bearer " + secret, "Cookie: session=" + secret, "--token " + secret],
            "credentials": {"value": secret}}})
        self.assertNotIn(secret, json.dumps(asset))
        self.assertNotIn(secret.encode(), (self.data / "profile.sqlite3").read_bytes())
        self.assertTrue(asset["followUps"])

    def test_all_five_asset_types_share_one_manifest_and_prompt(self):
        assets = [self.asset()]
        for kind, content in (("rule", "Use this project scope."), ("memory", "The next step is a review."),
                              ("mcp", {"command": "node", "args": ["server.js"]}),
                              ("ledger", {"taskType": "writing", "source": "user", "feedback": "Useful"})):
            assets.append(self.workspace.register_asset({"kind": kind, "content": content, "title": kind}))
        cart = self.workspace.create_cart({"project": {"path": str(self.root)}, "task": {"description": "Mixed handoff"}})
        for asset in assets:
            cart = self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"], "assetId": asset["id"]}, "add")
        job = self.export(cart)
        self.assertEqual(job["status"], "complete", job)
        package = self.workspace.package(job["packageId"])
        self.assertEqual({i["kind"] for i in package["manifest"]["items"]}, {"skill", "rule", "memory", "mcp", "ledger"})
        self.assertIn(str(self.root), package["prompt"])
        self.assertTrue(verify_package(self.workspace, package["id"])["valid"])

    def test_cart_change_during_copy_prevents_publishing_old_selection(self):
        cart = self.cart(self.asset())
        original = self.workspace.materialize_item
        changed = False
        def edit_once(item):
            nonlocal changed
            if not changed:
                changed = True
                self.workspace.edit_cart(cart["id"], {"expectedVersion": cart["version"]}, "clear")
            return original(item)
        with patch.object(self.workspace, "materialize_item", side_effect=edit_once):
            job = self.export(cart)
        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["error"]["code"], "VERSION_CONFLICT")
        self.assertEqual(self.workspace.store.list("package"), [])
        self.assertEqual(list((self.data / "handoffs").iterdir()), [])

    def test_interrupted_worker_becomes_explicit_failure(self):
        cart = self.cart(self.asset())
        with patch("backend.workspace.exporter.run_export"):
            job = self.export(cart)
        with self.workspace.store.transaction() as db:
            job["leaseUntil"] = 0
            self.workspace.store.put("export", job["id"], job, db)
        result = Workspace(self.data).export_status(job["id"])
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["error"]["code"], "EXPORT_INTERRUPTED")
        self.assertEqual(self.workspace.store.list("package"), [])


if __name__ == "__main__":
    unittest.main()
