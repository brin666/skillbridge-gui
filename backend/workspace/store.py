"""Versioned SQLite documents. Existing library/cache files are never migrated implicitly."""
from __future__ import annotations

from contextlib import contextmanager, closing
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import uuid

from .errors import WorkspaceError


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def uid(prefix):
    return prefix + "_" + uuid.uuid4().hex


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def resolve_home(value=None):
    configured = value if value is not None else os.environ.get("SKILLBRIDGE_HOME")
    if configured is not None and (not str(configured).strip() or not Path(configured).expanduser().is_absolute()):
        raise WorkspaceError("DATA_HOME_INVALID", "Data directory must be an absolute path.")
    root = Path(configured).expanduser() if configured is not None else Path.home() / ".skillbridge"
    try:
        root.mkdir(parents=True, exist_ok=True)
        return root.resolve(strict=True)
    except OSError as exc:
        raise WorkspaceError("DATA_HOME_UNAVAILABLE", "Cannot access the configured data directory.") from exc


class Store:
    def __init__(self, home=None):
        self.home = resolve_home(home)
        self.path = self.home / "profile.sqlite3"
        if self.path.is_symlink() or (getattr(self.path, "is_junction", lambda: False)()):
            raise WorkspaceError("PROFILE_PATH_UNSAFE", "Profile database cannot be a link.", 409)
        try:
            with closing(self.connect()) as db:
                version = db.execute("PRAGMA user_version").fetchone()[0]
                tables = {row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if version not in (0, 1) or (version == 0 and tables):
                    raise WorkspaceError("PROFILE_VERSION_UNSUPPORTED", "Profile was not created by this version.", 409)
                db.execute("BEGIN IMMEDIATE")
                db.execute("""CREATE TABLE IF NOT EXISTS documents (
                    kind TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL,
                    PRIMARY KEY (kind, id))""")
                db.execute("PRAGMA user_version=1")
                db.commit()
        except sqlite3.DatabaseError as exc:
            raise WorkspaceError("PROFILE_UNREADABLE", "Profile database cannot be opened; existing data was preserved.", 409) from exc

    def connect(self):
        db = sqlite3.connect(str(self.path), timeout=10)
        db.row_factory = sqlite3.Row
        return db

    @contextmanager
    def transaction(self):
        db = self.connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except sqlite3.OperationalError as exc:
            db.rollback()
            raise WorkspaceError("PROFILE_BUSY", "Profile is busy or unavailable; retry the operation.", 409) from exc
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def get(self, kind, identity, db=None, required=True):
        if db is None:
            with closing(self.connect()) as connection:
                return self.get(kind, identity, connection, required)
        row = db.execute("SELECT payload FROM documents WHERE kind=? AND id=?", (kind, identity)).fetchone()
        if row is None:
            if required:
                raise WorkspaceError("NOT_FOUND", "Requested record was not found.", 404)
            return None
        return json.loads(row["payload"])

    def list(self, kind, db=None):
        if db is None:
            with closing(self.connect()) as connection:
                return self.list(kind, connection)
        return [json.loads(row[0]) for row in db.execute(
            "SELECT payload FROM documents WHERE kind=? ORDER BY id", (kind,))]

    def put(self, kind, identity, value, db):
        db.execute("INSERT INTO documents VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload",
                   (kind, identity, encode(value)))

    @staticmethod
    def check_version(record, expected):
        if type(expected) is not int:
            raise WorkspaceError("VERSION_REQUIRED", "expectedVersion is required.")
        if record["version"] != expected:
            raise WorkspaceError("VERSION_CONFLICT", "Record changed; reload before editing.", 409,
                                 {"currentVersion": record["version"]})
