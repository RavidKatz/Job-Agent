import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeJobsWithProfile, loadConfig, loadJobs } from "./src/pipeline.mjs";
import { buildResumeProfile } from "./src/profile.mjs";
import { toCsv } from "./src/io.mjs";
import { parseMultipart, readRequestBody } from "./src/server/multipart.mjs";
import { serveStatic } from "./src/server/static.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(rootDir, "uploads");
const port = Number(process.env.PORT || 4317);

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sanitizeFilename(filename) {
  return filename.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(0, 120);
}

function findPythonExecutable() {
  const candidates = [
    process.env.PYTHON_EXE,
    process.env.PYTHON,
    path.join(process.env.USERPROFILE ?? "", ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"),
    "python"
  ].filter(Boolean);

  return candidates[0];
}

async function extractResumeText(file) {
  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${Date.now()}-${sanitizeFilename(file.filename)}`;
  const filePath = path.join(uploadDir, filename);
  await fs.writeFile(filePath, file.buffer);

  const python = findPythonExecutable();
  const scriptPath = path.join(rootDir, "scripts", "extract_resume.py");

  return new Promise((resolve, reject) => {
    const child = spawn(python, [scriptPath, filePath], { cwd: rootDir });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString("utf8") || `Resume extraction failed with code ${code}.`));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

function parseJobsPayload(fields, files) {
  if (fields.jobsJson?.trim()) {
    const parsed = JSON.parse(fields.jobsJson);
    if (!Array.isArray(parsed)) throw new Error("jobsJson must be a JSON array.");
    return parsed;
  }

  if (files.jobsFile?.buffer?.length) {
    const parsed = JSON.parse(files.jobsFile.buffer.toString("utf8"));
    if (!Array.isArray(parsed)) throw new Error("jobsFile must contain a JSON array.");
    return parsed;
  }

  return null;
}

async function handleMatch(request, response) {
  const body = await readRequestBody(request);
  const { fields, files } = parseMultipart(body, request.headers["content-type"] ?? "");

  if (!files.resume) {
    json(response, 400, { error: "Missing resume file." });
    return;
  }

  const config = await loadConfig(rootDir, "config/search-profile.json");
  const requestedMinimumScore = Number(fields.minimumScore);
  if (Number.isFinite(requestedMinimumScore)) {
    config.minimumScore = Math.max(0, Math.min(100, requestedMinimumScore));
  }

  const resumeText = await extractResumeText(files.resume);
  if (resumeText.trim().length < 80) {
    json(response, 422, { error: "Could not extract enough text from the resume." });
    return;
  }

  const resumeProfile = buildResumeProfile(resumeText, config);
  const uploadedJobs = parseJobsPayload(fields, files);
  const sourceResult = uploadedJobs
    ? { jobs: uploadedJobs, notices: ["Using uploaded jobs JSON."], sourceLinks: [] }
    : await loadJobs(rootDir, {
        sourcesPath: "config/sources.json",
        searchTerms: resumeProfile.dynamicSearchTerms
      });

  const analysis = analyzeJobsWithProfile({
    resumeProfile,
    jobs: sourceResult.jobs,
    config,
    sourceNotices: sourceResult.notices,
    sourceLinks: sourceResult.sourceLinks
  });

  json(response, 200, {
    ...analysis,
    csv: `\uFEFF${toCsv(analysis.matches)}`
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      json(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/match") {
      await handleMatch(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(response, publicDir, url.pathname);
      return;
    }

    json(response, 405, { error: "Method not allowed." });
  } catch (error) {
    json(response, 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Job Agent is running at http://127.0.0.1:${port}`);
});
