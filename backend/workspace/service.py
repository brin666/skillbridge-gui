"""The single workspace service used by both transports."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import threading
import time
import uuid

from .errors import WorkspaceError
from .files import KINDS, collect, digest
from .store import Store, encode, now, uid


def object_body(value):
    if not isinstance(value, dict):
        raise WorkspaceError("INVALID_BODY", "Expected a JSON object.")
    return value


def string(value, field, *, required=False, limit=16000):
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise WorkspaceError("INVALID_FIELD", "Invalid " + field + ".")
    return value


def identity(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,120}", value):
        raise WorkspaceError("INVALID_ID", "IDs must contain 1–120 letters, digits, dots, underscores, colons or hyphens.")
    return value


def optional_object(value, field):
    if value is not None and not isinstance(value, dict):
        raise WorkspaceError("INVALID_FIELD", field + " must be an object or null.")
    if len(encode(value)) > 16000:
        raise WorkspaceError("INVALID_FIELD", field + " is too large.")
    return value


class Workspace:
    def __init__(self, home=None):
        self.store = Store(home)
        self.home = self.store.home
        self._threads = {}
        self._thread_lock = threading.Lock()

    def status(self):
        return {"schemaVersion": 1, "dataHome": str(self.home), "version": "0.2.0-mvp",
                "assetCount": len(self.store.list("asset")), "cartCount": len(self.store.list("cart")),
                "packageCount": len(self.store.list("package")),
                "capabilities": ["inventory", "reports", "preferences", "carts", "handoff-export", "receipts"],
                "legacySyncUsed": False}

    def register_asset(self, body):
        body = object_body(body)
        kind = body.get("kind")
        if kind not in KINDS:
            raise WorkspaceError("ASSET_KIND_INVALID", "kind must be skill, rule, memory, mcp or ledger.")
        if ("path" in body) == ("content" in body):
            raise WorkspaceError("ASSET_SOURCE_REQUIRED", "Supply exactly one of path or content.")
        if "path" in body:
            raw = Path(string(body["path"], "path", required=True)).expanduser()
            if not raw.is_absolute():
                raise WorkspaceError("ABSOLUTE_PATH_REQUIRED", "Source path must be absolute.")
            # Preserve the requested final component so links are not silently followed.
            path = Path(os.path.abspath(raw))
            source = {"type": "path", "path": str(path)}
            key = kind + ":" + os.path.normcase(str(path))
            fallback = path.name
        else:
            if kind == "skill":
                raise WorkspaceError("SKILL_DIRECTORY_REQUIRED", "Skills must be registered from a complete directory.")
            content = body["content"]
            if isinstance(content, (dict, list)):
                content = json.dumps(content, ensure_ascii=False, indent=2)
            content = string(content, "content", limit=4 * 1024 * 1024)
            source_key = string(body.get("sourceKey", uid("manual")), "sourceKey", required=True)
            source = {"type": "inline", "content": content, "sourceKey": source_key}
            key = kind + ":inline:" + source_key
            fallback = kind
        if body.get("serverName") is not None:
            source["serverName"] = string(body["serverName"], "serverName", required=True)
            key += ":" + source["serverName"]
        collected = collect(kind, source)
        if kind == "mcp" and source["type"] == "inline":
            source["content"] = collected["files"]["config.json"].decode("utf-8")
            source["followUps"] = collected["followUps"]
            collected = collect(kind, source)
        asset_id = "asset_" + digest(key.encode())[:32]
        title = string(body.get("title", fallback), "title", required=True, limit=500)
        ownership = body.get("ownership", "user" if source["type"] == "inline" else "unknown")
        if source["type"] == "path" and any(p.casefold() == ".system" for p in Path(source["path"]).parts):
            ownership = "system"
        if ownership not in {"system", "user", "unknown"}:
            raise WorkspaceError("INVALID_FIELD", "Invalid ownership.")
        environment = optional_object(body.get("environment"), "environment")
        scope = optional_object(body.get("scope", {"type": "personal"}), "scope")
        if not scope or scope.get("type") not in {"personal", "project", "environment"}:
            raise WorkspaceError("INVALID_SCOPE", "scope.type must be personal, project or environment.")
        revision_id = "rev_" + digest((asset_id + collected["fingerprint"]).encode())[:40]
        with self.store.transaction() as db:
            previous = self.store.get("asset", asset_id, db, False)
            if previous and previous.get("archived"):
                raise WorkspaceError("ASSET_ARCHIVED", "Archived asset must be explicitly restored.", 409)
            if previous:
                title = title if "title" in body else previous["title"]
                scope = scope if "scope" in body else previous["scope"]
                environment = environment if "environment" in body else previous["environment"]
                if "ownership" not in body and ownership != "system":
                    ownership = previous["ownership"]
            asset = {"id": asset_id, "kind": kind, "title": title, "source": source,
                     "revisionId": revision_id, "ownership": ownership, "scope": scope,
                     "environment": environment, "createdAt": previous["createdAt"] if previous else now(),
                     "updatedAt": now(), "version": previous["version"] + 1 if previous else 1,
                     "archived": False, "confirmation": "draft" if kind in {"memory", "rule"} else "not_required",
                     "files": collected["entries"], "omissions": collected["omissions"],
                     "followUps": collected["followUps"]}
            if previous and previous["revisionId"] == revision_id:
                asset["confirmation"] = previous["confirmation"]
            if previous and source["type"] == "inline":
                self.store.check_version(previous, body.get("expectedVersion"))
            revision = {"id": revision_id, "assetId": asset_id, "source": source,
                        "fingerprint": collected["fingerprint"], "files": collected["entries"],
                        "omissions": collected["omissions"], "followUps": collected["followUps"], "createdAt": now(),
                        "metadata": {k: asset[k] for k in ("title", "scope", "confirmation")}}
            if not self.store.get("revision", revision_id, db, False):
                self.store.put("revision", revision_id, revision, db)
            self.store.put("asset", asset_id, asset, db)
        return self.get_asset(asset_id)

    @staticmethod
    def _public(asset, *, detail=False):
        asset = json.loads(encode(asset))
        if not detail and asset["source"]["type"] == "inline":
            asset["source"].pop("content", None)
        return asset

    def get_asset(self, asset_id):
        asset = self.store.get("asset", identity(asset_id))
        result = self._public(asset, detail=True)
        result["preferences"] = [p for p in self.store.list("preference") if p["assetId"] == asset_id]
        return result

    def assets(self, kind=None, frequent=False, include_system=False, include_archived=False, preference_scope=None):
        if kind and kind not in KINDS:
            raise WorkspaceError("ASSET_KIND_INVALID", "Unsupported kind filter.")
        prefs = self.store.list("preference")
        if preference_scope is not None:
            prefs = [p for p in prefs if p["scope"] == preference_scope]
        frequent_ids = {p["assetId"] for p in prefs if p["frequent"]}
        items = []
        for asset in self.store.list("asset"):
            if (kind and asset["kind"] != kind) or (frequent and asset["id"] not in frequent_ids):
                continue
            if not include_system and asset["ownership"] == "system":
                continue
            if not include_archived and asset["archived"]:
                continue
            result = self._public(asset)
            result["frequent"] = asset["id"] in frequent_ids
            items.append(result)
        return sorted(items, key=lambda x: (not x["frequent"], x["title"].casefold(), x["id"]))

    def update_asset(self, asset_id, body):
        body = object_body(body)
        allowed = {"expectedVersion", "title", "confirmation", "archived"}
        if set(body) - allowed:
            raise WorkspaceError("INVALID_FIELD", "Only title, confirmation and archived can be patched.")
        with self.store.transaction() as db:
            asset = self.store.get("asset", identity(asset_id), db)
            self.store.check_version(asset, body.get("expectedVersion"))
            if "title" in body:
                asset["title"] = string(body["title"], "title", required=True, limit=500)
            if "confirmation" in body:
                if body["confirmation"] not in {"draft", "confirmed", "outdated"}:
                    raise WorkspaceError("INVALID_FIELD", "Invalid confirmation.")
                asset["confirmation"] = body["confirmation"]
            if "archived" in body:
                if type(body["archived"]) is not bool:
                    raise WorkspaceError("INVALID_FIELD", "archived must be boolean.")
                asset["archived"] = body["archived"]
            asset["version"] += 1
            asset["updatedAt"] = now()
            self.store.put("asset", asset_id, asset, db)
        return self.get_asset(asset_id)

    def refresh_asset(self, asset_id):
        asset = self.store.get("asset", identity(asset_id))
        if asset["source"]["type"] != "path":
            raise WorkspaceError("INLINE_ASSET", "Update inline content using its sourceKey and expectedVersion.")
        body = {"kind": asset["kind"]}
        body.update({k: v for k, v in asset["source"].items() if k != "type"})
        return self.register_asset(body)

    def scan(self, body):
        from backend.skill_files import iter_skill_md_files
        body = object_body(body)
        roots = body.get("roots", [])
        if not isinstance(roots, list):
            raise WorkspaceError("INVALID_FIELD", "roots must be an array.")
        roots = list(roots)
        environments, errors, items = [], [], []
        if body.get("discoverAgents", False):
            from backend.core.agent_scanner import AgentScanner
            scanner = AgentScanner(project_dir=body.get("projectPath"))
            for adapter in scanner.adapters:
                # Path discovery only: no version subprocesses or compatibility warmup.
                paths = adapter.get_skill_paths()
                if paths:
                    env = {"id": adapter.agent_id, "harness": adapter.get_name(), "skillRoots": paths, "version": None}
                    environments.append(env)
                    roots.extend({"path": p, "environment": env} for p in paths)
        if not roots and not body.get("discoverAgents"):
            raise WorkspaceError("SCAN_ROOT_REQUIRED", "Supply roots or discoverAgents=true.")
        seen = set()
        for root in roots:
            if isinstance(root, str):
                root = {"path": root}
            root = object_body(root)
            path = Path(string(root.get("path"), "path", required=True)).expanduser()
            if not path.is_absolute() or not path.exists():
                errors.append({"path": str(path), "code": "SCAN_ROOT_UNAVAILABLE"})
                continue
            try:
                for document in iter_skill_md_files(path):
                    key = os.path.normcase(str(document.parent.resolve()))
                    if key in seen:
                        continue
                    seen.add(key)
                    if len(seen) > 2000:
                        raise WorkspaceError("SCAN_LIMIT", "Scan stopped at 2000 Skills.")
                    try:
                        request = {"kind": "skill", "path": str(document.parent)}
                        if root.get("environment") is not None:
                            request["environment"] = root["environment"]
                        item = self.register_asset(request)
                        items.append(self._public(item))
                    except (WorkspaceError, OSError) as exc:
                        errors.append({"path": str(document.parent), "code": getattr(exc, "code", "SOURCE_UNREADABLE")})
            except (WorkspaceError, OSError) as exc:
                errors.append({"path": str(path), "code": getattr(exc, "code", "SOURCE_UNREADABLE")})
        with self.store.transaction() as db:
            for env in environments:
                self.store.put("environment", env["id"], env, db)
        return {"assets": items, "environments": environments, "errors": errors, "scanned": len(items)}

    def submit_report(self, body):
        body = object_body(body)
        report_id = identity(body.get("id"))
        if body.get("type") not in {"recommendation", "usage", "memory_draft", "rule_suggestion"}:
            raise WorkspaceError("REPORT_TYPE_INVALID", "Unsupported report type.")
        source = string(body.get("source"), "source", required=True, limit=500)
        asset_ids = body.get("assetIds", [])
        if not isinstance(asset_ids, list) or not asset_ids:
            raise WorkspaceError("REPORT_ASSETS_REQUIRED", "Register report content as assets, then supply assetIds.")
        evidence = string(body.get("evidence", ""), "evidence")
        fingerprint = digest(encode(body).encode())
        with self.store.transaction() as db:
            old = self.store.get("report", report_id, db, False)
            if old:
                if old["requestHash"] != fingerprint:
                    raise WorkspaceError("REQUEST_MISMATCH", "Report ID belongs to different content.", 409)
                return {**old, "duplicate": True}
            for asset_id in asset_ids:
                asset = self.store.get("asset", identity(asset_id), db)
                if asset["archived"]:
                    raise WorkspaceError("ASSET_ARCHIVED", "Report cannot reactivate an archived asset.", 409)
            record = {"id": report_id, "type": body["type"], "source": source,
                      "assetIds": list(dict.fromkeys(asset_ids)), "evidence": evidence,
                      "observedAt": body.get("observedAt"), "createdAt": now(), "requestHash": fingerprint}
            self.store.put("report", report_id, record, db)
        return record

    def set_preference(self, asset_id, body):
        body = object_body(body)
        if type(body.get("frequent")) is not bool:
            raise WorkspaceError("INVALID_FIELD", "frequent must be boolean.")
        scope = string(body.get("scope", "personal"), "scope", required=True, limit=500)
        pref_id = digest((identity(asset_id) + ":" + scope).encode())
        with self.store.transaction() as db:
            asset = self.store.get("asset", asset_id, db)
            if asset["archived"] or asset["ownership"] == "system":
                raise WorkspaceError("ASSET_UNAVAILABLE", "This asset is not available for personal preferences.", 409)
            old = self.store.get("preference", pref_id, db, False)
            if old:
                self.store.check_version(old, body.get("expectedVersion"))
            record = {"id": pref_id, "assetId": asset_id, "scope": scope, "frequent": body["frequent"],
                      "version": old["version"] + 1 if old else 1, "confirmedAt": now(), "confirmedBy": "user"}
            self.store.put("preference", pref_id, record, db)
        self.common_skills()
        return record

    def common_skills(self):
        with self.store.transaction() as db:
            assets = {a["id"]: a for a in self.store.list("asset", db)}
            lines = ["# 常用资料", "", "生成时间：" + now(), "", "此文件由档案生成，请通过 SkillBridge 更新确认记录。", ""]
            for pref in self.store.list("preference", db):
                asset = assets.get(pref["assetId"])
                if not pref["frequent"] or not asset or asset["archived"]:
                    continue
                lines.extend(["## " + asset["title"].replace("\n", " "), "",
                              "- 类型：" + asset["kind"], "- 范围：" + pref["scope"],
                              "- 资产：" + asset["id"], "- 修订：" + asset["revisionId"],
                              "- 来源：" + asset["source"].get("path", "档案内保存的内容"), ""])
            content = "\n".join(lines) + "\n"
            temporary = self.home / ("." + uuid.uuid4().hex + ".md.tmp")
            try:
                temporary.write_text(content, encoding="utf-8")
                os.replace(temporary, self.home / "COMMON_SKILLS.md")
            finally:
                temporary.unlink(missing_ok=True)
        return {"path": str(self.home / "COMMON_SKILLS.md"), "content": content}

    def create_cart(self, body):
        body = object_body(body)
        cart = {"id": uid("cart"), "version": 1, "status": "draft", "items": [], "createdAt": now(), "updatedAt": now(),
                "task": optional_object(body.get("task", {"description": ""}), "task"),
                "project": optional_object(body.get("project"), "project"),
                "targetHint": optional_object(body.get("targetHint"), "targetHint"),
                "operationScope": string(body.get("operationScope", "读取所选资料并提出接续使用方案；不修改目标配置。"), "operationScope")}
        with self.store.transaction() as db:
            self.store.put("cart", cart["id"], cart, db)
        return cart

    def edit_cart(self, cart_id, body, action="metadata", asset_id=None):
        body = object_body(body)
        with self.store.transaction() as db:
            cart = self.store.get("cart", identity(cart_id), db)
            self.store.check_version(cart, body.get("expectedVersion"))
            if action == "add":
                asset = self.store.get("asset", identity(body.get("assetId")), db)
                if asset["archived"] or asset["ownership"] == "system":
                    raise WorkspaceError("ASSET_UNAVAILABLE", "Archived or system assets cannot be added.", 409)
                revision_id = body.get("revisionId", asset["revisionId"])
                revision = self.store.get("revision", identity(revision_id), db)
                if revision["assetId"] != asset["id"]:
                    raise WorkspaceError("REVISION_MISMATCH", "Revision does not belong to the selected asset.")
                purpose = string(body.get("purpose", ""), "purpose")
                metadata = ({k: asset[k] for k in ("title", "scope", "confirmation")}
                            if revision_id == asset["revisionId"] else revision.get("metadata", {
                                "title": asset["title"], "scope": asset["scope"], "confirmation": "draft"}))
                existing = next((i for i in cart["items"] if i["assetId"] == asset["id"]), None)
                if (existing and existing["revisionId"] == revision_id and existing["purpose"] == purpose
                        and existing.get("metadata") == metadata):
                    return cart
                cart["items"] = [i for i in cart["items"] if i["assetId"] != asset["id"]]
                cart["items"].append({"assetId": asset["id"], "revisionId": revision_id, "purpose": purpose,
                                      "metadata": metadata, "addedAt": now()})
            elif action == "remove":
                identity(asset_id)
                cart["items"] = [i for i in cart["items"] if i["assetId"] != asset_id]
            elif action == "clear":
                cart["items"] = []
            else:
                if set(body) - {"expectedVersion", "task", "project", "targetHint", "operationScope"}:
                    raise WorkspaceError("INVALID_FIELD", "Unknown cart field.")
                for field in ("task", "project", "targetHint"):
                    if field in body:
                        cart[field] = optional_object(body[field], field)
                if "operationScope" in body:
                    cart["operationScope"] = string(body["operationScope"], "operationScope")
            cart["version"] += 1
            cart["updatedAt"] = now()
            cart["status"] = "draft"
            self.store.put("cart", cart["id"], cart, db)
        return cart

    def materialize_item(self, item):
        asset = self.store.get("asset", item["assetId"])
        if asset["archived"] or asset["ownership"] == "system":
            raise WorkspaceError("ASSET_UNAVAILABLE", "Selected asset is no longer available.", 409)
        revision = self.store.get("revision", item["revisionId"])
        try:
            collected = collect(asset["kind"], revision["source"])
        except WorkspaceError as exc:
            exc.details = {**(exc.details or {}), "assetId": asset["id"]}
            raise
        except OSError as exc:
            raise WorkspaceError("SOURCE_UNREADABLE", "Selected source cannot be read.", 409,
                                 {"assetId": asset["id"]}) from exc
        if collected["fingerprint"] != revision["fingerprint"]:
            raise WorkspaceError("SOURCE_CHANGED", "Source differs from the selected revision; refresh and reselect.", 409,
                                 {"assetId": asset["id"]})
        asset.update(item.get("metadata") or revision.get("metadata") or {})
        return asset, revision, collected

    def preview(self, cart_id, expected_version=None):
        cart = self.store.get("cart", identity(cart_id))
        if expected_version is not None:
            self.store.check_version(cart, expected_version)
        items, errors = [], []
        for selected in cart["items"]:
            try:
                asset, revision, data = self.materialize_item(selected)
                items.append({"assetId": asset["id"], "revisionId": revision["id"], "kind": asset["kind"],
                              "title": asset["title"], "purpose": selected["purpose"], "scope": asset["scope"],
                              "confirmation": asset["confirmation"], "ownership": asset["ownership"],
                              "files": data["entries"], "omissions": data["omissions"], "followUps": data["followUps"]})
            except (WorkspaceError, OSError) as exc:
                error = exc.to_dict() if isinstance(exc, WorkspaceError) else {"code": "SOURCE_UNREADABLE", "message": "Source cannot be read."}
                errors.append({"assetId": selected["assetId"], **error})
        if not cart["items"]:
            errors.append({"code": "EMPTY_CART", "message": "Select at least one asset."})
        return {"cart": cart, "items": items, "errors": errors, "canExport": not errors,
                "status": "ready" if not errors else "needs_attention", "compatibilityChecked": False}

    def export(self, cart_id, body, asynchronous=True):
        body = object_body(body)
        request_id = identity(body.get("requestId"))
        signature = digest(encode({"cartId": cart_id, "expectedVersion": body.get("expectedVersion")}).encode())
        with self.store.transaction() as db:
            existing = self.store.get("export_request", request_id, db, False)
            if existing:
                if existing["signature"] != signature:
                    raise WorkspaceError("REQUEST_MISMATCH", "requestId was used for a different export.", 409)
                return self.store.get("export", existing["jobId"], db)
            cart = self.store.get("cart", identity(cart_id), db)
            self.store.check_version(cart, body.get("expectedVersion"))
            if not cart["items"]:
                raise WorkspaceError("EMPTY_CART", "Select at least one asset.")
            job = {"id": uid("export"), "requestId": request_id, "cartId": cart_id,
                   "cartVersion": cart["version"], "status": "running", "phase": "queued",
                   "createdAt": now(), "updatedAt": now(), "leaseUntil": time.time() + 120,
                   "cancelRequested": False, "packageId": None, "error": None}
            self.store.put("export", job["id"], job, db)
            self.store.put("export_request", request_id, {"signature": signature, "jobId": job["id"]}, db)
        from .exporter import run_export
        if asynchronous:
            worker = threading.Thread(target=run_export, args=(self, job["id"], cart), daemon=True)
            with self._thread_lock:
                self._threads[job["id"]] = worker
            worker.start()
            return job
        run_export(self, job["id"], cart)
        return self.export_status(job["id"])

    def export_status(self, job_id):
        with self.store.transaction() as db:
            job = self.store.get("export", identity(job_id), db)
            if job["status"] == "running" and job["leaseUntil"] < time.time():
                job.update(status="failed", phase="finished", updatedAt=now(),
                           error={"code": "EXPORT_INTERRUPTED", "message": "Export worker stopped; retry with a new requestId."})
                self.store.put("export", job_id, job, db)
        return job

    def cancel_export(self, job_id):
        with self.store.transaction() as db:
            job = self.store.get("export", identity(job_id), db)
            if job["status"] == "running":
                job["cancelRequested"] = True
                self.store.put("export", job_id, job, db)
        return job

    def package(self, package_id):
        package = self.store.get("package", identity(package_id))
        root = self.home / "handoffs" / package_id
        try:
            from .files import linked
            if linked(root) or linked(root.parent) or root.resolve().parent != self.home / "handoffs":
                raise WorkspaceError("PACKAGE_UNAVAILABLE", "Package directory is not a managed directory.", 409)
            content = {}
            for name, field in (("manifest.json", "manifestSha256"), ("README.md", "readmeSha256"),
                                ("HANDOFF.md", "promptSha256")):
                path = root / name
                if linked(path) or not path.is_file() or path.stat().st_size > 8 * 1024 * 1024:
                    raise WorkspaceError("PACKAGE_UNAVAILABLE", "Package metadata is missing, linked or too large.", 409)
                content[name] = path.read_bytes()
                if digest(content[name]) != package[field]:
                    raise WorkspaceError("PACKAGE_CHANGED", "Package metadata differs from the exported snapshot.", 409)
            package["manifest"] = json.loads(content["manifest.json"].decode("utf-8"))
            package["prompt"] = content["HANDOFF.md"].decode("utf-8")
        except (OSError, ValueError) as exc:
            raise WorkspaceError("PACKAGE_UNAVAILABLE", "Package is missing or damaged.", 409) from exc
        return package

    def receipt(self, body):
        body = object_body(body)
        report_id = identity(body.get("id"))
        package = self.package(identity(body.get("packageId")))
        source = string(body.get("source"), "source", required=True, limit=500)
        target = optional_object(body.get("target"), "target")
        if not target:
            raise WorkspaceError("TARGET_REQUIRED", "Receipt requires its target environment.")
        entries = body.get("items")
        selected = {i["assetId"] for i in package["manifest"]["items"]}
        statuses = {"read", "written", "recognized", "verified", "needs_action", "failed", "unknown"}
        if not isinstance(entries, list) or not entries:
            raise WorkspaceError("RECEIPT_ITEMS_REQUIRED", "Receipt requires item results.")
        for item in entries:
            if not isinstance(item, dict) or item.get("assetId") not in selected or item.get("status") not in statuses:
                raise WorkspaceError("RECEIPT_ITEM_INVALID", "Receipt contains an unselected asset or unknown status.")
            string(item.get("evidence", ""), "evidence")
        signature = digest(encode(body).encode())
        with self.store.transaction() as db:
            old = self.store.get("receipt", report_id, db, False)
            if old:
                if old["requestHash"] != signature:
                    raise WorkspaceError("REQUEST_MISMATCH", "Receipt ID belongs to different content.", 409)
                return {**old, "duplicate": True}
            result = {"id": report_id, "packageId": body["packageId"], "source": source,
                      "target": target, "items": entries, "createdAt": now(), "requestHash": signature,
                      "verification": "reported"}
            self.store.put("receipt", report_id, result, db)
            stored_package = self.store.get("package", body["packageId"], db)
            stored_package["receiptStatus"] = "reported"
            self.store.put("package", body["packageId"], stored_package, db)
        return result
