"""Synthetic native homes; no reads from the machine's Agent profiles."""
import hashlib
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.request
from unittest.mock import patch

from backend.workspace.router import dispatch
from backend.workspace.service import Workspace
from backend.workspace.http import make_server
from scripts.codex_inventory import register
from scripts.harness_inventory import LocalInventory, inventory, main


class HarnessInventoryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.user = self.root / 'user'
        self.project = self.root / 'project'
        self.project.mkdir()
        (self.project / '.git').mkdir()
        self.homes = {key: self.user / name for key, name in [('codex', '.codex'), ('claude', '.claude'), ('hermes', '.hermes'), ('pi', '.pi/agent')]}
        for home in self.homes.values():
            home.mkdir(parents=True)
        self.workspace = Workspace(self.root / 'profile')

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, path, content):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding='utf-8')
        return path

    def skill(self, root, name='same-name'):
        return self.write(root / 'SKILL.md', f'---\nname: {name}\ndescription: Helps with a synthetic task.\n---\n# Demo\n')

    def discover(self, key):
        return LocalInventory(key, self.homes[key], self.project, self.user).discover()

    def setup_all(self):
        for key, home in self.homes.items():
            self.skill(home / 'skills/example')
            self.write(home / 'skills/example/scripts/helper.py', 'print("synthetic")\n')
            self.write(home / 'skills/example/assets/data.txt', 'synthetic material')
        self.write(self.project / 'AGENTS.md', '# Shared project rules\n')
        self.write(self.homes['claude'] / 'projects/encoded-key/memory/a.md', '---\nname: 文章写作偏好\ndescription: 喜欢简短句子\n---\n# Notes\n')
        self.write(self.homes['hermes'] / 'memories/USER.md', '# 用户的表达偏好\n')
        self.write(self.homes['hermes'] / 'config.yaml', 'mcp_servers:\n  docs:\n    command: node\n    env:\n      API_KEY: fixture-private-value\n')
        self.write(self.homes['pi'] / 'mcp.json', json.dumps({'mcpServers': {'docs': {'url': 'https://example.invalid/mcp', 'headers': {'Authorization': '!never-execute-this'}}}}))
        self.write(self.user / '.claude.json', json.dumps({'mcpServers': {'docs': {'command': 'node'}}, 'oauthAccount': {'token': 'do-not-import-account-data'}}))
        skill = self.homes['codex'] / 'skills/example/SKILL.md'
        catalog = {'data': [{'skills': [{'path': str(skill), 'name': 'same-name', 'scope': 'user', 'enabled': True}], 'errors': []}]}
        return catalog

    def test_four_harnesses_sources_and_real_export(self):
        catalog = self.setup_all()
        before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.root.rglob('*') if p.is_file() and 'profile' not in p.parts}
        with patch('scripts.codex_inventory.codex_skills', return_value=catalog):
            requests, errors, results = inventory(self.homes, self.project, self.user)
        self.assertFalse(errors)
        self.assertEqual({r['harness'] for r in results}, {'Codex', 'Claude Code', 'Hermes', 'Pi'})
        rows, failures = register(self.workspace, requests)
        self.assertFalse(failures)
        self.assertEqual(len(self.workspace.assets('skill')), 4)  # Same names, distinct directories.
        shared = next(a for a in self.workspace.assets('rule') if a['source']['path'] == str(self.project / 'AGENTS.md'))
        self.assertEqual({r['harness'] for r in shared['environment']['sources']}, {'Codex', 'Hermes', 'Pi'})
        self.assertEqual(next(a for a in self.workspace.assets('memory') if a['environment']['harness'] == 'Claude Code')['environment']['presentation']['title'], '文章写作偏好')
        details = json.dumps([self.workspace.get_asset(a['id']) for a in self.workspace.assets()])
        for secret in ('fixture-private-value', 'do-not-import-account-data', '!never-execute-this'):
            self.assertNotIn(secret, details)
        register(self.workspace, [{'kind': 'ledger', 'sourceKey': 'fixture', 'content': {'source': 'synthetic'}, 'title': 'Fixture report'}])
        cart = self.workspace.create_cart({})
        for asset in self.workspace.assets():
            cart = dispatch(self.workspace, 'POST', f"/api/v1/carts/{cart['id']}/items", {'expectedVersion': cart['version'], 'assetId': asset['id']})[1]
        self.assertEqual({self.workspace.get_asset(i['assetId'])['kind'] for i in cart['items']}, {'skill', 'rule', 'memory', 'mcp', 'ledger'})
        preview = dispatch(self.workspace, 'POST', f"/api/v1/carts/{cart['id']}/preview", {})[1]
        self.assertTrue(preview['canExport'])
        job = self.workspace.export(cart['id'], {'expectedVersion': cart['version'], 'requestId': 'multi-harness-test'}, False)
        self.assertEqual(job['status'], 'complete')
        package = self.workspace.package(job['packageId'])
        pack_path = Path(package['path'])
        self.assertEqual(len(list(pack_path.rglob('helper.py'))), 4)
        self.assertEqual(len(list(pack_path.rglob('data.txt'))), 4)
        self.assertEqual(before, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in before})

    def test_refresh_single_harness_keeps_origins_cart_and_preferences(self):
        self.setup_all()
        rows, _ = self.discover('hermes')
        more, _ = self.discover('pi')
        register(self.workspace, rows + more)
        asset = next(a for a in self.workspace.assets('rule') if a['title'] == 'AGENTS.md')
        cart = self.workspace.create_cart({})
        cart = dispatch(self.workspace, 'POST', f"/api/v1/carts/{cart['id']}/items", {'expectedVersion': cart['version'], 'assetId': asset['id']})[1]
        preference = self.workspace.set_preference(asset['id'], {'scope': 'harness:pi:agent:local', 'frequent': True})
        register(self.workspace, more)
        again = self.workspace.get_asset(asset['id'])
        self.assertEqual({r['harness'] for r in again['environment']['sources']}, {'Hermes', 'Pi'})
        self.assertEqual(again['preferences'][0]['version'], preference['version'])
        self.assertEqual(dispatch(self.workspace, 'GET', f"/api/v1/carts/{cart['id']}")[1], cart)
        self.write(self.project / 'AGENTS.md', '# Changed\n')
        register(self.workspace, more)
        self.assertNotEqual(self.workspace.get_asset(asset['id'])['revisionId'], cart['items'][0]['revisionId'])
        preview = dispatch(self.workspace, 'POST', f"/api/v1/carts/{cart['id']}/preview", {})[1]
        self.assertTrue(any(e['code'] == 'SOURCE_CHANGED' for e in preview['errors']))

    def test_partial_invalid_configs_do_not_hide_other_resources(self):
        self.skill(self.homes['hermes'] / 'skills/ok')
        self.write(self.homes['hermes'] / 'config.yaml', 'mcp_servers: [malformed')
        requests, errors = self.discover('hermes')
        self.assertEqual(len(requests), 1)
        self.assertEqual(errors[0]['code'], 'CONFIG_UNREADABLE')
        with patch('scripts.codex_inventory.codex_skills', side_effect=RuntimeError('DO_NOT_LOG')):
            rows, errors, results = inventory(self.homes, self.project, self.user)
        self.assertTrue(rows)
        self.assertEqual(results[0]['status'], 'failed')
        self.assertNotIn('DO_NOT_LOG', json.dumps(errors))

    def test_external_skills_and_custom_memory_no_invented_pi_memories(self):
        shared = self.user / '.agents/skills/shared'
        self.skill(shared)
        memory = self.user / 'custom-memory'
        self.write(memory / 'MEMORY.md', '# 自定义记忆\n')
        self.write(self.homes['claude'] / 'settings.json', json.dumps({'autoMemoryDirectory': str(memory)}))
        self.write(self.homes['hermes'] / 'config.yaml', 'skills:\n  external_dirs: ["~/.agents/skills"]\n')
        requests, _ = self.discover('hermes')
        more, _ = self.discover('pi')
        register(self.workspace, requests + more)
        skills = self.workspace.assets('skill')
        self.assertEqual(len(skills), 1)
        self.assertEqual(len(skills[0]['environment']['sources']), 2)
        rows, errors = self.discover('claude')
        self.assertFalse(errors)
        self.assertEqual(rows[0]['title'], '自定义记忆')
        self.write(self.homes['pi'] / 'sessions/private.jsonl', '{"message":"not a memory"}')
        self.write(self.homes['pi'] / 'auth.json', '{"key":"never-read"}')
        rows, errors = self.discover('pi')
        self.assertFalse(any(r['kind'] == 'memory' for r in rows))

    def test_missing_home_and_dry_run_do_not_write_profile(self):
        missing = self.root / 'missing'
        rows, errors, results = inventory({'pi': missing}, self.project, self.user)
        self.assertEqual((rows, errors), ([], []))
        self.assertEqual(results[0]['status'], 'not_found')
        profile = self.root / 'dry-profile'
        with patch('builtins.print'):
            result = main(['--data-dir', str(profile), '--project', str(self.project), '--harness', 'pi', '--pi-home', str(missing), '--dry-run'])
        self.assertEqual(result, 0)
        self.assertFalse(profile.exists())

    def test_http_mixed_harness_draft_export_and_history(self):
        catalog = self.setup_all()
        with patch('scripts.codex_inventory.codex_skills', return_value=catalog):
            requests, _, _ = inventory(self.homes, self.project, self.user)
        register(self.workspace, requests)
        server = make_server(self.workspace.home, port=0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{server.server_address[1]}/api/v1'
        def call(method, route, body=None):
            request = urllib.request.Request(base + route, method=method,
                data=None if method == 'GET' else json.dumps(body or {}).encode(),
                headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request, timeout=5) as response:
                return json.loads(response.read())
        try:
            assets = call('GET', '/assets')['items']
            cart = call('POST', '/carts')
            for asset in [a for a in assets if a['kind'] == 'skill']:
                cart = call('POST', f"/carts/{cart['id']}/items", {'expectedVersion': cart['version'], 'assetId': asset['id']})
            self.assertEqual(len(cart['items']), 4)
            self.assertEqual(call('GET', f"/carts/{cart['id']}")['items'], cart['items'])
            job = call('POST', f"/carts/{cart['id']}/export", {'expectedVersion': cart['version'], 'requestId': 'mixed-http'})
            for _ in range(200):
                if job['status'] != 'running':
                    break
                time.sleep(0.02)
                job = call('GET', '/exports/' + job['id'])
            self.assertEqual(job['status'], 'complete')
            self.assertIn('README.md', call('GET', f"/packages/{job['packageId']}/prompt")['text'])
            self.assertTrue(call('GET', f"/packages/{job['packageId']}/verify")['valid'])
            self.assertEqual(len(call('GET', '/packages')['items']), 1)
            self.assertEqual(call('GET', '/receipts')['items'], [])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(3)

    def test_bundled_skills_hidden_and_certificate_password_redacted(self):
        self.skill(self.homes['hermes'] / 'skills/builtin')
        self.write(self.homes['hermes'] / 'skills/.bundled_manifest', 'builtin:' + 'a' * 32 + '\n')
        self.write(self.homes['hermes'] / 'config.yaml', 'mcp_servers:\n  secure:\n    url: https://example.invalid\n    client_cert: [client.crt, client.key, fixture-passphrase]\n')
        requests, errors = self.discover('hermes')
        self.assertFalse(errors)
        _, errors = register(self.workspace, requests)
        self.assertFalse(errors)
        self.assertFalse(self.workspace.assets('skill'))
        self.assertEqual(len(self.workspace.assets('skill', include_system=True)), 1)
        mcp = self.workspace.get_asset(self.workspace.assets('mcp')[0]['id'])
        self.assertNotIn('fixture-passphrase', json.dumps(mcp))


if __name__ == '__main__':
    unittest.main()
