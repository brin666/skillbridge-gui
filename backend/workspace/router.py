"""Versioned transport-neutral route contract."""
from urllib.parse import parse_qs, unquote, urlsplit

from .errors import WorkspaceError
from .service import object_body, identity


def dispatch(workspace, method, url, body=None, *, asynchronous=True):
    parsed = urlsplit(url)
    segments = [unquote(p) for p in parsed.path.rstrip("/").split("/") if p]
    if segments[:2] != ["api", "v1"]:
        raise WorkspaceError("NOT_FOUND", "Unknown API route.", 404)
    parts = segments[2:]
    query = parse_qs(parsed.query)
    body = object_body(body if body is not None else {})
    if parts == ["status"] and method == "GET":
        return 200, workspace.status()
    if parts == ["environments"] and method == "GET":
        return 200, {"items": workspace.store.list("environment")}
    if parts == ["scan"] and method == "POST":
        return 200, workspace.scan(body)
    if parts == ["assets"]:
        if method == "GET":
            return 200, {"items": workspace.assets(
                kind=query.get("kind", [None])[0], frequent=query.get("frequent") == ["true"],
                include_system=query.get("includeSystem") == ["true"],
                include_archived=query.get("includeArchived") == ["true"],
                preference_scope=query.get("preferenceScope", [None])[0])}
        if method == "POST":
            return 201, workspace.register_asset(body)
    if len(parts) == 2 and parts[0] == "assets":
        if method == "GET":
            return 200, workspace.get_asset(parts[1])
        if method == "PATCH":
            return 200, workspace.update_asset(parts[1], body)
    if len(parts) == 3 and parts[0] == "assets" and parts[2] == "refresh" and method == "POST":
        return 200, workspace.refresh_asset(parts[1])
    if parts == ["reports"]:
        if method == "POST":
            return 201, workspace.submit_report(body)
        if method == "GET":
            return 200, {"items": workspace.store.list("report")}
    if parts == ["preferences"] and method == "GET":
        return 200, {"items": workspace.store.list("preference")}
    if len(parts) == 2 and parts[0] == "preferences" and method == "PUT":
        return 200, workspace.set_preference(parts[1], body)
    if parts == ["profile", "common-skills"] and method == "GET":
        return 200, workspace.common_skills()
    if parts == ["carts"]:
        if method == "GET":
            return 200, {"items": workspace.store.list("cart")}
        if method == "POST":
            return 201, workspace.create_cart(body)
    if len(parts) == 2 and parts[0] == "carts":
        if method == "GET":
            return 200, workspace.store.get("cart", identity(parts[1]))
        if method == "PATCH":
            return 200, workspace.edit_cart(parts[1], body)
    if len(parts) == 3 and parts[0] == "carts":
        cart_id, action = parts[1:]
        if action == "items" and method == "POST":
            return 200, workspace.edit_cart(cart_id, body, "add")
        if action == "items" and method == "DELETE":
            return 200, workspace.edit_cart(cart_id, body, "clear")
        if action == "preview" and method == "POST":
            return 200, workspace.preview(cart_id, body.get("expectedVersion"))
        if action == "export" and method == "POST":
            result = workspace.export(cart_id, body, asynchronous)
            return (202 if result["status"] == "running" else 200), result
    if len(parts) == 4 and parts[0] == "carts" and parts[2] == "items" and method == "DELETE":
        return 200, workspace.edit_cart(parts[1], body, "remove", parts[3])
    if parts == ["exports"] and method == "GET":
        return 200, {"items": [workspace.export_status(j["id"]) for j in workspace.store.list("export")]}
    if len(parts) == 2 and parts[0] == "exports" and method == "GET":
        return 200, workspace.export_status(parts[1])
    if len(parts) == 3 and parts[0] == "exports" and parts[2] == "cancel" and method == "POST":
        return 200, workspace.cancel_export(parts[1])
    if parts == ["packages"] and method == "GET":
        return 200, {"items": workspace.store.list("package")}
    if len(parts) == 2 and parts[0] == "packages" and method == "GET":
        return 200, workspace.package(parts[1])
    if len(parts) == 3 and parts[0] == "packages" and method == "GET":
        if parts[2] == "prompt":
            package = workspace.package(parts[1])
            return 200, {"packageId": package["id"], "path": package["path"], "text": package["prompt"]}
        if parts[2] == "verify":
            from .exporter import verify_package
            return 200, verify_package(workspace, parts[1])
    if parts == ["receipts"]:
        if method == "POST":
            return 201, workspace.receipt(body)
        if method == "GET":
            items = workspace.store.list("receipt")
            package_id = query.get("packageId", [None])[0]
            return 200, {"items": [r for r in items if not package_id or r["packageId"] == package_id]}
    raise WorkspaceError("NOT_FOUND", "Unknown API route or method.", 404)
