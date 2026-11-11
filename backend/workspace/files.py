"""Bounded asset snapshots and credential-free MCP projections. Never execute asset code."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import stat
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .errors import WorkspaceError
from .store import encode

KINDS = {"skill", "rule", "memory", "mcp", "ledger"}
EXCLUDED_DIRS = {".git", ".hg", ".svn", "node_modules", ".venv", "venv", "__pycache__", ".cache"}
MAX_FILE_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 128 * 1024 * 1024
MAX_FILES = 4000
SECRET_KEY = re.compile(r"(?i)(?:secret|password|passwd|token|api[-_]?key|credential|authorization|cookie)")
LIVE_SECRET = re.compile(
    rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"
    rb"\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b")
LITERAL_SECRET = re.compile(
    rb"""(?i)(?:api[_-]?key|access[_-]?token|password|client[_-]?secret)\s*[:=]\s*["']([A-Za-z0-9_+/=-]{16,})["']""")
PLACEHOLDER = re.compile(r"\$\{[A-Za-z_][A-Za-z0-9_]*\}")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def linked(path):
    info = path.lstat()
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400)


def placeholder(name):
    return "$" + "{" + re.sub(r"[^A-Za-z0-9_]", "_", name).upper() + "}"


def sanitize_mcp(value):
    """Conservative projection: literal environment/header values become local references."""
    followups = []

    def redact(name):
        key = re.sub(r"[^A-Za-z0-9_]", "_", name).upper()
        followups.append({"code": "LOCAL_VALUE_REQUIRED", "field": key,
                          "message": "Configure this value in the receiving environment."})
        return placeholder(key)

    def walk(item, name="MCP", parent=""):
        if isinstance(item, (dict, list)) and (parent in {"env", "headers"} or SECRET_KEY.search(name)):
            return redact(name)
        if isinstance(item, dict):
            return {str(k): walk(v, str(k), name.lower()) for k, v in item.items()}
        if isinstance(item, list):
            result, previous_secret = [], False
            for index, v in enumerate(item):
                if isinstance(v, str):
                    if previous_secret:
                        result.append(redact(name + "_" + str(index)))
                        previous_secret = False
                        continue
                    if v.startswith("-") and SECRET_KEY.search(v):
                        parts = re.split(r"[=\s]+", v, maxsplit=1)
                        key = parts[0]
                        result.append(key + "=" + redact(key) if len(parts) > 1 else key)
                        previous_secret = len(parts) == 1
                        continue
                result.append(walk(v, name + "_" + str(index), parent))
            return result
        if isinstance(item, str):
            if parent in {"env", "headers"} or SECRET_KEY.search(name):
                # Permit references, never accompanying literal credentials.
                if PLACEHOLDER.fullmatch(item) or re.fullmatch(r"Bearer \$\{[A-Za-z_][A-Za-z0-9_]*\}", item):
                    redact(name)
                    return item
                return redact(name)
            if item.startswith(("http://", "https://")):
                try:
                    parts = urlsplit(item)
                    if parts.username or parts.password:
                        followups.append({"code": "URL_AUTH_REMOVED", "message": "Configure URL authentication locally."})
                    authority = parts.netloc.rsplit("@", 1)[-1]
                    query = [(k, redact("QUERY_" + k)) for k, _ in parse_qsl(parts.query, keep_blank_values=True)]
                    return urlunsplit((parts.scheme, authority, parts.path, urlencode(query), ""))
                except ValueError:
                    return redact(name)
            if LIVE_SECRET.search(item.encode()) or LITERAL_SECRET.search(item.encode()):
                return redact(name)
            # Inline command arguments such as --token=... or TOKEN=... .
            if re.search(r"(?i)(?:--(?:api[-_]key|token|password|secret)(?:\s|=)|"
                         r"(?:TOKEN|API_KEY|SECRET)\s*=|(?:Authorization|Cookie)\s*:)", item):
                return redact(name)
        if SECRET_KEY.search(name) and item is not None:
            return redact(name)
        return item

    clean = walk(value)
    unique = {encode(note): note for note in followups}
    return clean, list(unique.values())


def _read(path):
    if linked(path) or not path.is_file():
        raise WorkspaceError("SOURCE_UNREADABLE", "Selected source is not a regular readable file.")
    before = path.stat()
    if before.st_size > MAX_FILE_BYTES:
        raise WorkspaceError("FILE_TOO_LARGE", "A file exceeds the 32 MiB MVP limit.", details={"file": path.name})
    try:
        with path.open("rb") as stream:
            data = stream.read(MAX_FILE_BYTES + 1)
    except OSError as exc:
        raise WorkspaceError("SOURCE_UNREADABLE", "Cannot read selected source.", details={"file": path.name}) from exc
    after = path.stat()
    if len(data) > MAX_FILE_BYTES or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise WorkspaceError("SOURCE_CHANGED", "Source changed during reading.", 409)
    return data


def collect(kind, source):
    """Return payload bytes plus a reproducible fingerprint; source is never modified."""
    if kind not in KINDS:
        raise WorkspaceError("ASSET_KIND_INVALID", "Unsupported asset kind.")
    files, omissions, followups = {}, [], []
    if source["type"] == "inline":
        raw = source["content"].encode("utf-8")
        name = "content.json" if kind in {"mcp", "ledger"} else "content.md"
        files[name] = raw
    else:
        original = Path(source["path"])
        if not original.exists() or linked(original):
            raise WorkspaceError("SOURCE_MISSING", "Source is missing or is a link.", 409)
        if kind == "skill":
            if not original.is_dir():
                raise WorkspaceError("SKILL_DIRECTORY_REQUIRED", "A Skill must be a directory containing SKILL.md.")
            from backend.skill_files import find_skill_md
            if find_skill_md(original) is None:
                raise WorkspaceError("SKILL_DOCUMENT_MISSING", "Selected directory has no unambiguous SKILL.md.")
            stack = [(original, 0)]
            while stack:
                directory, depth = stack.pop()
                if depth > 24:
                    raise WorkspaceError("ASSET_TOO_DEEP", "Skill directory exceeds the supported depth.")
                for entry in sorted(directory.iterdir(), key=lambda p: p.name.casefold()):
                    rel = entry.relative_to(original).as_posix()
                    lowered = entry.name.casefold()
                    if linked(entry):
                        omissions.append({"path": rel, "reason": "link_not_followed"})
                        followups.append({"code": "EXTERNAL_RESOURCE", "path": rel, "message": "Review linked resource at the receiver."})
                    elif entry.is_dir():
                        if lowered in EXCLUDED_DIRS:
                            omissions.append({"path": rel, "reason": "generated_or_repository_directory"})
                        else:
                            stack.append((entry, depth + 1))
                    elif entry.is_file():
                        sensitive = lowered == ".env" or (lowered.startswith(".env.") and lowered != ".env.example")
                        sensitive |= lowered.endswith((".pem", ".key", ".pfx", ".p12")) or lowered.startswith("credentials")
                        if sensitive:
                            omissions.append({"path": rel, "reason": "local_credentials"})
                            followups.append({"code": "LOCAL_VALUE_REQUIRED", "path": rel, "message": "Provide local credentials separately."})
                        else:
                            files[rel] = _read(entry)
                    else:
                        raise WorkspaceError("UNSUPPORTED_FILE", "Skill contains a non-regular file.", details={"file": rel})
                    if len(files) > MAX_FILES or sum(len(v) for v in files.values()) > MAX_TOTAL_BYTES:
                        raise WorkspaceError("ASSET_TOO_LARGE", "Asset exceeds the MVP file count or 128 MiB limit.")
        else:
            if not original.is_file():
                raise WorkspaceError("FILE_REQUIRED", "This asset kind requires one selected file.")
            files[original.name] = _read(original)

    if kind == "mcp":
        try:
            value = json.loads(next(iter(files.values())).decode("utf-8-sig"))
        except (ValueError, UnicodeError) as exc:
            raise WorkspaceError("MCP_JSON_REQUIRED", "MVP MCP import accepts JSON configuration.") from exc
        if not isinstance(value, dict):
            raise WorkspaceError("MCP_OBJECT_REQUIRED", "MCP configuration must be an object.")
        servers = value.get("mcpServers", value.get("servers"))
        if isinstance(servers, dict):
            selected = source.get("serverName")
            if not selected:
                raise WorkspaceError("MCP_SERVER_REQUIRED", "Select one server from this configuration.",
                                     details={"servers": sorted(servers)})
            if selected not in servers:
                raise WorkspaceError("MCP_SERVER_NOT_FOUND", "Selected MCP server was not found.", 404)
            value = {"mcpServers": {selected: servers[selected]}}
        clean, followups = sanitize_mcp(value)
        followups = list({encode(n): n for n in [*source.get("followUps", []), *followups]}.values())
        files = {"config.json": (json.dumps(clean, ensure_ascii=False, indent=2) + "\n").encode("utf-8")}
    elif kind == "ledger":
        try:
            json.loads(next(iter(files.values())).decode("utf-8-sig"))
        except (ValueError, UnicodeError) as exc:
            raise WorkspaceError("LEDGER_JSON_REQUIRED", "Ledger handoff accepts explicitly selected JSON records.") from exc

    for name, data in files.items():
        if len(data) > MAX_FILE_BYTES:
            raise WorkspaceError("FILE_TOO_LARGE", "Content exceeds the MVP size limit.")
        if LIVE_SECRET.search(data) or LITERAL_SECRET.search(data):
            raise WorkspaceError("SENSITIVE_CONTENT", "Selected content contains credential-like material; review before exporting.",
                                 details={"file": name})
    entries = [{"path": name, "size": len(data), "sha256": digest(data)} for name, data in sorted(files.items())]
    fingerprint = digest(encode({"files": entries, "omissions": omissions, "followUps": followups}).encode())
    return {"files": files, "entries": entries, "fingerprint": fingerprint,
            "omissions": omissions, "followUps": followups}
