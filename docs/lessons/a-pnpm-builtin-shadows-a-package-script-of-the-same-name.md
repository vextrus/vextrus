# A pnpm built-in silently shadows a package script of the same name

**Summary:** `pnpm doctor` is a pnpm built-in; a `"doctor"` package script never runs, prints
nothing, exits 0. Check a new script name against `pnpm <name> --help` before adopting it.

**Observed:** 2026-08-12. The workspace check was first named `doctor`. pnpm's own `doctor`
("checks for known common issues") won, printed nothing at all and exited 0 — indistinguishable
from a script that ran and found everything fine.

**Fix:** the command is `pnpm checkup`. Any new script name is checked against pnpm's built-ins first.
