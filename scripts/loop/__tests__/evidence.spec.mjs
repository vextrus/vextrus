import { describe, expect, it } from "vitest";

import { effortLogFile } from "../evidence.mjs";

describe("effortLogFile — the committed home of a run's evidence", () => {
  it("derives the effort's log dir from a tickets directory", () => {
    expect(effortLogFile(".wayfinder/takeoff/tickets", "2026-08-13T12-00-00")).toBe(
      ".wayfinder/takeoff/log/2026-08-13T12-00-00.jsonl",
    );
  });

  it("derives the same effort from an arc directory, not a per-arc home", () => {
    // Arcs come and go; the effort is the unit that accumulates a history.
    expect(effortLogFile(".wayfinder/takeoff/arcs/rails", "r1")).toBe(".wayfinder/takeoff/log/r1.jsonl");
  });

  it("accepts Windows separators and an absolute prefix", () => {
    expect(effortLogFile("V:\\repos\\vextrus\\.wayfinder\\harness\\tickets", "r1")).toBe(
      ".wayfinder/harness/log/r1.jsonl",
    );
  });

  it("returns null for a directory outside .wayfinder — a scratch run banks nothing", () => {
    expect(effortLogFile("tmp/tickets", "r1")).toBeNull();
    expect(effortLogFile(".wayfinder", "r1")).toBeNull();
  });
});
