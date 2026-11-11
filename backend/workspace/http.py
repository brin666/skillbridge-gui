"""Loopback HTTP transport. No CORS wildcard and no implicit source scanning."""
from __future__ import annotations

import json
from http.server import ThreadingHTTPServer
from pathlib import Path
import threading
from urllib.parse import urlsplit

from .errors import WorkspaceError
from .router import dispatch
from .service import Workspace

MAX_BODY = 8 * 1024 * 1024
LOOPBACK_NAMES = {"127.0.0.1", "localhost", "::1"}


def handle_workspace_request(handler):
    if not (urlsplit(handler.path).path == "/api/v1" or urlsplit(handler.path).path.startswith("/api/v1/")):
        return False
    try:
        host = urlsplit("//" + handler.headers.get("Host", "")).hostname
        if host not in LOOPBACK_NAMES:
            raise WorkspaceError("HOST_NOT_ALLOWED", "Workspace API is local only.", 403)
        origin = handler.headers.get("Origin")
        if origin and (urlsplit(origin).scheme not in {"http", "https"} or urlsplit(origin).hostname not in LOOPBACK_NAMES):
            raise WorkspaceError("ORIGIN_NOT_ALLOWED", "This browser origin is not allowed.", 403)
        body = {}
        if handler.command in {"POST", "PUT", "PATCH", "DELETE"}:
            if handler.headers.get_content_type() != "application/json":
                raise WorkspaceError("JSON_REQUIRED", "Write requests require application/json.", 415)
            if handler.headers.get("Transfer-Encoding"):
                raise WorkspaceError("INVALID_REQUEST", "Chunked request bodies are not supported.")
            try:
                length = int(handler.headers.get("Content-Length", "0"))
            except ValueError as exc:
                raise WorkspaceError("INVALID_REQUEST", "Invalid Content-Length.") from exc
            if not 0 <= length <= MAX_BODY:
                raise WorkspaceError("BODY_TOO_LARGE", "Request body exceeds 8 MiB.", 413)
            try:
                body = json.loads(handler.rfile.read(length).decode("utf-8") or "{}")
            except (UnicodeError, ValueError) as exc:
                raise WorkspaceError("INVALID_JSON", "Request body is not valid UTF-8 JSON.") from exc
        with handler.server.workspace_lock:
            if handler.server.workspace is None:
                handler.server.workspace = Workspace(getattr(handler.server, "workspace_home", None))
            workspace = handler.server.workspace
        status, result = dispatch(workspace, handler.command, handler.path, body)
        handler._send_json(result, status)
    except WorkspaceError as exc:
        handler._send_json(exc.to_dict(), exc.status)
    except (ValueError, TypeError) as exc:
        handler._send_json({"code": "INVALID_REQUEST", "message": "Invalid request value or structure."}, 400)
    except OSError:
        handler._send_json({"code": "FILESYSTEM_ERROR", "message": "A local file could not be accessed."}, 409)
    except Exception:
        handler._send_json({"code": "INTERNAL_ERROR", "message": "Workspace operation failed."}, 500)
    return True


def make_server(home=None, port=17321):
    from backend.server import SkillBridgeRequestHandler, UI_DIST

    class Handler(SkillBridgeRequestHandler):
        def do_GET(self):
            if not handle_workspace_request(self):
                if urlsplit(self.path).path.startswith("/api/"):
                    self._send_json({"code": "NOT_FOUND", "message": "Use /api/v1 for the workspace server."}, 404)
                else:
                    self._serve_static(urlsplit(self.path).path)

        def _write(self):
            if not handle_workspace_request(self):
                self._send_json({"code": "NOT_FOUND", "message": "Unknown workspace route."}, 404)

        do_POST = _write
        do_PATCH = _write
        do_PUT = _write
        do_DELETE = _write

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    server.workspace_lock = threading.Lock()
    try:
        server.workspace = Workspace(home)
    except BaseException:
        server.server_close()
        raise
    server.ui_dir = Path(UI_DIST)
    return server


def serve(home=None, port=17321):
    server = make_server(home, port)
    print(json.dumps({"url": "http://127.0.0.1:" + str(server.server_address[1]),
                      "api": "/api/v1", "dataHome": str(server.workspace.home)}, ensure_ascii=False), flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
