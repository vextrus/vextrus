"""CLI: `uv run python -m vextrus_cad <command>`.

Commands grow with the ingestion tickets; `validate` and `ingest` so far.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ezdxf import DXFError

from . import __version__
from .entitygraph import ArtifactError, validate
from .ingest import DERIVED_BUDGET, EXPLODE_DEPTH, ingest_file


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="python -m vextrus_cad")
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_validate = sub.add_parser("validate", help="validate an EntityGraph artifact")
    p_validate.add_argument("artifact", type=Path)

    p_ingest = sub.add_parser("ingest", help="DXF in, EntityGraph JSON out")
    p_ingest.add_argument("dxf", type=Path)
    p_ingest.add_argument("--explode-depth", type=int, default=EXPLODE_DEPTH)
    p_ingest.add_argument("--derived-budget", type=int, default=DERIVED_BUDGET)
    # Write the file ourselves: shell redirection under Windows PowerShell 5.1
    # re-encodes stdout as UTF-16 and corrupts the artifact.
    p_ingest.add_argument("-o", "--out", type=Path, default=None)

    args = parser.parse_args(argv)

    if args.command == "validate":
        try:
            validate(json.loads(args.artifact.read_text(encoding="utf-8")))
        except (ArtifactError, json.JSONDecodeError, OSError) as err:
            print(f"invalid: {err}", file=sys.stderr)
            return 1
        print("ok")
        return 0

    try:
        # extract() proves its own emission; ArtifactError is the named
        # refusal for malformed geometry (non-finite coordinates and kin).
        artifact = ingest_file(
            args.dxf,
            explode_depth=args.explode_depth,
            derived_budget=args.derived_budget,
        )
    except (ArtifactError, DXFError, OSError) as err:
        print(f"ingest failed: {err}", file=sys.stderr)
        return 1
    payload = json.dumps(artifact, indent=2) + "\n"
    if args.out is not None:
        # LF pinned: platform newline translation would dirty the committed file.
        args.out.write_text(payload, encoding="utf-8", newline="\n")
    else:
        sys.stdout.write(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
