import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 4389;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const INFERENCE_FAILED_MESSAGE = "We could not confidently detect your target role from the CV. Please add the role you are looking for, e.g. Recruiter, Product Manager, Junior Project Manager, Full Stack Developer.";

const WEAK_RESUME_TEXT = `John Smith
Experience: various roles over the years across several places of work.
Education: B.A. General Studies. References available upon request.`;

const STRONG_DEV_RESUME_TEXT = `Professional Experience
2021 - present | Full Stack Developer, Acme Tech
Built web applications with React, Node.js, TypeScript and JavaScript.
Designed REST APIs, wrote unit tests, deployed to production. Used SQL.
2019 - 2021 | Junior Developer, Beta Co
Developed frontend features in JavaScript and React.
Education
2015 - 2019 | B.Sc. Computer Science`;

const STRONG_RESUME_TEXT = `Professional Experience
2022 - present | Senior Recruiter, Tech Corp
Conducted full-cycle recruiting, screening candidates, scheduling interviews,
onboarding new hires, talent acquisition, HR operations and employee experience.
2019 - 2022 | HR Coordinator, Startup Y
Human resources administration, employee onboarding, interviews, and recruiting.
Education
2015 - 2019 | B.A. Behavioral Sciences`;

const UPLOADED_JOBS = JSON.stringify([
  {
    company: "Tech Co",
    title: "Talent Acquisition Specialist",
    location: "Tel Aviv",
    workMode: "Hybrid",
    source: "Test",
    applyUrl: "https://example.com/hr",
    postedAt: "2026-05-24",
    description: "Full-cycle recruiting, screening candidates, interviewing, onboarding. Requirements: 3+ years talent acquisition or human resources experience."
  }
]);

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

async function postMatch(parts) {
  const { boundary, body } = buildMultipart(parts);
  const response = await fetch(`${BASE_URL}/api/match`, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`
    },
    body
  });
  return { response, payload: await response.json() };
}

function resumePart(text) {
  return {
    name: "resume",
    filename: "resume.txt",
    contentType: "text/plain",
    value: Buffer.from(text, "utf8")
  };
}

const basePart = [
  { name: "minimumScore", value: "60" },
  { name: "sourceIds", value: JSON.stringify([]) },
  { name: "jobsFile", filename: "jobs.json", contentType: "application/json", value: Buffer.from(UPLOADED_JOBS) }
];

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

  // (a) No target role + weak CV → 422 with the inference warning, no scan.
  const weak = await postMatch([...basePart, resumePart(WEAK_RESUME_TEXT)]);
  assert.equal(weak.response.status, 422);
  assert.equal(weak.payload.error, INFERENCE_FAILED_MESSAGE);
  console.log("weak CV without target role rejected: PASSED");

  // (b) No target role + strong CV → 200, roles inferred from CV evidence.
  const inferred = await postMatch([...basePart, resumePart(STRONG_RESUME_TEXT)]);
  assert.equal(inferred.response.status, 200);
  assert.ok(
    inferred.payload.resumeProfile?.roleRecommendations?.length > 0,
    "strong CV should yield inferred role recommendations"
  );
  console.log("strong CV without target role inferred and scanned: PASSED");

  // (c) Target role provided + weak CV → 200, target role wins.
  const explicit = await postMatch([
    ...basePart,
    { name: "targetRoleInput", value: "Recruiter" },
    resumePart(WEAK_RESUME_TEXT)
  ]);
  assert.equal(explicit.response.status, 200);
  assert.ok(
    explicit.payload.resumeProfile?.roleRecommendations?.some((r) => r.fromTargetRoleInput),
    "explicit target role should drive role recommendations"
  );
  console.log("explicit target role with weak CV accepted: PASSED");

  // (d) Strong developer CV + targetRoleInput "Recruiter" → recruiter direction wins.
  const override = await postMatch([
    ...basePart,
    { name: "targetRoleInput", value: "Recruiter" },
    resumePart(STRONG_DEV_RESUME_TEXT)
  ]);
  assert.equal(override.response.status, 200);
  const overrideRecs = override.payload.resumeProfile?.roleRecommendations ?? [];
  assert.equal(
    overrideRecs[0]?.id,
    "hr-recruiting",
    `targetRoleInput must outrank strong CV direction, got: ${overrideRecs.map((r) => r.id).join(", ")}`
  );
  assert.equal(
    override.payload.resumeProfile?.searchTerms?.[0],
    "Recruiter",
    "search terms must lead with the user-provided role"
  );
  assert.equal(override.payload.resumeProfile?.searchTermWarning, null, "no inference warning when targetRoleInput is provided");
  console.log("targetRoleInput wins over strong dev CV: PASSED");

  console.log("All server target role validation tests passed.");
} finally {
  child.kill();
}
