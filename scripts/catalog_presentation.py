"""Prepare local display metadata; preserve source files, asset titles and selections."""
from __future__ import annotations
import argparse
from collections import Counter
from contextlib import closing
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.workspace.service import Workspace
from backend.workspace.router import dispatch
from backend.workspace.errors import WorkspaceError

LABELS = ROOT / "resources/catalog.zh-CN.json"


def description_hash(name, description):
    return hashlib.sha256((name + "\n" + description).encode()).hexdigest()


def memory_metadata(path):
    with path.open(encoding="utf-8-sig") as stream:
        text = stream.read(16384)
    meta = {}
    for field in ("thread_id", "updated_at", "cwd"):
        match = re.search(r"^" + field + r":\s*(.+)$", text, re.M)
        if match:
            meta[field] = match[1].strip().strip('`"')
    heading = re.search(r"^#\s+(.+)$", text, re.M)
    meta["heading"] = heading[1].strip() if heading else ""
    return meta


def thread_names(codex_home, ids):
    """Read only name/title for memory-linked IDs. No conversations, auth, or database writes."""
    result = {}
    errors = []
    if not ids:
        return result, errors
    dbs = sorted(codex_home.glob("state_*.sqlite"), key=lambda p: int(re.search(r"state_(\d+)", p.name)[1]), reverse=True)
    for file in dbs:
        try:
            with closing(sqlite3.connect(file.resolve().as_uri() + "?mode=ro", uri=True, timeout=2)) as db:
                columns = {row[1] for row in db.execute("PRAGMA table_info(threads)")}
                fields = [field for field in ("id", "name", "title") if field in columns]
                if "id" not in fields:
                    continue
                rows = db.execute("SELECT " + ",".join(fields) + " FROM threads WHERE id IN (" + ",".join("?" for _ in ids) + ")", list(ids)).fetchall()
                for row in rows:
                    record = dict(zip(fields, row))
                    name = record.get("name") or record.get("title")
                    if name and name.strip():
                        result.setdefault(record["id"], {"title": name.strip(), "source": "Codex 会话名称"})
            break
        except sqlite3.Error:
            errors.append({"source": str(file), "code": "THREAD_TITLES_UNAVAILABLE"})
    missing = ids - result.keys()
    index = codex_home / "session_index.jsonl"
    if missing and index.is_file():
        try:
            with index.open(encoding="utf-8") as stream:
                for line in stream:
                    try:
                        row = json.loads(line)
                    except ValueError:
                        continue
                    if row.get("id") in missing and row.get("thread_name"):
                        result[row["id"]] = {"title": row["thread_name"], "source": "Codex 会话索引"}
        except OSError:
            errors.append({"source": str(index), "code": "THREAD_INDEX_UNAVAILABLE"})
    return result, errors


def enrich_requests(requests, codex_home, catalog, labels=None):
    """Attach optional display metadata using the existing environment object.

    Bind descriptions to a source file hash, so a later refresh cannot display
    stale prose. Titles, ownership, scope and the underlying source stay intact.
    """
    labels = labels if labels is not None else json.loads(LABELS.read_text(encoding="utf-8"))
    skills = {str(Path(s["path"]).parent.resolve()).casefold(): s
              for group in catalog.get("data", []) for s in group.get("skills", [])}
    memories, errors = {}, []
    for body in requests:
        if body["kind"] == "memory" and body.get("path"):
            try:
                memories[body["path"]] = memory_metadata(Path(body["path"]))
            except (OSError, UnicodeError):
                errors.append({"path": body["path"], "code": "MEMORY_METADATA_UNAVAILABLE"})
    names, title_errors = thread_names(Path(codex_home), {m["thread_id"] for m in memories.values() if m.get("thread_id")})
    for body in requests:
        if body["kind"] not in {"skill", "memory"} or not body.get("path"):
            continue
        path = Path(body["path"])
        presentation = {"schemaVersion": 1}
        source = path / "SKILL.md" if body["kind"] == "skill" else path
        try:
            presentation.update(sourceFile=source.name, sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest())
        except OSError:
            errors.append({"path": str(source), "code": "PRESENTATION_SOURCE_UNAVAILABLE"})
            continue
        if body["kind"] == "skill":
            skill = skills.get(str(path.resolve()).casefold())
            if not skill:
                continue
            description = skill.get("description", "")
            label = labels.get(skill["name"], {})
            translated = description_hash(skill["name"], description) in label.get("sourceHashes", [])
            presentation.update(
                title=label["titleZh"] if translated else skill["name"], originalName=skill["name"],
                summary=label["summaryZh"] if translated else description, originalDescription=description,
                titleSource="中文释义" if translated else "Skill 原名",
                translation="中文简介" if translated else "尚未准备中文简介",
                locationLabel="共享技能" if "/.agents/" in path.as_posix() else "插件技能" if "/plugins/" in path.as_posix() else "Codex 技能")
        else:
            meta = memories.get(body["path"], {})
            thread = names.get(meta.get("thread_id"))
            special = {"memory_summary.md": "Codex 记忆概览", "MEMORY.md": "Codex 长期记忆", "raw_memories.md": "待整理的记忆记录"}
            presentation.update(
                title=(thread or {}).get("title") or special.get(path.name) or meta.get("heading") or "尚未命名的记忆",
                titleSource=thread["source"] if thread else "记忆文档标题", summary=meta.get("heading", ""),
                threadId=meta.get("thread_id"), date=meta.get("updated_at", ""),
                locationLabel="当前记忆" if "memories_v2" in str(path) else "旧版存档")
        environment = {**(body.get("environment") or {}), "presentation": presentation}
        if len(json.dumps(environment, ensure_ascii=False)) > 16000:
            errors.append({"path": str(path), "code": "PRESENTATION_TOO_LARGE"})
            continue
        body["environment"] = environment
    return errors + title_errors


def apply_existing(workspace, codex_home, catalog, labels=None):
    """Enrich registered, unchanged sources. Never refresh a changed selection implicitly."""
    assets = [a for a in workspace.assets() if a["kind"] in {"skill", "memory"} and a["source"].get("path")]
    requests = [{"kind": a["kind"], "path": a["source"]["path"], "environment": a.get("environment")} for a in assets]
    errors = enrich_requests(requests, codex_home, catalog, labels)
    updated = unchanged = 0
    for asset, body in zip(assets, requests):
        presentation = (body.get("environment") or {}).get("presentation")
        if not presentation:
            continue
        source = next((f for f in asset["files"] if f["path"] == presentation["sourceFile"]), None)
        if not source or source["sha256"] != presentation["sourceSha256"]:
            errors.append({"assetId": asset["id"], "code": "SOURCE_CHANGED"})
            continue
        if body["environment"] == asset.get("environment"):
            unchanged += 1
            continue
        # Check the entire source through the existing read-only preview before
        # registering metadata (including accompanying Skill files).
        from backend.workspace.files import collect
        try:
            actual = collect(asset["kind"], asset["source"])
            if (actual["entries"] != asset["files"] or actual["omissions"] != asset["omissions"]
                    or actual["followUps"] != asset["followUps"]):
                errors.append({"assetId": asset["id"], "code": "SOURCE_CHANGED"})
                continue
            dispatch(workspace, "POST", "/api/v1/assets", body)
            updated += 1
        except (WorkspaceError, OSError) as exc:
            errors.append({"assetId": asset["id"], "code": getattr(exc, "code", "SOURCE_UNREADABLE")})
    return {"updated": updated, "unchanged": unchanged, "errors": errors}


def build(workspace, codex_home, catalog, labels):
    assets = workspace.assets()
    skills = {str(Path(s["path"]).parent.resolve()).casefold(): s
              for group in catalog["data"] for s in group["skills"]}
    memories, errors = {}, []
    for asset in assets:
        if asset["kind"] == "memory" and asset["source"].get("path"):
            try:
                memories[asset["id"]] = memory_metadata(Path(asset["source"]["path"]))
            except (OSError, UnicodeError):
                errors.append({"assetId": asset["id"], "code": "MEMORY_METADATA_UNAVAILABLE"})
    ids = {m["thread_id"] for m in memories.values() if m.get("thread_id")}
    titles, title_errors = thread_names(codex_home, ids)
    rows = []
    for asset in assets:
        path = asset["source"].get("path", "")
        row = {"id": asset["id"], "kind": asset["kind"], "beforeTitle": asset["title"],
               "title": asset["title"], "originalName": "", "summary": "", "originalDescription": "",
               "source": asset.get("environment", {}).get("harness", "未标明应用") if asset.get("environment") else "未标明应用",
               "path": path or asset["source"].get("sourceKey", ""), "confirmation": asset["confirmation"],
               "project": asset["scope"].get("path", ""), "date": asset["updatedAt"], "titleSource": "资料原名"}
        if asset["kind"] == "skill":
            skill = skills.get(str(Path(path).resolve()).casefold())
            if skill:
                description = skill["description"]
                row.update(originalName=skill["name"], originalDescription=description)
                label = labels.get(skill["name"], {})
                if description_hash(skill["name"], description) in label.get("sourceHashes", []):
                    row.update(title=label["titleZh"], summary=label["summaryZh"], titleSource="中文释义", translation="中文简介")
                else:
                    row.update(summary=description, translation="尚未准备中文简介")
            row["locationLabel"] = "共享技能" if "/.agents/" in path.replace("\\", "/") else "插件技能" if "/plugins/" in path.replace("\\", "/") else "Codex 技能"
        elif asset["kind"] == "memory":
            meta = memories.get(asset["id"], {})
            thread = titles.get(meta.get("thread_id"))
            specials = {"memory_summary.md": "Codex 记忆概览", "MEMORY.md": "Codex 长期记忆", "raw_memories.md": "待整理的记忆记录"}
            row["title"] = (thread or {}).get("title") or specials.get(Path(path).name) or meta.get("heading") or "尚未命名的记忆"
            row["titleSource"] = thread["source"] if thread else "记忆文档标题"
            row["summary"] = meta.get("heading", "")
            row["date"] = meta.get("updated_at", asset["updatedAt"])
            row["threadId"] = meta.get("thread_id")
            row["locationLabel"] = "当前记忆" if "memories_v2" in path else "旧版存档"
        else:
            row["summary"] = {"mcp": "已登记的工具配置；连接状态尚未验证。", "rule": "工作约定与操作规则，保留文件原文。", "ledger": "本次资料整理的真实数量、来源与未登记项。"}[asset["kind"]]
            row["locationLabel"] = "Codex"
        rows.append(row)
    return {"previewOnly": True, "items": rows, "stats": dict(Counter(a["kind"] for a in rows)),
            "matchedMemoryTitles": sum(r["kind"] == "memory" and r["titleSource"].startswith("Codex 会话") for r in rows),
            "translatedSkills": sum(r["kind"] == "skill" and r.get("translation") == "中文简介" for r in rows),
            "errors": errors + title_errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, type=Path)
    parser.add_argument("--codex-home", required=True, type=Path)
    parser.add_argument("--catalog", type=Path)
    parser.add_argument("--apply", action="store_true", help="Persist display metadata through the existing workspace contract")
    parser.add_argument("--labels", type=Path, default=LABELS)
    args = parser.parse_args()
    if not args.data_dir.is_dir():
        raise SystemExit("Existing profile required")
    if args.catalog:
        catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    else:
        from scripts.codex_inventory import codex_skills
        catalog = codex_skills(ROOT, args.codex_home)
    labels = json.loads(args.labels.read_text(encoding="utf-8"))
    if args.apply:
        print(json.dumps(apply_existing(Workspace(args.data_dir), args.codex_home, catalog, labels), ensure_ascii=True))
        return
    output = build(Workspace(args.data_dir), args.codex_home, catalog, labels)
    target = args.data_dir / "presentation-preview.json"
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({k: v for k, v in output.items() if k != "items"}, ensure_ascii=True))


if __name__ == "__main__":
    main()
