# NODE_ENV set in the environment breaks `next build`

**Summary:** with `NODE_ENV=development` exported, `next build` prerenders with React's dev
bundles and dies inside the renderer with a shapeshifting null-dispatcher throw. Unset it.

**Observed:** 2026-08-12, a cloud sandbox with `NODE_ENV=development` in its image; `pnpm
verify` was green and `pnpm build` failed at static prerender.

**How it presents:** the throw lands wherever the prerender first touches a hook, so the frame
it names is never the fault (`useContext` of null on `/_global-error` under one Node, `length`
of null on `/` under another — one fault, two stories). The signature is a storm of `unique
"key" prop` warnings naming `<html>`/`<head>`/`<meta>` just before the throw: only dev React
emits those, so seeing them during a *build* is the diagnosis.

**Fix:** never set `NODE_ENV` in the environment; Next chooses its own mode per command.
`pnpm checkup` reports it as BROKEN when set.
