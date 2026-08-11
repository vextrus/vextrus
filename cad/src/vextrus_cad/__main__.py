"""CLI: `uv run python -m vextrus_cad <command>`.

Commands grow with the ingestion tickets; `validate` is the founding one.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from . import __version__
from .entitygraph import ArtifactError, validate


def main(argv: list[str]) -> int:
    if not argv or argv[0] in {"-h", "--help"}:
        print("usage: python -m vextrus_cad [--version | validate <artifact.json>]")
        return 0
    if argv[0] == "--version":
        print(__version__)
        return 0
    if argv[0] == "validate":
        if len(argv) != 2:
            print("usage: python -m vextrus_cad validate <artifact.json>", file=sys.stderr)
            return 2
        try:
            validate(json.loads(Path(argv[1]).read_text(encoding="utf-8")))
        except (ArtifactError, json.JSONDecodeError, OSError) as err:
            print(f"invalid: {err}", file=sys.stderr)
            return 1
        print("ok")
        return 0
    print(f"unknown command: {argv[0]}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
