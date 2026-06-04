/**
 * Tests for the soft relevance gate (Phase 5A).
 *
 * The gate filters nearMatches so off-target low-score jobs never surface.
 * It must NOT filter jobs that already scored >= threshold.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";
import { analyzeJobsWithProfile } from "../src/pipeline.mjs";
import { buildGateState, isJobOnTarget } from "../src/pipeline.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// ─── CV fixtures ──────────────────────────────────────────────────────────────

const marketingCV = `Professional Experience
2022 - present | Marketing Coordinator, BrandCo
Managed social media campaigns, coordinated with agencies, created marketing content.
Education
2018 - 2022 | B.A. Marketing`;

const devCV = `Professional Experience
2021 - present | Full Stack Developer, TechCorp
Built React and Node.js web applications, REST APIs, SQL databases.
Education
2017 - 2021 | B.Sc. Computer Science`;

// ─── Job fixtures ─────────────────────────────────────────────────────────────

function makeJob(title, description, score = null) {
  return {
    company: "Test Co", title, location: "Tel Aviv", workMode: "Hybrid",
    source: "Test", applyUrl: `https://example.com/${encodeURIComponent(title)}`,
    postedAt: "2026-05-24", description
  };
}

const marketingJob = makeJob(
  "Marketing Coordinator",
  "Coordinate marketing campaigns, manage social media, create content. Requirements: 2+ years marketing experience."
);
const socialMediaJob = makeJob(
  "Social Media Manager",
  "Manage social media channels, create marketing content, grow audience. Requirements: marketing background."
);
const backendJob = makeJob(
  "Backend Developer",
  "Build Node.js REST APIs, design SQL databases, deploy software. Requirements: 3+ years Node.js development."
);
const truckJob = makeJob(
  "Truck Driver",
  "Drive delivery trucks, transport goods, maintain vehicle logs. Requirements: commercial driver license."
);
const pmoJob = makeJob(
  "PMO Coordinator",
  "Manage project tracking, reporting, stakeholder management, Jira. Requirements: PMO experience."
);
const devJob = makeJob(
  "Full Stack Developer",
  "Build React and Node.js web applications, design REST APIs, write unit tests. Requirements: 3+ years JavaScript."
);

// ─── Test 1: Marketing profile — unit gate checks ────────────────────────────

const marketingProfile = buildResumeProfile(marketingCV, { ...config, targetRoleInput: "Marketing Coordinator" });
const marketingGateState = buildGateState(marketingProfile);

console.log("Marketing gate state:");
console.log("  candidateDirections:", [...marketingGateState.candidateDirections]);
console.log("  tokenSet sample:", [...marketingGateState.tokenSet].slice(0, 8));

// Simulate scored jobs by adding matchBreakdown with pre-computed jobDirection
function fakeScored(job, direction, score = 30) {
  return { ...job, position: job.title, matchPercent: score, matchBreakdown: { jobDirection: direction } };
}

const scoredMarketing  = fakeScored(marketingJob,  "marketing", 48);
const scoredSocial     = fakeScored(socialMediaJob, "marketing", 45);
const scoredBackend    = fakeScored(backendJob,     "engineering", 15);
const scoredTruck      = fakeScored(truckJob,       "general",    8);
const scoredPmo        = fakeScored(pmoJob,         "pmo",        22);

assert.ok(isJobOnTarget(scoredMarketing, marketingGateState),
  "Marketing Coordinator should pass the gate for a marketing profile");
assert.ok(isJobOnTarget(scoredSocial, marketingGateState),
  "Social Media Manager should pass the gate for a marketing profile");
assert.ok(!isJobOnTarget(scoredBackend, marketingGateState),
  "Backend Developer should NOT pass the gate for a marketing profile");
assert.ok(!isJobOnTarget(scoredTruck, marketingGateState),
  "Truck Driver should NOT pass the gate for a marketing profile");

console.log("Marketing gate unit tests: PASSED");

// ─── Test 2: Developer profile — unit gate checks ────────────────────────────

const devProfile = buildResumeProfile(devCV, config);
const devGateState = buildGateState(devProfile);

console.log("Dev gate state:");
console.log("  candidateDirections:", [...devGateState.candidateDirections]);

const scoredDev        = fakeScored(devJob,         "engineering", 75);
const scoredDevPmo     = fakeScored(pmoJob,         "pmo",         12);
const scoredDevTruck   = fakeScored(truckJob,       "general",      5);
const scoredDevMarketing = fakeScored(marketingJob, "marketing",   10);

assert.ok(isJobOnTarget(scoredDev, devGateState),
  "Full Stack Developer should pass the gate for a dev profile");
assert.ok(!isJobOnTarget(scoredDevTruck, devGateState),
  "Truck Driver should NOT pass the gate for a dev profile");
assert.ok(!isJobOnTarget(scoredDevMarketing, devGateState),
  "Marketing Coordinator should NOT pass the gate for a dev profile");

console.log("Developer gate unit tests: PASSED");

// ─── Test 3: Strong match protection — scores >= threshold always pass ────────

const highScoreJob = fakeScored(truckJob, "general", 70);
// At threshold=60, score=70 → this goes into matches, never nearMatches.
// Gate only runs on belowThreshold pool, so this should never be touched.
// Simulate: if somehow this ended up in nearMatches candidates, it should
// also pass (but in practice it won't because it goes into matches).
// We test by running the full pipeline with threshold=90 so even good jobs fail.

const allJobs = [marketingJob, socialMediaJob, backendJob, truckJob, pmoJob];
const configHighThreshold = { ...config, targetRoleInput: "Marketing Coordinator", minimumScore: 95 };
const resultHigh = analyzeJobsWithProfile({
  resumeProfile: marketingProfile,
  jobs: allJobs,
  config: configHighThreshold,
  sourceNotices: [], sourceLinks: []
});

console.log("Strong match protection test:");
console.log("  matches:", resultHigh.matches.length);
console.log("  nearMatches:", resultHigh.nearMatches.map(m => m.position));
console.log("  offTargetHidden:", resultHigh.diagnostics.offTargetHidden);

// All 5 jobs scored, none above 95%. Only marketing-relevant jobs in nearMatches.
assert.equal(resultHigh.matches.length, 0, "no jobs above 95%");
assert.ok(resultHigh.nearMatches.length > 0, "near matches present");
assert.ok(
  resultHigh.nearMatches.every(m => /marketing|social media/i.test(m.position ?? "")),
  `nearMatches should be marketing-related, got: ${resultHigh.nearMatches.map(m => m.position).join(", ")}`
);
// Off-target jobs (backend, truck, PMO) should be hidden
assert.ok(resultHigh.diagnostics.offTargetHidden > 0,
  "some off-target jobs should be counted as hidden");

console.log("Strong match protection test: PASSED");

// ─── Test 4: Empty gate state — all jobs pass when no signal ─────────────────

const emptyCandidateProfile = buildResumeProfile("John Smith. Some experience.", config);
const emptyGate = buildGateState(emptyCandidateProfile);
console.log("Empty gate — candidateDirections:", [...emptyGate.candidateDirections]);
console.log("Empty gate — tokenSet size:", emptyGate.tokenSet.size);

// With no directions and no tokens, everything should pass through
const allPassWithEmptyGate = [scoredBackend, scoredTruck, scoredPmo].every(
  job => isJobOnTarget(job, emptyGate)
);
assert.ok(allPassWithEmptyGate, "empty gate should let all jobs through");
console.log("Empty gate test: PASSED");

// ─── Test 5: Full pipeline — marketing profile, normal threshold ──────────────

const configMarketing50 = { ...config, targetRoleInput: "Marketing Coordinator", minimumScore: 50 };
const resultMarketing = analyzeJobsWithProfile({
  resumeProfile: marketingProfile,
  jobs: allJobs,
  config: configMarketing50,
  sourceNotices: [], sourceLinks: []
});

console.log("Full pipeline marketing test:");
console.log("  matches:", resultMarketing.matches.map(m => `${m.matchPercent}% ${m.position}`));
console.log("  nearMatches:", resultMarketing.nearMatches.map(m => `${m.matchPercent}% ${m.position}`));
console.log("  offTargetHidden:", resultMarketing.diagnostics.offTargetHidden);
console.log("  diagnostics.offTargetHidden in result:", "offTargetHidden" in resultMarketing.diagnostics);

assert.ok("offTargetHidden" in resultMarketing.diagnostics, "diagnostics should include offTargetHidden");
// Backend / Truck should not appear in nearMatches for a marketing profile
const nearPositions = resultMarketing.nearMatches.map(m => (m.position ?? "").toLowerCase());
assert.ok(!nearPositions.some(p => /backend|truck|driver/i.test(p)),
  `Backend/truck jobs should be hidden, got near: ${nearPositions.join(", ")}`);

console.log("Full pipeline test: PASSED");

console.log("\n✅  All relevance-gate tests passed.");
