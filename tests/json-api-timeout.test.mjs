import assert from "node:assert/strict";
import { loadJsonApiJobs } from "../src/connectors/json-api.mjs";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (url, request) => {
    assert.equal(String(url), "https://example.com/jobs");
    assert.ok(request.signal, "fetch should receive an abort signal");
    return new Promise((resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
  };

  await assert.rejects(
    () => loadJsonApiJobs({
      id: "slow-api",
      url: "https://example.com/jobs",
      arrayPath: "jobs",
      timeoutMs: 5
    }),
    /aborted/
  );

  console.log("All json-api timeout tests passed.");
} finally {
  globalThis.fetch = originalFetch;
}
