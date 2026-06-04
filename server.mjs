import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeJobsWithProfile, loadConfig, loadJobs } from "./src/pipeline.mjs";
import { buildResumeProfile } from "./src/profile.mjs";
import { toCsv } from "./src/io.mjs";
import { AuthStore } from "./src/server/auth-store.mjs";
import { parseMultipart, readRequestBody } from "./src/server/multipart.mjs";
import { serveStatic } from "./src/server/static.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, "public");
const uploadDir = path.join(rootDir, "uploads");
const port = Number(process.env.PORT || 4317);
const host = process.env.HOST || "127.0.0.1";
const authStore = new AuthStore(rootDir);

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function jsonWithHeaders(response, status, payload, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const body = await readRequestBody(request, 1024 * 1024);
  if (!body.length) return {};
  return JSON.parse(body.toString("utf8"));
}

async function requireUser(request, response) {
  const user = await authStore.getUserFromRequest(request);
  if (!user) {
    json(response, 401, { error: "Authentication required." });
    return null;
  }
  return user;
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

  try {
    const python = findPythonExecutable();
    const scriptPath = path.join(rootDir, "scripts", "extract_resume.py");

    return await new Promise((resolve, reject) => {
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
  } finally {
    await fs.rm(filePath, { force: true });
  }
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
  const user = await authStore.getUserFromRequest(request);

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
  const targetRoleInput = String(fields.targetRoleInput ?? "").trim();
  if (targetRoleInput) {
    config.targetRoleInput = targetRoleInput;
  }

  const resumeText = await extractResumeText(files.resume);
  if (resumeText.trim().length < 80) {
    json(response, 422, { error: "Could not extract enough text from the resume." });
    return;
  }

  const resumeProfile = buildResumeProfile(resumeText, config);
  if (user) {
    await authStore.saveProfile(user.id, {
      resumeTerms: resumeProfile.matchedConfiguredTerms,
      yearsExperience: resumeProfile.yearsExperience,
      seniority: resumeProfile.seniority,
      roleRecommendations: resumeProfile.roleRecommendations,
      searchTerms: resumeProfile.dynamicSearchTerms
    });
  }

  const uploadedJobs = parseJobsPayload(fields, files);
  const sourceResult = uploadedJobs
    ? { jobs: uploadedJobs, notices: ["Using uploaded jobs JSON."], sourceLinks: [] }
    : await loadJobs(rootDir, {
        sourcesPath: "config/sources.json",
        searchTerms: resumeProfile.dynamicSearchTerms,
        sourceIds: parseSelectedSources(fields.sourceIds)
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

function parseSelectedSources(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return String(value)
      .split(",")
      .map((sourceId) => sourceId.trim())
      .filter(Boolean);
  }
}

async function handleAuth(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/me") {
    const user = await authStore.getUserFromRequest(request);
    json(response, 200, { user });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/register") {
    try {
      const body = await readJsonBody(request);
      const user = await authStore.register(body);
      const login = await authStore.login({ username: body.username, password: body.password });
      jsonWithHeaders(response, 200, { user }, { "Set-Cookie": authStore.sessionCookie(login.session) });
    } catch (error) {
      const status = /already exists/i.test(error.message) ? 409 : 400;
      json(response, status, { error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/login") {
    try {
      const body = await readJsonBody(request);
      const { user, session } = await authStore.login(body);
      jsonWithHeaders(response, 200, { user }, { "Set-Cookie": authStore.sessionCookie(session) });
    } catch (error) {
      json(response, 401, { error: error.message });
    }
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/logout") {
    await authStore.logout(request);
    jsonWithHeaders(response, 200, { ok: true }, { "Set-Cookie": authStore.clearSessionCookie() });
    return true;
  }

  return false;
}

async function handleApplications(request, response, url) {
  if (!url.pathname.startsWith("/api/applications")) return false;

  const user = await requireUser(request, response);
  if (!user) return true;

  if (request.method === "GET" && url.pathname === "/api/applications") {
    json(response, 200, { applications: await authStore.listApplications(user.id) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/applications") {
    const body = await readJsonBody(request);
    const application = await authStore.saveApplication(user.id, body);
    json(response, 200, { application });
    return true;
  }

  if (request.method === "DELETE") {
    const id = url.pathname.replace("/api/applications/", "");
    await authStore.deleteApplication(user.id, id);
    json(response, 200, { ok: true });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/api/health") {
      json(response, 200, { ok: true });
      return;
    }

    if (await handleAuth(request, response, url)) return;
    if (await handleApplications(request, response, url)) return;

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

server.listen(port, host, () => {
  console.log(`Job Agent is running at http://${host}:${port}`);
});
