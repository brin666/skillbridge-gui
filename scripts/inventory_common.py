"""Provenance metadata for inventory clients; workspace still owns asset identity."""
from __future__ import annotations

import os
from pathlib import Path


def source_identity(body):
    source = body.get("source", body)
    location = ("path", os.path.normcase(str(Path(source["path"]).resolve()))) if source.get("path") else ("inline", source.get("sourceKey"))
    return (body["kind"], *location, source.get("serverName"))


def origins(environment):
    environment = environment or {}
    sources = environment.get("sources")
    if isinstance(sources, list) and sources:
        return [s for s in sources if isinstance(s, dict) and isinstance(s.get("harness"), str)]
    return [{k: environment[k] for k in ("harness", "agent", "home", "codexHome", "discovery") if k in environment}] if environment.get("harness") else []


def merge_environment(previous, incoming):
    """Refreshing one Harness must not erase another Harness's reference to a file.

    These are observed references, not a promise that a current session loaded it.
    Missing references are retained until explicitly reviewed, like missing assets.
    """
    previous, incoming = previous or {}, incoming or {}
    refs = {}
    for source in [*origins(previous), *origins(incoming)]:
        key = (source["harness"], source.get("agent", "local"), source.get("home", source.get("codexHome", "")))
        refs[key] = source
    result = {**previous, **incoming}
    if refs:
        result["sources"] = list(refs.values())
        result["harness"] = result["sources"][0]["harness"]
        result["agent"] = result["sources"][0].get("agent", "local")
    return result
