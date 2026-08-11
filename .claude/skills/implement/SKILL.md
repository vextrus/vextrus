---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

Implement the work described by the user in the spec or tickets.

Use /tdd where possible, at pre-agreed seams.

Run `pnpm verify` regularly while working — it is seconds, run it freely — and once at the
end, in the foreground, reading the exit code. If the work touched the schema or the tenant
seam, run `pnpm test:db` too (compose up + `pnpm db:migrate` first).

Once done, use /code-review to review the work.

Commit your work to the current branch — explicit paths, never `git add -A`.
