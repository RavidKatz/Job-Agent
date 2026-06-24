/**
 * source-parallel-timeout.test.mjs
 *
 * Proves the Phase 1 orchestration fix in src/connectors/index.mjs:
 *   - sources load in parallel (Promise.allSettled)
 *   - each source has an aggregate per-source timeout (withTimeout)
 *   - a slow/hanging source does NOT block the whole scan
 *   - a fast source still returns its jobs
 *   - a throwing/timing-out source produces a notice, scan continues
 *   - total runtime is bounded by the per-source timeout, not the sum
 *   - partial results are returned with the existing return shape
 *
 * Uses a local http server (fast + hanging routes) so the real
 * loadJobsFromSources -> jsonApi connector -> fetch path is exercised.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { loadJobsFromSources, withTimeout } from "../src/connectors/index.mjs";

// ---------------------------------------------------------------------------
// withTimeout unit checks
// ---------------------------------------------------------------------------
{
  const fast = await withTimeout(Promise.resolve("ok"), 1000);
  assert.equal(fast, "ok", "withTimeout resolves when promise wins the race");
}

{
  const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 500));
  await assert.rejects(
    () => withTimeout(slow, 80),
    /timed out/i,
    "withTimeout rejects when the timeout wins"
  );
}

{
  // Bounded: a 500ms promise raced against an 80ms timeout rejects near 80ms.
  const started = Date.now();
  const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 500));
  await withTimeout(slow, 80).catch(() => {});
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 300, `withTimeout is bounded by the timeout (elapsed ${elapsed}ms)`);
}

console.log("✅  withTimeout unit checks passed.");

// ---------------------------------------------------------------------------
// Orchestration checks via loadJobsFromSources with a local server
// ---------------------------------------------------------------------------
const sockets = new Set();
const server = http.createServer((req, res) => {
  if (req.url.startsWith("/fast")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      jobs: [{
        title: "Project Coordinator",
        company: "Acme Ltd",
        description: "A real role with enough description text to be usable for matching."
      }]
    }));
    return;
  }
  // /hang: accept the request but respond far later than the per-source timeout.
  setTimeout(() => {
    if (!res.writableEnded) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jobs: [] }));
    }
  }, 3000).unref();
});

server.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

// Temp sources.json (NOT the project config) with a hanging + a fast source.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "job-agent-src-test-"));
const sourcesPath = "sources.json";
fs.writeFileSync(path.join(tmpDir, sourcesPath), JSON.stringify({
  sources: [
    {
      id: "hang",
      type: "jsonApi",
      enabled: true,
      useProfileSearchTerms: false,
      url: `${base}/hang`,
      arrayPath: "jobs",
      sourceTimeoutMs: 300,
      fieldMap: { title: "title", company: "company", description: "description" }
    },
    {
      id: "fast",
      type: "jsonApi",
      enabled: true,
      useProfileSearchTerms: false,
      url: `${base}/fast`,
      arrayPath: "jobs",
      sourceTimeoutMs: 300,
      fieldMap: { title: "title", company: "company", description: "description" }
    }
  ]
}));

try {
  const started = Date.now();
  const result = await loadJobsFromSources({
    rootDir: tmpDir,
    sourcesPath,
    searchTerms: ["project coordinator"],
    sourceIds: ["hang", "fast"]
  });
  const elapsed = Date.now() - started;

  // Return shape preserved.
  assert.ok(Array.isArray(result.jobs), "returns jobs array");
  assert.ok(Array.isArray(result.notices), "returns notices array");
  assert.ok(Array.isArray(result.sourceLinks), "returns sourceLinks array");

  // Fast source still returns jobs (partial results despite the hanging source).
  assert.ok(result.jobs.length >= 1, "fast source jobs are returned");
  assert.ok(
    result.jobs.some((job) => job.title === "Project Coordinator"),
    "the fast source job is present"
  );

  // Hanging source timed out and produced a notice; scan continued.
  assert.ok(
    result.notices.some((n) => /hang/.test(n) && /timed out/i.test(n)),
    `hanging source produced a timeout notice (notices: ${JSON.stringify(result.notices)})`
  );

  // Bounded by per-source timeout (300ms), NOT by the 3000ms hang.
  assert.ok(
    elapsed < 1500,
    `total runtime bounded by per-source timeout, not the sum (elapsed ${elapsed}ms)`
  );

  console.log(`✅  Orchestration checks passed (scan completed in ${elapsed}ms).`);
} finally {
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log("\n✅  All source-parallel-timeout tests passed.");
