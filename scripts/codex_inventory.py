"""Import Codex's observed local inventory through the existing workspace contract.

No model turn, MCP startup, credential lookup, source write, or automatic selection.
Python 3.11+ is required for Codex's TOML configuration.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import json
import os
from pathlib import Path, PureWindowsPath, PurePosixPath
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import tomllib

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.workspace.errors import WorkspaceError
from backend.workspace.router import dispatch
from backend.workspace.service import Workspace
from scripts.catalog_presentation import enrich_requests


def canonical(path):
    return str(Path(path).expanduser().resolve())


def codex_skills(project, codex_home, executable=None):
    """Ask the installed CLI for its actual per-project skill catalog, not cache guesses."""
    executable = executable or shutil.which("codex") or shutil.which("codex.cmd")
    if not executable:
        raise RuntimeError("CODEX_NOT_FOUND")
    process = subprocess.Popen(
        [executable, "app-server", "--stdio"], cwd=project,
        env={**os.environ, "CODEX_HOME": str(codex_home)},
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        text=True, encoding="utf-8",
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    responses = queue.Queue()

    def read():
        for line in process.stdout:
            try:
                responses.put(json.loads(line))
            except ValueError:
                continue
        responses.put(None)

    threading.Thread(target=read, daemon=True).start()

    def request(number, method, params):
        process.stdin.write(json.dumps({"id": number, "method": method, "params": params}) + "\n")
        process.stdin.flush()
        deadline = time.monotonic() + 45
        while True:
            try:
                message = responses.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty:
                raise RuntimeError("CODEX_CATALOG_TIMEOUT") from None
            if message is None:
                raise RuntimeError("CODEX_CATALOG_CLOSED")
            if message.get("id") == number:
                if "error" in message:
                    # Do not log arbitrary server messages that could contain local values.
                    raise RuntimeError("CODEX_CATALOG_ERROR")
                return message["result"]

    try:
        request(1, "initialize", {"clientInfo": {"name": "skillbridge_inventory", "version": "1.0.0"},
                                 "capabilities": {"explicitGatewayOauth": True}})
        process.stdin.write(json.dumps({"method": "initialized", "params": {}}) + "\n")
        process.stdin.flush()
        return request(2, "skills/list", {"cwds": [str(project)], "forceReload": True})
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.terminate()  # Only the child created above, never an existing Codex process.
            process.wait(timeout=5)
        process.stdout.close()


def mcp_projection(server):
    """Use the workspace JSON header field so its credential sanitizer covers Codex headers."""
    result = json.loads(json.dumps(server))
    headers = result.pop("http_headers", {})
    env_headers = result.pop("env_http_headers", {})
    if not isinstance(headers, dict) or not isinstance(env_headers, dict):
        raise ValueError("MCP_HEADERS_INVALID")
    headers = {**result.get("headers", {}), **headers}
    for key, variable in env_headers.items():
        if not isinstance(variable, str):
            raise ValueError("MCP_HEADER_REFERENCE_INVALID")
        # Preserve the variable reference; never read its environment value.
        headers[key] = "${" + variable + "}"
    if headers:
        result["headers"] = headers
    return result


def memory_scope(file):
    # Rollout summaries retain their original project even if that project moved or was deleted.
    try:
        with file.open(encoding="utf-8-sig") as stream:
            prefix = stream.read(8192)
        for line in prefix.splitlines()[:20]:
            match = re.fullmatch(r"cwd:\s*(.+)", line)
            if match:
                path = match[1].strip().strip('`"')
                if PureWindowsPath(path).is_absolute() or PurePosixPath(path).is_absolute():
                    return {"type": "project", "path": path}
    except (OSError, UnicodeError):
        pass  # Registration will expose unreadable sources through the workspace contract.
    return {"type": "personal"}


def discover(codex_home, project, catalog):
    home, project = Path(canonical(codex_home)), Path(canonical(project))
    env = {"harness": "Codex", "agent": "local", "codexHome": str(home)}
    requests, errors, seen = [], [], set()

    def add_file(kind, path, title, scope=None, **metadata):
        path = Path(canonical(path))
        key = (kind, os.path.normcase(str(path)))
        if key in seen:
            return
        seen.add(key)
        requests.append({"kind": kind, "path": str(path), "title": title[:500],
                         "ownership": metadata.pop("ownership", "user"),
                         "scope": scope or {"type": "personal"},
                         "environment": {**env, **metadata}})

    skills = []
    for group in catalog.get("data", []):
        skills.extend(group.get("skills", []))
        errors.extend({"path": x.get("path", ""), "code": "CODEX_SKILL_LOAD_ERROR"}
                      for x in group.get("errors", []))
    plugin_roots = {}
    for skill in skills:
        folder = Path(skill["path"]).parent
        scope = {"type": "project", "path": str(project)} if skill["scope"] == "repo" else {"type": "personal"}
        add_file("skill", folder, skill["name"] + (" · 已禁用" if not skill["enabled"] else ""), scope,
                 ownership="system" if skill["scope"] == "system" else "user",
                 enabled=skill["enabled"], discovery="codex skills/list", pluginId=skill.get("pluginId"))
        if skill.get("pluginId"):
            for parent in folder.parents:
                if (parent / ".codex-plugin" / "plugin.json").is_file():
                    plugin_roots[str(parent)] = skill["pluginId"]
                    break

    # Keep old and current memory stores distinct. No raw conversations or databases.
    for name in ("memories", "memories_v2"):
        memory_root = home / name
        if not memory_root.is_dir():
            continue
        for file in sorted(memory_root.rglob("*.md")):
            parts = file.relative_to(memory_root).parts
            if "skills" in parts or any(p.startswith(".") for p in parts):
                continue
            if file.is_symlink():
                errors.append({"path": str(file), "code": "MEMORY_LINK_SKIPPED"})
                continue
            title = f"{name} · {file.stem}"
            add_file("memory", file, title, memory_scope(file), memoryStore=name)

    for filename in ("AGENTS.md", "AGENTS.override.md"):
        if (home / filename).is_file():
            add_file("rule", home / filename, "Codex 全局约定 · " + filename)
    if (home / "rules").is_dir():
        for file in sorted((home / "rules").glob("*.rules")):
            add_file("rule", file, "Codex 命令规则 · " + file.name,
                     {"type": "environment", "harness": "Codex"})
    for parent in [*reversed(project.parents), project]:
        for filename in ("AGENTS.md", "AGENTS.override.md"):
            if (parent / filename).is_file():
                add_file("rule", parent / filename, f"项目约定 · {parent.name} · {filename}",
                         {"type": "project", "path": str(parent)})

    def add_mcp(name, server, config_path, scope, plugin_id=None):
        try:
            if not isinstance(server, dict):
                raise ValueError("MCP_OBJECT_REQUIRED")
            projection = mcp_projection(server)
        except (TypeError, ValueError):
            errors.append({"path": str(config_path), "serverName": name, "code": "MCP_CONFIG_INVALID"})
            return
        requests.append({"kind": "mcp", "sourceKey": f"codex:{canonical(config_path)}#mcp:{name}",
                         "serverName": name, "title": name + (" · 已禁用" if server.get("enabled") is False else ""),
                         "content": {"mcpServers": {name: projection}}, "ownership": "user", "scope": scope,
                         "environment": {**env, "configPath": canonical(config_path), "pluginId": plugin_id,
                                         "enabled": server.get("enabled", True), "runtimeVerified": False}})

    configs = [(home / "config.toml", {"type": "personal"}),
               (project / ".codex" / "config.toml", {"type": "project", "path": str(project)})]
    for file, scope in configs:
        if not file.is_file():
            continue
        try:
            config = tomllib.loads(file.read_text(encoding="utf-8-sig"))
            for name, server in config.get("mcp_servers", {}).items():
                add_mcp(name, server, file, scope)
        except (OSError, ValueError, AttributeError):
            errors.append({"path": str(file), "code": "CODEX_CONFIG_UNREADABLE"})

    for root, plugin_id in sorted(plugin_roots.items()):
        root = Path(root)
        manifest_file = root / ".codex-plugin" / "plugin.json"
        try:
            manifest = json.loads(manifest_file.read_text(encoding="utf-8-sig"))
            mcp = manifest.get("mcpServers")
            if mcp is None:
                continue
            source = manifest_file
            if isinstance(mcp, str):
                source = (root / mcp).resolve()
                if not source.is_relative_to(root.resolve()):
                    raise ValueError("MCP_PATH_OUTSIDE_PLUGIN")
                mcp = json.loads(source.read_text(encoding="utf-8-sig"))
            for name, server in mcp.get("mcpServers", mcp).items():
                add_mcp(name, server, source, {"type": "environment", "harness": "Codex"}, plugin_id)
        except (OSError, ValueError, AttributeError):
            errors.append({"path": str(manifest_file), "code": "PLUGIN_MCP_UNREADABLE"})
    errors.extend(enrich_requests(requests, home, catalog))
    return requests, errors


def register(workspace, requests):
    """One API contract, including sanitization, fingerprints, IDs and optimistic versions."""
    existing = dispatch(workspace, "GET", "/api/v1/assets?includeSystem=true&includeArchived=true")[1]["items"]
    inline = {(a["kind"], a["source"].get("sourceKey"), a["source"].get("serverName")): a
              for a in existing if a["source"]["type"] == "inline"}
    registered, errors = [], []
    for body in requests:
        body = dict(body)
        if "content" in body:
            previous = inline.get((body["kind"], body.get("sourceKey"), body.get("serverName")))
            if previous:
                body["expectedVersion"] = previous["version"]
        try:
            asset = dispatch(workspace, "POST", "/api/v1/assets", body)[1]
            registered.append({"assetId": asset["id"], "kind": asset["kind"], "title": asset["title"],
                               "ownership": asset["ownership"], "source": body.get("path", body.get("sourceKey")),
                               "omissions": len(asset["omissions"]), "followUps": len(asset["followUps"])})
        except (WorkspaceError, OSError) as exc:
            errors.append({"kind": body["kind"], "path": body.get("path", body.get("sourceKey")),
                           "code": getattr(exc, "code", "SOURCE_UNREADABLE")})
    return registered, errors


def save_report(workspace, report):
    report_path = workspace.home / "codex-inventory.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Inline JSON lets the existing detail panel show actual counts and partial failures.
    # The same report remains available on disk for CLI inspection.
    _, failures = register(workspace, [{"kind": "ledger", "content": report,
        "sourceKey": "codex-inventory:" + report["codexHome"] + ":" + report["project"],
        "title": "Codex 资料整理记录", "ownership": "user",
        "environment": {"harness": "Codex", "agent": "local"},
        "scope": {"type": "environment", "harness": "Codex"}}])
    if failures:
        raise RuntimeError("INVENTORY_REPORT_REGISTRATION_FAILED")
    return report_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--codex-home", type=Path, default=Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex"))
    parser.add_argument("--project", type=Path, default=ROOT)
    parser.add_argument("--codex", help="Path to the installed Codex CLI")
    parser.add_argument("--dry-run", action="store_true", help="Discover only; do not create or update a SkillBridge profile")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    profile_written = False
    try:
        if not args.data_dir.is_absolute() or not args.codex_home.is_dir() or not args.project.is_dir():
            raise RuntimeError("INVENTORY_PATH_INVALID")
        catalog = codex_skills(args.project, args.codex_home, args.codex)
        requests, errors = discover(args.codex_home, args.project, catalog)
        counts = dict(Counter(b["kind"] for b in requests))
        if args.dry_run:
            print(json.dumps({"discovered": counts, "errors": errors, "profileWritten": False}, ensure_ascii=False, indent=2))
            return 2 if errors else 0
        workspace = Workspace(args.data_dir)
        profile_written = True
        registered, failures = register(workspace, requests)
        report = {"source": "Codex local inventory", "observedAt": datetime.now(timezone.utc).isoformat(),
                  "codexHome": canonical(args.codex_home), "project": canonical(args.project),
                  "dataHome": str(workspace.home), "discovered": counts,
                  "registered": dict(Counter(a["kind"] for a in registered)),
                  "systemSkillsHidden": sum(a["ownership"] == "system" for a in registered),
                  "errors": errors + failures, "items": registered,
                  "coverage": ["skills/list for this CLI and project", "global/project local MCP configuration",
                               "MCP manifests of plugins reported by skills/list", "memories and memories_v2 Markdown",
                               "global and ancestor-project AGENTS files; global command rules"],
                  "limits": ["No raw conversations, auth stores, or cloud-only connector inventory; only memory-linked thread names are queried read-only",
                             "No MCP startup, connection test, usage-frequency inference, or runtime verification",
                             "Previously registered records are retained; missing sources are checked on preview",
                             "Memory and rule files remain drafts; system Skills remain excluded from selection"],
                  "runtimeVerified": False}
        report_path = save_report(workspace, report)
        print(json.dumps({k: v for k, v in report.items() if k != "items"}, ensure_ascii=False, indent=2))
        print(json.dumps({"reportPath": str(report_path)}, ensure_ascii=False))
        return 2 if report["errors"] else 0
    except (RuntimeError, OSError, WorkspaceError) as exc:
        code = getattr(exc, "code", str(exc) if isinstance(exc, RuntimeError) else "INVENTORY_READ_FAILED")
        print(json.dumps({"code": code, "profileWritten": profile_written}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
