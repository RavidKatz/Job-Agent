/**
 * extract-timeout.test.mjs
 *
 * Proves that the timeout+kill guard in extractResumeText cannot hang forever.
 * Uses a real child process that never exits (node infinite-sleep) so the test
 * would stall without the guard, but resolves quickly with it.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// Mirror of the guard logic from server.mjs — tests the pattern in isolation
// so we don't need to export extractResumeText or spin up the full server.
function spawnWithTimeout(cmd, args, timeoutMs, stdoutCapBytes) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args);
    const stdout = [];
    let stdoutBytes = 0;
    let settled = false;

    function settle(fn, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(reject, new Error("timed out"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > stdoutCapBytes) {
        child.kill("SIGKILL");
        settle(reject, new Error("stdout cap exceeded"));
        return;
      }
      stdout.push(chunk);
    });

    child.on("error", (err) => settle(reject, err));

    child.on("close", (code) => {
      if (code !== 0 && code !== null) {
        settle(reject, new Error(`exited with code ${code}`));
        return;
      }
      settle(resolve, Buffer.concat(stdout).toString("utf8"));
    });
  });
}

// --- Test 1: hanging process is killed within the timeout window ---
{
  const start = Date.now();
  const TIMEOUT = 300; // short for tests

  // `node -e "setTimeout(()=>{},1e9)"` never exits on its own
  await assert.rejects(
    () => spawnWithTimeout("node", ["-e", "setTimeout(()=>{},1e9)"], TIMEOUT, 500_000),
    (err) => {
      assert.equal(err.message, "timed out");
      return true;
    }
  );

  const elapsed = Date.now() - start;
  assert.ok(
    elapsed < TIMEOUT + 500,
    `hanging process must be killed near the timeout, not left running (elapsed ${elapsed}ms)`
  );
  console.log(`  ✓ hanging process killed after ${elapsed}ms (timeout was ${TIMEOUT}ms)`);
}

// --- Test 2: stdout cap rejects before timeout fires ---
{
  const TIMEOUT = 5000;
  const CAP = 50; // 50 bytes — intentionally tiny

  // Write 200 bytes to stdout, well above the cap
  await assert.rejects(
    () => spawnWithTimeout("node", ["-e", `process.stdout.write("x".repeat(200)); process.exit(0)`], TIMEOUT, CAP),
    (err) => {
      assert.equal(err.message, "stdout cap exceeded");
      return true;
    }
  );
  console.log("  ✓ stdout cap rejects before timeout");
}

// --- Test 3: successful extraction resolves normally ---
{
  const text = await spawnWithTimeout(
    "node",
    ["-e", `process.stdout.write("hello cv text"); process.exit(0)`],
    5000,
    500_000
  );
  assert.equal(text, "hello cv text");
  console.log("  ✓ successful extraction resolves with output");
}

console.log("\n✅  All extract-timeout tests passed.");
