"""Read local Codex, Claude Code, Hermes and Pi resources into one workspace.

No model turns, extension execution, MCP connections or writes to source homes.
Native files are inventory candidates, not proof of activation in a session.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.skill_files import iter_skill_md_files
from backend.workspace.files import linked
from backend.workspace.service import Workspace
from scripts import codex_inventory
from scripts.catalog_presentation import LABELS, description_hash

NAMES = {"codex": "Codex", "claude": "Claude Code", "hermes": "Hermes", "pi": "Pi"}
MAX_CONFIG_BYTES = 2 * 1024 * 1024
LIMITS = ["只盘点本地文件，不代表会话已加载或 MCP 可连接。",
          "不读取原始聊天、凭据库、云端资料或执行插件；不修改源文件。",
          "保留先前登记及来源关系；失效来源在交接预览时核对，不自动移除。",
          "Pi 扩展记忆、未列出的插件及受管配置需通过 GUI 明确登记。"]
ERROR_MESSAGES = {
    "SOURCE_LINK_SKIPPED": "来源是目录链接；请在整理与登记中明确填写真实目录。",
    "SOURCE_METADATA_UNREADABLE": "无法读取标题或简介，请检查文件编码、权限和大小。",
    "FRONTMATTER_INVALID": "文档头格式不规范，已使用原文件名或标题，未改动正文。",
    "CONFIG_UNREADABLE": "配置无法解析，请检查格式和权限后重新整理。",
    "YAML_DEPENDENCY_MISSING": "请安装 scripts/requirements-inventory.txt 中的依赖后重试。",
    "RESOURCE_PATH_REQUIRES_EXPLICIT_LOCATION": "配置路径含变量或匹配表达式，请明确填写实际目录。",
    "FILE_TOO_LARGE": "目录中的单个文件超过后端 32 MiB 限制，本次未登记；源文件未修改。",
    "SENSITIVE_CONTENT": "后端发现疑似敏感内容，本次未登记；源文件未修改。",
    "HARNESS_DISCOVERY_FAILED": "该应用整理失败，其他来源继续处理；请检查目录和 CLI。",
}


def project_roots(project):
    """Only the requested project and its ancestors, bounded by a repository root."""
    result = []
    for folder in [project, *project.parents]:
        result.append(folder)
        if (folder / ".git").exists():
            break
    return result


class LocalInventory:
    def __init__(self, key, home, project, user_home=None):
        self.key, self.name = key, NAMES[key]
        self.home, self.project = Path(home).resolve(), Path(project).resolve()
        self.user_home = Path(user_home or Path.home()).resolve()
        self.env = {"harness": self.name, "agent": "local", "home": str(self.home),
                    "discovery": "local files", "runtimeVerified": False}
        self.requests, self.errors, self.seen = [], [], set()
        self.labels = json.loads(LABELS.read_text(encoding="utf-8"))
        self.personal = {"type": "personal"}

    def error(self, path, code):
        self.errors.append({"harness": self.name, "path": str(path), "code": code,
                            "message": ERROR_MESSAGES.get(code, "此来源未能完整整理，请核对位置或通过 GUI 明确登记。")})

    def text(self, path):
        if linked(path):
            raise ValueError("LINK_SKIPPED")
        if path.stat().st_size > MAX_CONFIG_BYTES:
            raise ValueError("CONFIG_TOO_LARGE")
        return path.read_text(encoding="utf-8-sig")

    def config(self, path, yaml=False):
        if not path.is_file():
            return {}
        try:
            value = self.text(path)
            if yaml:
                try:
                    import yaml as yaml_module
                except ImportError:
                    self.error(path, "YAML_DEPENDENCY_MISSING")
                    return {}
                try:
                    value = yaml_module.safe_load(value)
                except yaml_module.YAMLError:
                    raise ValueError("CONFIG_INVALID") from None
            else:
                value = json.loads(value)
            if not isinstance(value, dict):
                raise ValueError("CONFIG_INVALID")
            return value
        except (OSError, ValueError, UnicodeError, RecursionError):
            self.error(path, "CONFIG_UNREADABLE")
            return {}

    def metadata(self, file):
        text = self.text(file)
        meta = {}
        if text.startswith("---\n"):
            header, separator, _ = text[4:].partition("\n---")
            if separator:
                import yaml
                try:
                    value = yaml.safe_load(header)
                    meta = value if isinstance(value, dict) else {}
                except yaml.YAMLError:
                    self.error(file, "FRONTMATTER_INVALID")
        heading = re.search(r"^#\s+(.+)$", text, re.M)
        return meta, heading[1].strip() if heading else "", hashlib.sha256(file.read_bytes()).hexdigest()

    def file(self, kind, path, scope, title=None, ownership="user"):
        if not path.is_file() and kind != "skill":
            return
        if linked(path):
            self.error(path, "SOURCE_LINK_SKIPPED")
            return
        canonical = path.resolve()
        identity = (kind, os.path.normcase(str(canonical)))
        if identity in self.seen:
            return
        self.seen.add(identity)
        body = {"kind": kind, "path": str(canonical), "scope": scope, "ownership": ownership,
                "title": title or path.name, "environment": dict(self.env)}
        try:
            if kind in {"skill", "memory"}:
                source = path / "SKILL.md" if kind == "skill" else path
                meta, heading, fingerprint = self.metadata(source)
                presentation = {"schemaVersion": 1, "sourceFile": source.name, "sourceSha256": fingerprint,
                                "locationLabel": self.name + (" 技能" if kind == "skill" else " 记忆")}
                if kind == "skill":
                    name = str(meta.get("name") or path.name)[:500]
                    description = str(meta.get("description") or heading)[:4000]
                    label = self.labels.get(name, {})
                    translated = description_hash(name, description) in label.get("sourceHashes", [])
                    presentation.update(title=label["titleZh"] if translated else name, originalName=name,
                        summary=label["summaryZh"] if translated else description, originalDescription=description,
                        titleSource="中文释义" if translated else "Skill 原名",
                        translation="中文简介" if translated else "尚未准备中文简介")
                    body["title"] = name
                else:
                    friendly = {"MEMORY.md": self.name + " 记忆概览", "USER.md": "用户偏好与个人资料"}
                    name = str(meta.get("name") or heading or friendly.get(path.name) or title or path.stem)[:500]
                    presentation.update(title=name, titleSource="记忆文档标题",
                                        summary=str(meta.get("description") or heading)[:4000])
                    body["title"] = name
                body["environment"]["presentation"] = presentation
            self.requests.append(body)
        except (OSError, ValueError, UnicodeError, RecursionError):
            self.error(path, "SOURCE_METADATA_UNREADABLE")

    def markdown(self, root, kind, scope):
        if not root.is_dir():
            return
        if linked(root):
            self.error(root, "LINK_SKIPPED")
            return
        count = 0
        def onerror(exc):
            self.error(exc.filename or root, "SOURCE_UNREADABLE")
        for folder, dirs, files in os.walk(root, followlinks=False, onerror=onerror):
            count += 1
            if count > 4000:
                self.error(root, "DISCOVERY_LIMIT")
                break
            dirs[:] = sorted(d for d in dirs if not d.startswith(".") and d not in {"node_modules", "skills"}
                             and not linked(Path(folder) / d)) if len(Path(folder).relative_to(root).parts) < 8 else []
            for name in sorted(files):
                if name.lower().endswith(".md"):
                    self.file(kind, Path(folder) / name, scope)

    def skills(self, root, scope, bundled=()):
        if root.exists() and linked(root):
            self.error(root, "SOURCE_LINK_SKIPPED")
            return
        for file in iter_skill_md_files(root):
            # The workspace exports full directories, never a fabricated Skill wrapper.
            if file.name != "SKILL.md":
                self.error(file, "CANONICAL_SKILL_DOCUMENT_REQUIRED")
                continue
            relative = file.parent.relative_to(root) if root.is_dir() else Path(file.parent.name)
            self.file("skill", file.parent, scope, ownership="system" if relative.as_posix() in bundled else "user")

    def bundled_names(self):
        path = self.home / "skills/.bundled_manifest"
        if not path.is_file():
            return set()
        try:
            text = self.text(path)
            if text.lstrip().startswith("{"):
                data = json.loads(text)
                return set(data) if isinstance(data, dict) else set()
            names = set()
            for line in text.splitlines():
                if not line.strip():
                    continue
                match = re.fullmatch(r"(.+):[a-fA-F0-9]{32,64}", line.strip())
                if not match:
                    raise ValueError("BUNDLED_MANIFEST_INVALID")
                names.add(match[1])
            return names
        except (OSError, ValueError, UnicodeError):
            self.error(path, "BUNDLED_MANIFEST_UNREADABLE")
            return set()

    def configured_path(self, value, base):
        if not isinstance(value, str) or not value:
            return None
        # Do not expand environment values or execute !commands while discovering paths.
        if "${" in value or value.startswith("!") or any(c in value for c in "*?[]"):
            self.error(base, "RESOURCE_PATH_REQUIRES_EXPLICIT_LOCATION")
            return None
        path = self.user_home / value[2:] if value.startswith("~/") else Path(value)
        return (base / path).resolve() if not path.is_absolute() else path.resolve()

    def mcp(self, config, path, scope, pointer="mcpServers", disabled=()):
        servers = config.get(pointer, {})
        if not isinstance(servers, dict):
            self.error(path, "MCP_CONFIG_INVALID")
            return
        for name, server in servers.items():
            if not isinstance(name, str) or not name or not isinstance(server, dict):
                self.error(path, "MCP_CONFIG_INVALID")
                continue
            try:
                server = json.loads(json.dumps(server, allow_nan=False))
                # Hermes' optional third certificate tuple member is a password.
                # Give it a named field so the existing workspace sanitizer handles it.
                cert = server.get("client_cert")
                if isinstance(cert, list) and len(cert) > 2:
                    server["client_key_password"] = cert[2:]
                    server["client_cert"] = cert[:2]
            except (TypeError, ValueError, RecursionError):
                self.error(path, "MCP_CONFIG_INVALID")
                continue
            enabled = server.get("enabled", True) is not False and name not in disabled
            self.requests.append({"kind": "mcp", "sourceKey": f"{self.key}:{path.resolve()}:{scope.get('path', '')}#{pointer}:{name}",
                "serverName": name, "title": name + (" · 已禁用" if not enabled else ""),
                "content": {"mcpServers": {name: server}}, "ownership": "user", "scope": scope,
                "environment": {**self.env, "configPath": str(path.resolve()), "enabled": enabled}})

    def claude(self):
        self.skills(self.home / "skills", self.personal)
        self.file("rule", self.home / "CLAUDE.md", self.personal, "Claude Code 全局约定")
        self.markdown(self.home / "rules", "rule", self.personal)
        for parent in project_roots(self.project):
            scope = {"type": "project", "path": str(parent)}
            self.skills(parent / ".claude/skills", scope)
            self.markdown(parent / ".claude/rules", "rule", scope)
            for name in ("CLAUDE.md", "CLAUDE.local.md", ".claude/CLAUDE.md"):
                self.file("rule", parent / name, scope)
        projects = self.home / "projects"
        if projects.is_dir():
            # Do not reverse-engineer an encoded folder into a guessed project path.
            for folder in sorted(projects.iterdir()):
                if folder.is_dir() and not linked(folder):
                    self.markdown(folder / "memory", "memory", {"type": "environment", "harness": self.name, "projectKey": folder.name})
        for path, scope in [(self.home / "settings.json", self.personal),
                            (self.project / ".claude/settings.json", {"type": "project", "path": str(self.project)}),
                            (self.project / ".claude/settings.local.json", {"type": "project", "path": str(self.project)})]:
            settings = self.config(path)
            if settings.get("autoMemoryDirectory"):
                memory = self.configured_path(settings["autoMemoryDirectory"], self.home)
                if memory:
                    self.markdown(memory, "memory", scope)
        # A custom CLAUDE_CONFIG_DIR uses .claude.json inside that directory.
        user_config = self.user_home / ".claude.json" if self.home == self.user_home / ".claude" else self.home / ".claude.json"
        config = self.config(user_config)
        project_map = config.get("projects", {})
        project_config = project_map.get(str(self.project), project_map.get(self.project.as_posix(), {})) if isinstance(project_map, dict) else {}
        if not isinstance(project_config, dict):
            project_config = {}
        disabled = project_config.get("disabledMcpServers", [])
        disabled = disabled if isinstance(disabled, list) else []
        self.mcp(config, user_config, self.personal, disabled=disabled)
        scope = {"type": "project", "path": str(self.project)}
        self.mcp(project_config, user_config, scope, disabled=disabled)
        mcp_path = self.project / ".mcp.json"
        self.mcp(self.config(mcp_path), mcp_path, scope,
                 disabled=project_config.get("disabledMcpjsonServers", []) or [])

    def hermes(self):
        config_path = self.home / "config.yaml"
        config = self.config(config_path, yaml=True)
        bundled = self.bundled_names()
        self.skills(self.home / "skills", self.personal, bundled=bundled)
        settings = config.get("skills", {})
        settings = settings if isinstance(settings, dict) else {}
        extra = settings.get("external_dirs", [])
        extra = extra if isinstance(extra, list) else []
        for value in [*extra, settings.get("create_dir")]:
            path = self.configured_path(value, self.home)
            if path:
                self.skills(path, self.personal)
        self.markdown(self.home / "memories", "memory", self.personal)
        self.file("rule", self.home / "SOUL.md", self.personal, "Hermes 身份与约定")
        parents = project_roots(self.project)
        repo = parents[-1] if (parents[-1] / ".git").exists() else self.project
        scope = {"type": "project", "path": str(repo)}
        if settings.get("project_discovery") is not False:
            for folder in (".hermes/skills", ".agents/skills"):
                self.skills(repo / folder, scope)
        for parent in parents:
            for name in (".hermes.md", "HERMES.md", "AGENTS.md", "CLAUDE.md"):
                self.file("rule", parent / name, {"type": "project", "path": str(parent)})
        self.mcp(config, config_path, self.personal, "mcp_servers")

    def pi(self):
        self.skills(self.home / "skills", self.personal)
        self.skills(self.user_home / ".agents/skills", self.personal)
        for parent in project_roots(self.project):
            scope = {"type": "project", "path": str(parent)}
            self.skills(parent / ".agents/skills", scope)
            for name in ("AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"):
                self.file("rule", parent / name, scope)
        for folder, scope in [(self.home, self.personal), (self.project / ".pi", {"type": "project", "path": str(self.project)})]:
            self.skills(folder / "skills", scope)
            for name in ("AGENTS.override.md", "AGENTS.md", "CLAUDE.md", "SYSTEM.md", "APPEND_SYSTEM.md"):
                self.file("rule", folder / name, scope)
            self.mcp(self.config(folder / "mcp.json"), folder / "mcp.json", scope)
            settings = self.config(folder / "settings.json")
            extras = settings.get("skills", [])
            for value in extras if isinstance(extras, list) else []:
                path = self.configured_path(value, folder)
                if path:
                    if path.is_file() and path.name != "SKILL.md":
                        self.error(path, "STANDALONE_SKILL_REQUIRES_DIRECTORY")
                    else:
                        self.skills(path, scope)
        # No invented memory directory: Pi memory extensions have their own contracts.

    def discover(self):
        getattr(self, self.key)()
        return self.requests, self.errors


def inventory(homes, project, user_home=None, codex=None):
    requests, errors, results = [], [], []
    for key, home in homes.items():
        local_marker = {"codex": ".codex", "claude": ".claude", "hermes": ".hermes", "pi": ".pi"}[key]
        if not home.is_dir() and not (project / local_marker).is_dir():
            results.append({"harness": NAMES[key], "home": str(home), "status": "not_found", "discovered": {}})
            continue
        try:
            if key == "codex":
                catalog = codex_inventory.codex_skills(project, home, codex)
                rows, problems = codex_inventory.discover(home, project, catalog)
            else:
                rows, problems = LocalInventory(key, home, project, user_home).discover()
            requests.extend(rows)
            errors.extend(problems)
            results.append({"harness": NAMES[key], "home": str(home), "status": "partial" if problems else "complete",
                            "discovered": dict(Counter(r["kind"] for r in rows))})
        except (OSError, RuntimeError, ValueError, ImportError, RecursionError):
            errors.append({"harness": NAMES[key], "path": str(home), "code": "HARNESS_DISCOVERY_FAILED"})
            results.append({"harness": NAMES[key], "home": str(home), "status": "failed", "discovered": {}})
    return requests, errors, results


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--project", type=Path, default=ROOT)
    parser.add_argument("--harness", choices=["all", *NAMES], nargs="+", default=["all"])
    parser.add_argument("--codex", help="Installed Codex CLI executable")
    for key, env, default in [("codex", "CODEX_HOME", ".codex"), ("claude", "CLAUDE_CONFIG_DIR", ".claude"),
                              ("hermes", "HERMES_HOME", ".hermes"), ("pi", "PI_CODING_AGENT_DIR", ".pi/agent")]:
        parser.add_argument(f"--{key}-home", type=Path, default=Path(os.environ.get(env) or Path.home() / default))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if not args.data_dir.is_absolute() or not args.project.is_dir():
        parser.error("--data-dir must be absolute; --project must be an existing directory")
    selected = NAMES if "all" in args.harness else dict.fromkeys(args.harness)
    homes = {key: getattr(args, key + "_home").expanduser().resolve() for key in selected}
    requests, errors, results = inventory(homes, args.project.resolve(), codex=args.codex)
    report = {"source": "SkillBridge local Harness inventory", "observedAt": datetime.now(timezone.utc).isoformat(),
              "project": str(args.project.resolve()), "harnesses": results,
              "discovered": dict(Counter(r["kind"] for r in requests)), "errors": errors,
              "limits": LIMITS, "runtimeVerified": False, "profileWritten": False}
    if not args.dry_run:
        workspace = Workspace(args.data_dir)
        registered, failures = codex_inventory.register(workspace, requests)
        owners = {r.get("path", r.get("sourceKey")): r.get("environment", {}).get("harness") for r in requests}
        for failure in failures:
            failure["harness"] = owners.get(failure["path"])
            failure["message"] = ERROR_MESSAGES.get(failure["code"], "登记失败，请核对该来源后重试。")
        for result in results:
            result["registered"] = dict(Counter(r["kind"] for r in registered if r.get("harness") == result["harness"]))
            if any(f["harness"] == result["harness"] for f in failures):
                result["status"] = "partial"
        report.update(registered=dict(Counter(r["kind"] for r in registered)), errors=errors + failures,
                      uniqueAssets=len({r["assetId"] for r in registered}), profileWritten=True)
        report_path = workspace.home / "harness-inventory.json"
        _, failures = codex_inventory.register(workspace, [{"kind": "ledger", "content": report,
            "sourceKey": "harness-inventory:" + str(args.project.resolve()), "title": "跨应用资料整理记录",
            "ownership": "user", "scope": {"type": "personal"},
            "environment": {"harness": "SkillBridge", "agent": "local"}}])
        report["errors"].extend(failures)
        report["reportPath"] = str(report_path)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 2 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
