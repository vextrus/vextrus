# A clone does not use `.githooks/`

**Summary:** git reads `.git/hooks`; `core.hooksPath` is repository-local config no checkout
carries. A committed hook is inert until something sets the path, and a hook file without the
executable bit is skipped in silence even then.

**Observed:** 2026-08-12. A committed pre-push guard had never run on any Linux machine.

**Fix:** this repo ships no hooks. If one is ever added, whatever provisions the machine must
set `core.hooksPath`, read it back, and test the executable bit — and `pnpm checkup` must say
which state the clone is in.
