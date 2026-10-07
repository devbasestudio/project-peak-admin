import assert from "node:assert/strict";
import test from "node:test";
import { readAllPages } from "../src/lib/read-all-pages.ts";

test("workouts retain all exercises after the first 1000 database rows", async () => {
  const stored = Array.from({ length: 1096 }, (_, id) => ({ id, workout_id: Math.floor(id / 6) }));
  const ranges = [];
  const rows = await readAllPages(async (from, to) => {
    ranges.push([from, to]);
    return { data: stored.slice(from, Math.min(to + 1, from + 1000)), error: null };
  });
  assert.deepEqual(rows, stored);
  assert.equal(new Set(rows.map((row) => row.id)).size, 1096);
  assert.deepEqual(ranges, [[0, 499], [500, 999], [1000, 1499]]);
  assert.equal(rows.filter((row) => row.workout_id === 182).length, 4);
});

test("empty and exact-page results terminate without duplicating records", async () => {
  for (const size of [0, 500, 1000]) {
    const stored = Array.from({ length: size }, (_, id) => ({ id }));
    let calls = 0;
    const rows = await readAllPages(async (from, to) => {
      calls += 1;
      return { data: stored.slice(from, to + 1), error: null };
    });
    assert.deepEqual(rows, stored);
    assert.equal(calls, size / 500 + 1);
  }
});

test("failed later pages never return partial exercises as a successful result", async () => {
  const failure = new Error("Page failed");
  await assert.rejects(readAllPages(async (from) => from === 0
    ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
    : { data: null, error: failure }), failure);
  await assert.rejects(readAllPages(async () => ({ data: null, error: null })), /incomplete result/);
});
