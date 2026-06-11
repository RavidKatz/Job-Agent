import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4389;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const TARGET_ROLE_REQUIRED_MESSAGE = "Please enter the role you are looking for, e.g. Recruiter, Product Manager, Junior Project Manager, Full Stack Developer.";

function buildMultipart(parts) {
  const boundary = `----job-agent-${Date.now()}`;
  const chunks = [];

  for (const part of parts) {
    chunks.push(`--${boundary}\r\n`);
    if (part.filename) {
      chunks.push(`Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`);
      chunks.push(`Content-Type: ${part.contentType ?? "application/octet-stream"}\r\n\r\n`);
      chunks.push(part.value);
      chunks.push("\r\n");
    } else {
      chunks.push(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`);
      chunks.push(String(part.value));
      chunks.push("\r\n");
    }
  }

  chunks.push(`--${boundary}--\r\n`);
  return {
    boundary,
    body: Buffer.concat(chunks.map((chunk) => Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
  };
}

async function waitForHealth(child) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Server did not become healthy for target role validation test.");
}

const child = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(PORT),
    ANTHROPIC_API_KEY: ""
  },
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth(child);

  const missingTarget = buildMultipart([
    { name: "minimumScore", value: "60" },
    { name: "sourceIds", value: JSON.stringify(["hiremetech"]) },
    {
      name: "resume",
      filename: "broken.pdf",
      contentType: "application/pdf",
      value: Buffer.from("%PDF-this-is-not-a-valid-resume")
    }
  ]);

  const response = await fetch(`${BASE_URL}/api/match`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${missingTarget.boundary}`
    },
    body: missingTarget.body
  });

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.error, TARGET_ROLE_REQUIRED_MESSAGE);

  console.log("All server target role validation tests passed.");
} finally {
  child.kill();
}
