# A "port free" probe must bind, not connect

**Summary:** testing whether anything *listens* on a port says nothing about whether the port
can be *bound*. A checkup that only connects called a reserved port free minutes before `pnpm
dev` died on it with `EACCES`.

**Observed:** 2026-08-16, on the Windows host that preceded this WSL2 setup: 3210 sat inside a
dynamically reserved range; the probe connected, got refused, and reported `[ok] port free`.

**Fix:** `scripts/checkup.mjs` binds a listener on 3210 and closes it. The reserved-range cause
is Windows-specific and gone under WSL2 with a native Postgres; the probe shape is not.
