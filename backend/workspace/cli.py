"""Workspace CLI. Generic request invokes exactly the same contract as HTTP."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .errors import WorkspaceError
from .router import dispatch
from .service import Workspace


def parser():
    root = argparse.ArgumentParser(prog="skillbridge workspace")
    root.add_argument("--data-dir", help="Absolute data directory; otherwise SKILLBRIDGE_HOME or ~/.skillbridge.")
    commands = root.add_subparsers(dest="command", required=True)
    commands.add_parser("status")
    scan = commands.add_parser("scan", help="Discover Skill files only; no compatibility checks.")
    scan.add_argument("--root", action="append", default=[])
    scan.add_argument("--discover-agents", action="store_true")
    scan.add_argument("--project")
    assets = commands.add_parser("assets")
    assets.add_argument("--kind", choices=["skill", "rule", "memory", "mcp", "ledger"])
    assets.add_argument("--frequent", action="store_true")
    register = commands.add_parser("add", help="Register one asset from a JSON request file or stdin.")
    register.add_argument("--input", default="-")
    report = commands.add_parser("report")
    report.add_argument("--input", default="-")
    request = commands.add_parser("request", help="Call an /api/v1 route without starting HTTP.")
    request.add_argument("method", choices=["GET", "POST", "PUT", "PATCH", "DELETE"])
    request.add_argument("path")
    request.add_argument("--input", help="UTF-8 JSON file; - reads stdin.")
    export = commands.add_parser("export", help="Export synchronously, retaining the complete result on disk.")
    export.add_argument("cart_id")
    export.add_argument("--version", type=int, required=True)
    export.add_argument("--request-id", required=True)
    commands.add_parser("common")
    server = commands.add_parser("serve", help="Serve /api/v1 without invoking the legacy scanner.")
    server.add_argument("--port", type=int, default=17321)
    return root


def read_input(path):
    if path is None:
        return {}
    try:
        if path == "-":
            raw = (sys.stdin.buffer.read().decode("utf-8-sig") if hasattr(sys.stdin, "buffer") else sys.stdin.read())
        else:
            raw = Path(path).read_text(encoding="utf-8-sig")
        return json.loads(raw)
    except (OSError, ValueError, UnicodeError) as exc:
        raise WorkspaceError("INVALID_INPUT", "Input must be a readable UTF-8 JSON document.") from exc


def main(argv=None):
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    args = parser().parse_args(argv)
    try:
        if args.command == "serve":
            from .http import serve
            serve(args.data_dir, args.port)
            return 0
        workspace = Workspace(args.data_dir)
        if args.command == "status":
            result = workspace.status()
        elif args.command == "scan":
            result = workspace.scan({"roots": args.root, "discoverAgents": args.discover_agents, "projectPath": args.project})
        elif args.command == "assets":
            result = {"items": workspace.assets(args.kind, args.frequent)}
        elif args.command == "add":
            result = workspace.register_asset(read_input(args.input))
        elif args.command == "report":
            result = workspace.submit_report(read_input(args.input))
        elif args.command == "common":
            result = workspace.common_skills()
        elif args.command == "export":
            result = workspace.export(args.cart_id, {"expectedVersion": args.version, "requestId": args.request_id}, False)
        else:
            _, result = dispatch(workspace, args.method, args.path, read_input(args.input), asynchronous=False)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if isinstance(result, dict) and result.get("status") in {"failed", "cancelled"} else 0
    except WorkspaceError as exc:
        print(json.dumps(exc.to_dict(), ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    except OSError:
        print(json.dumps({"code": "FILESYSTEM_ERROR", "message": "A local file could not be accessed."}), file=sys.stderr)
        return 2
    except (ValueError, TypeError):
        print(json.dumps({"code": "INVALID_REQUEST", "message": "Invalid request value or structure."}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
