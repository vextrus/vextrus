"""The Python half of the licence test ADR-0001 promised (`cad-ingestion.md` §1).

`eslint.config.js` ignores `cad/**`, so no lint rule reaches this side of the tree and the
assertion is a pytest. The banned set is the same closed list the TypeScript half reads —
`src/__tests__/fixtures/banned-pdf-libraries.json` — so a library is banned in one place, never
in one half. Each arm has a fixture proving it fires (ADR-0007); test files are not shipped
modules, which is what lets this file name the banned strings.
"""

import ast
import json
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAD = ROOT / "cad"
BANNED = json.loads(
    (ROOT / "src/__tests__/fixtures/banned-pdf-libraries.json").read_text(encoding="utf-8")
)["libraries"]

# Closed enum: a violation is one of these, never prose.
AGPL_IMPORT = "AGPL_IMPORT"
AGPL_EXECUTABLE = "AGPL_EXECUTABLE"
AGPL_LOCKFILE_ENTRY = "AGPL_LOCKFILE_ENTRY"


def shipped_modules() -> list[tuple[str, str]]:
    """Every shipped Python module: `cad/src/**`, which excludes `cad/tests/` by construction."""
    return [
        (str(path.relative_to(ROOT)), path.read_text(encoding="utf-8"))
        for path in sorted((CAD / "src").rglob("*.py"))
        if "__pycache__" not in path.parts
    ]


def _imported_names(source: str) -> set[str]:
    names: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            names.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
            names.add(node.module.split(".")[0])
        # importlib.import_module("fitz") evades the two statements above.
        elif isinstance(node, ast.Call):
            for arg in node.args:
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    names.add(arg.value.split(".")[0])
    return names


def _spawn_pattern(executable: str) -> str:
    """A banned executable named as a subprocess argument — mutool is a CLI, not an import."""
    name = re.escape(executable)
    return rf"""["'`]\s*{name}\b|\b{name}\s+[a-z]"""


def import_violations(modules: list[tuple[str, str]]) -> list[tuple[str, str, str]]:
    found: list[tuple[str, str, str]] = []
    for where, source in modules:
        names = _imported_names(source)
        for library in BANNED:
            named = f"{library['name']}, {library['licence']}"
            for name in library["imports"]:
                if name in names:
                    found.append((AGPL_IMPORT, where, f"{name} ({named})"))
            for executable in library["executables"]:
                if re.search(_spawn_pattern(executable), source):
                    found.append((AGPL_EXECUTABLE, where, f"{executable} ({named})"))
    return found


def manifest_violations(where: str, text: str) -> list[tuple[str, str, str]]:
    found: list[tuple[str, str, str]] = []
    for library in BANNED:
        for name in library["pypi"]:
            # A uv.lock package block, a pyproject dependency, or a wheel URL all bound the name.
            entry = rf"""["'/]{re.escape(name)}(["']|[-=<>~@\s])"""
            if re.search(entry, text, re.IGNORECASE):
                named = f"{library['name']}, {library['licence']}"
                found.append((AGPL_LOCKFILE_ENTRY, where, f"{name} ({named})"))
    return found


def test_scan_reaches_the_shipped_modules():
    """A silent zero is this test's failure mode: assert the walk found the package."""
    modules = dict(shipped_modules())
    assert "cad/src/vextrus_cad/ingest.py" in modules
    assert len(modules) >= 4


def test_no_shipped_module_imports_a_banned_library():
    assert import_violations(shipped_modules()) == []


def test_no_manifest_or_lockfile_carries_a_banned_library():
    for manifest in ("pyproject.toml", "uv.lock"):
        assert manifest_violations(manifest, (CAD / manifest).read_text(encoding="utf-8")) == []


def test_the_permitted_toolchain_is_what_is_declared():
    """ezdxf (MIT) is the DXF reader §1 names; a PDF library arriving here is the thing banned."""
    declared = tomllib.loads((CAD / "pyproject.toml").read_text(encoding="utf-8"))
    dependencies = declared["project"]["dependencies"]
    assert any(spec.startswith("ezdxf") for spec in dependencies)


def test_the_guardrail_fires_on_an_import():
    for source in (
        "import fitz\n",
        "import pymupdf as pdf\n",
        "from fitz import Document\n",
        "importlib.import_module('fitz')\n",
    ):
        found = import_violations([("cad/src/vextrus_cad/pdf.py", source)])
        assert [reason for reason, _, _ in found] == [AGPL_IMPORT], source


def test_the_guardrail_fires_on_a_subprocess():
    spawn = "subprocess.run(['mutool', 'draw'])\n"
    found = import_violations([("cad/src/vextrus_cad/pdf.py", spawn)])
    assert [reason for reason, _, _ in found] == [AGPL_EXECUTABLE]


def test_the_guardrail_passes_the_permitted_toolchain():
    permitted = "import ezdxf\nfrom ezdxf import recover\n"
    assert import_violations([("cad/src/vextrus_cad/x.py", permitted)]) == []


def test_the_guardrail_fires_on_a_lockfile_entry():
    lock = '[[package]]\nname = "pymupdf"\nversion = "1.26.0"\n'
    found = manifest_violations("uv.lock", lock)
    assert [reason for reason, _, _ in found] == [AGPL_LOCKFILE_ENTRY]
    assert manifest_violations("uv.lock", '[[package]]\nname = "ezdxf"\n') == []
