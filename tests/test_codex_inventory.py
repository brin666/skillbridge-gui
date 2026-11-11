import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from backend.workspace.service import Workspace
from backend.workspace.router import dispatch
from scripts.codex_inventory import discover, register, save_report


class CodexInventoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.home = self.root / "codex"
        self.project = self.root / "project"
        self.home.mkdir()
        self.project.mkdir()
        self.workspace = Workspace(self.root / "profile")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def catalog(self, *paths):
        return {"data": [{"cwd": str(self.project), "errors": [], "skills": [
            {"path": str(p), "name": "same-name", "scope": "user", "enabled": True}
            for p in paths]}]}

    def test_inventory_and_repeat_preserve_sources_cart_and_preferences(self):
        one = self.write(self.home / "skills/a/SKILL.md", "# Skill A\n")
        two = self.write(self.home / "skills/b/SKILL.md", "# Skill B\n")
        self.write(one.parent / "scripts/helper.py", "print('fixture')\n")
        self.write(self.home / "memories_v2/memory_summary.md", "# Current memory\n")
        self.write(self.home / "memories/MEMORY.md", "# Older memory\n")
        self.write(self.home / "memories/.git/hidden.md", "not memory")
        self.write(self.home / "memories/skills/derived/SKILL.md", "not a memory asset")
        self.write(self.home / "AGENTS.md", "# Global rules\n")
        self.write(self.home / "rules/default.rules", "prefix_rule(pattern=['git'], decision='allow')")
        self.write(self.home / "config.toml", '[mcp_servers.docs]\ncommand="node"\n[mcp_servers.docs.env]\nAPI_KEY="fixture-private-value"\n')
        sources = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.home.rglob('*') if p.is_file()}
        requests, errors = discover(self.home, self.project, self.catalog(one, one, two))
        self.assertEqual(errors, [])
        rows, errors = register(self.workspace, requests)
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 7)
        skills = self.workspace.assets('skill')
        self.assertEqual(len(skills), 2)
        self.assertNotEqual(skills[0]['id'], skills[1]['id'])
        first = next(a for a in skills if a['source']['path'] == str(one.parent.resolve()))
        cart = self.workspace.create_cart({})
        cart = dispatch(self.workspace, 'POST', f"/api/v1/carts/{cart['id']}/items", {'expectedVersion': cart['version'], 'assetId': first['id']})[1]
        preference = self.workspace.set_preference(first['id'], {'scope':'harness:codex:agent:local','frequent':True})
        rows_again, errors = register(self.workspace, requests)
        self.assertEqual(errors, [])
        self.assertEqual({a['assetId'] for a in rows}, {a['assetId'] for a in rows_again})
        self.assertEqual(dispatch(self.workspace, 'GET', f"/api/v1/carts/{cart['id']}")[1]['version'], cart['version'])
        self.assertEqual(self.workspace.get_asset(first['id'])['preferences'][0]['version'], preference['version'])
        self.assertEqual(sources, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in sources})
        memory = self.workspace.assets('memory')
        self.assertEqual(len(memory), 2)
        self.assertTrue(all(a['confirmation'] == 'draft' for a in memory))
        self.write(one, '# Skill A changed\n')
        register(self.workspace, requests)
        self.assertEqual(dispatch(self.workspace, 'GET', f"/api/v1/carts/{cart['id']}")[1]['items'][0]['revisionId'], first['revisionId'])

    def test_codex_and_plugin_headers_are_sanitized_and_disabled_is_visible(self):
        config = '''[mcp_servers.private]
url = "https://example.invalid/api?key=fixture-query-secret"
enabled = false
[mcp_servers.private.http_headers]
X-Custom = "fixture-header-secret"
[mcp_servers.private.env_http_headers]
Authorization = "LOCAL_CREDENTIAL"
'''
        self.write(self.home / 'config.toml', config)
        plugin = self.home / 'plugins/cache/test/1'
        document = self.write(plugin / 'skills/tool/SKILL.md', '# Tool')
        self.write(plugin / '.codex-plugin/plugin.json', json.dumps({'mcpServers':'./.mcp.json'}))
        self.write(plugin / '.mcp.json', json.dumps({'mcpServers':{'plugin-tool':{'http_headers':{'X-Vendor':'plugin-header-secret'},'url':'https://example.invalid/mcp'}}}))
        catalog = self.catalog(document)
        catalog['data'][0]['skills'][0]['pluginId'] = 'tool@fixture'
        requests, errors = discover(self.home, self.project, catalog)
        self.assertEqual(errors, [])
        rows, errors = register(self.workspace, requests)
        self.assertEqual(errors, [])
        servers = self.workspace.assets('mcp')
        self.assertEqual(len(servers), 2)
        rendered = json.dumps([self.workspace.get_asset(a['id']) for a in servers])
        for secret in ['fixture-header-secret','fixture-query-secret','plugin-header-secret']:
            self.assertNotIn(secret, rendered)
        self.assertIn('${LOCAL_CREDENTIAL}', rendered)
        self.assertTrue(all(a['followUps'] for a in servers))
        self.assertTrue(any('已禁用' in a['title'] for a in servers))

    def test_partial_failure_does_not_import_secret_or_hide_valid_asset(self):
        secret = self.write(self.home / 'memories_v2/unsafe.md', 'sk-' + 'q' * 32)
        safe = self.write(self.home / 'memories_v2/safe.md', '# Safe memory')
        requests, errors = discover(self.home, self.project, self.catalog())
        rows, errors = register(self.workspace, requests)
        self.assertEqual(len(rows), 1)
        self.assertEqual(errors[0]['code'], 'SENSITIVE_CONTENT')
        self.assertEqual(self.workspace.assets()[0]['source']['path'], str(safe.resolve()))
        self.assertEqual(secret.read_text(), 'sk-' + 'q' * 32)

    def test_project_memory_and_report_are_readable_without_duplicate_records(self):
        self.write(self.home / 'memories_v2/rollout_summaries/project.md', 'thread_id: fixture\ncwd: D:/old-project\n\n# Summary')
        requests, _ = discover(self.home, self.project, self.catalog())
        self.assertEqual(requests[0]['scope'], {'type':'project','path':'D:/old-project'})
        report = {'codexHome':str(self.home),'project':str(self.project),'errors':[{'code':'FILE_TOO_LARGE'}]}
        save_report(self.workspace, report)
        save_report(self.workspace, report)
        records = self.workspace.assets('ledger')
        self.assertEqual(len(records), 1)
        self.assertEqual(json.loads(self.workspace.get_asset(records[0]['id'])['source']['content']), report)


if __name__ == '__main__':
    unittest.main()
