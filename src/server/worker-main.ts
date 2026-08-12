import { runWorker } from "./worker";

/**
 * `pnpm worker`'s entry point — a separate file so that importing the worker
 * (tests, the app) never starts a polling loop as a side effect.
 */
const controller = new AbortController();
process.on("SIGINT", () => controller.abort());
process.on("SIGTERM", () => controller.abort());

console.log("ingest worker: polling");
await runWorker(controller.signal);
console.log("ingest worker: stopped");
