"""Exercise the complete HTTP and CLI contract using isolated user profiles."""
from pathlib import Path
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

from backend.workspace.http import make_server

ROOT = Path(__file__).resolve().parents[1]


class WorkspaceTransportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name) / "profile"
        self.server = make_server(self.home, port=0)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = "http://127.0.0.1:" + str(self.server.server_address[1])

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(3)
        for worker in self.server.workspace._threads.values():
            worker.join(5)
        self.tmp.cleanup()

    def call(self, method, path, body=None, headers=None):
        payload = json.dumps(body or {}).encode() if method != "GET" else None
        request = urllib.request.Request(self.base + "/api/v1" + path, data=payload, method=method,
                                         headers=headers if headers is not None else {"Content-Type": "application/json"})
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            return response.status, json.loads(response.read().decode("utf-8"))

    def cli(self, *args, body=None):
        result = subprocess.run([sys.executable, "-B", str(ROOT / "backend" / "main.py"),
                                 "workspace", "--data-dir", str(self.home), *args],
                                input=json.dumps(body, ensure_ascii=False) if body is not None else None,
                                text=True, encoding="utf-8", capture_output=True, cwd=ROOT, timeout=15)
        return result

    def test_cli_and_http_share_cart_and_export(self):
        status, asset = self.call("POST", "/assets", {"kind": "memory", "content": "保留原来的主题与正文。", "title": "项目决定"})
        self.assertEqual(status, 201)
        module_result = subprocess.run(
            [sys.executable, "-B", "-m", "backend.workspace", "--data-dir", str(self.home),
             "request", "GET", "/api/v1/assets/" + asset["id"]],
            text=True, encoding="utf-8", capture_output=True, cwd=ROOT, timeout=15,
            env={**os.environ, "PYTHONIOENCODING": "ascii"})
        self.assertEqual(module_result.returncode, 0, module_result.stderr)
        self.assertEqual(json.loads(module_result.stdout)["title"], "项目决定")
        created = self.cli("request", "POST", "/api/v1/carts", "--input", "-", body={"task": {"description": "继续项目"}})
        self.assertEqual(created.returncode, 0, created.stderr)
        cart = json.loads(created.stdout)
        status, cart = self.call("POST", "/carts/" + cart["id"] + "/items",
                                 {"expectedVersion": cart["version"], "assetId": asset["id"]})
        self.assertEqual(status, 200)
        status, preview = self.call("POST", "/carts/" + cart["id"] + "/preview", {"expectedVersion": cart["version"]})
        self.assertTrue(preview["canExport"])
        status, job = self.call("POST", "/carts/" + cart["id"] + "/export",
                                {"expectedVersion": cart["version"], "requestId": "http-export"})
        self.assertEqual(status, 202)
        for _ in range(100):
            _, job = self.call("GET", "/exports/" + job["id"])
            if job["status"] != "running":
                break
            time.sleep(0.02)
        self.assertEqual(job["status"], "complete", job)
        prompt = self.cli("request", "GET", "/api/v1/packages/" + job["packageId"] + "/prompt")
        self.assertEqual(prompt.returncode, 0, prompt.stderr)
        self.assertIn("README.md", json.loads(prompt.stdout)["text"])
        _, verified = self.call("GET", "/packages/" + job["packageId"] + "/verify")
        self.assertTrue(verified["valid"])

    def test_write_origin_and_content_type_are_checked(self):
        status, error = self.call("POST", "/carts", {}, {"Content-Type": "application/json", "Origin": "https://unrelated.example"})
        self.assertEqual(status, 403)
        self.assertEqual(error["code"], "ORIGIN_NOT_ALLOWED")
        status, _ = self.call("POST", "/carts", {}, {"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        status, _ = self.call("POST", "/carts", {}, {"Content-Type": "application/json", "Origin": "http://localhost:5173"})
        self.assertEqual(status, 201)

    def test_malformed_json_and_validation_return_stable_errors(self):
        request = urllib.request.Request(self.base + "/api/v1/carts", data=b"{", method="POST",
                                         headers={"Content-Type": "application/json"})
        with self.assertRaises(urllib.error.HTTPError) as raised:
            urllib.request.urlopen(request, timeout=5)
        with raised.exception as response:
            self.assertEqual(response.code, 400)
            self.assertEqual(json.loads(response.read())["code"], "INVALID_JSON")
        status, body = self.call("POST", "/assets", {"kind": "unknown", "content": "x"})
        self.assertEqual(status, 400)
        self.assertEqual(body["code"], "ASSET_KIND_INVALID")

    def test_cli_failed_operation_returns_nonzero(self):
        result = self.cli("request", "GET", "/api/v1/assets/missing")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stderr)["code"], "NOT_FOUND")

    def test_export_cancellation_is_persistent_and_does_not_publish(self):
        _, asset = self.call("POST", "/assets", {"kind": "rule", "content": "Use the selected project."})
        _, cart = self.call("POST", "/carts", {})
        _, cart = self.call("POST", "/carts/" + cart["id"] + "/items",
                            {"expectedVersion": 1, "assetId": asset["id"]})
        entered, release = threading.Event(), threading.Event()
        original = self.server.workspace.materialize_item
        def held(item):
            entered.set()
            release.wait(5)
            return original(item)
        with patch.object(self.server.workspace, "materialize_item", side_effect=held):
            _, job = self.call("POST", "/carts/" + cart["id"] + "/export",
                               {"expectedVersion": cart["version"], "requestId": "cancel-export"})
            self.assertTrue(entered.wait(3))
            self.call("POST", "/exports/" + job["id"] + "/cancel", {})
            release.set()
            self.server.workspace._threads[job["id"]].join(5)
        _, result = self.call("GET", "/exports/" + job["id"])
        self.assertEqual(result["status"], "cancelled")
        self.assertEqual(self.server.workspace.store.list("package"), [])


if __name__ == "__main__":
    unittest.main()
