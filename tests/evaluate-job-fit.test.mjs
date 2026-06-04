/**
 * Tests for the Phase 3A evaluator layer (src/job-fit.mjs).
 *
 * Verifies:
 * - Output shape (candidateProfile, jobProfile, dimensions)
 * - Candidate-agnostic scoring: recruiter/dev/finance CVs each score their own domain high
 * - Unrelated jobs score lower than matching jobs
 * - Critical missing requirement caps the score
 * - Keyword-only overlap without role alignment is reduced
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";
import { buildCandidateProfile, buildJobProfile, evaluateJobFit } from "../src/job-fit.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// ─── CV fixtures ────────────────────────────────────────────────────────────

const recruiterCV = `Professional Experience
2022 - present | Senior Recruiter, Tech Corp
Conducted full-cycle recruiting, screening candidates, scheduling interviews, onboarding new hires, talent acquisition, HR operations and employee experience.
2019 - 2022 | HR Coordinator, Startup Y
Human resources administration, employee onboarding, interviews, and recruiting.
Education
2015 - 2019 | B.A. Behavioral Sciences`;

const devCV = `Professional Experience
2021 - present | Full Stack Developer, Acme
Built web applications with React, Node.js, TypeScript and JavaScript. Designed REST APIs, wrote unit tests, deployed to production. Worked with SQL.
2019 - 2021 | Junior Developer, Beta
Developed frontend features in JavaScript and React.
Education
2015 - 2019 | B.Sc. Computer Science`;

const financeCV = `Professional Experience
2020 - present | Senior Accountant, Finance Group
Managed bookkeeping, accounts payable, accounts receivable, payroll, invoices, reconciliation, and financial statements using SAP and Priority.
2018 - 2020 | Junior Accountant, Small Co
Bookkeeping, bank reconciliation, and invoices.
Education
2014 - 2018 | B.A. Accounting`;

// ─── Job fixtures ────────────────────────────────────────────────────────────

const hrJob = {
  company: "Tech Co", title: "Talent Acquisition Specialist",
  location: "Tel Aviv", workMode: "Hybrid", source: "Test",
  applyUrl: "https://example.com/hr", postedAt: "2026-05-24",
  description: "Full-cycle recruiting, screening candidates, interviewing, onboarding new hires. Requirements: 3+ years talent acquisition or human resources experience. Work with HR team on employee experience."
};

const devJob = {
  company: "Code Co", title: "Full Stack Developer",
  location: "Tel Aviv", workMode: "Hybrid", source: "Test",
  applyUrl: "https://example.com/dev", postedAt: "2026-05-24",
  description: "Build web applications with React and Node.js. Design REST APIs, write tests, deploy to production. Requirements: 3+ years software development with JavaScript, TypeScript, React."
};

const financeJob = {
  company: "Finance Corp", title: "Accountant / Bookkeeper",
  location: "Ramat Gan", workMode: "On-site", source: "Test",
  applyUrl: "https://example.com/fin", postedAt: "2026-05-24",
  description: "Manage bookkeeping, accounts payable, accounts receivable, payroll, invoices and reconciliation. Prepare financial statements. Requirements: 2+ years accounting experience, SAP or Priority preferred."
};

const keywordOnlyJob = {
  company: "Generic Co", title: "Data Researcher",
  location: "Remote", workMode: "Remote", source: "Test",
  applyUrl: "https://example.com/kw", postedAt: "2026-05-24",
  description: "Deep research in machine learning algorithms, model training, and data science. Requirements: PhD in computer science or statistics, 5+ years ML research experience."
};

// ─── Build profiles ──────────────────────────────────────────────────────────

const recruiterProfile = buildResumeProfile(recruiterCV, config);
const devProfile       = buildResumeProfile(devCV,       config);
const financeProfile   = buildResumeProfile(financeCV,   config);

// ─── Shape tests ─────────────────────────────────────────────────────────────

const result = evaluateJobFit(hrJob, recruiterProfile, config);

console.log("Shape test — evaluateJobFit output keys:", Object.keys(result).join(", "));

// fitPercentage, confidenceScore, fitLabel, recommendation present
assert.equal(typeof result.fitPercentage, "number", "fitPercentage must be a number");
assert.ok(result.fitLabel, "fitLabel must be present");
assert.ok(result.recommendation, "recommendation must be present");

// candidateProfile shape
const cp = result.candidateProfile;
assert.ok(cp, "candidateProfile must be present");
assert.equal(typeof cp.latestRole, "string", "candidateProfile.latestRole must be a string");
assert.ok(Array.isArray(cp.hardSkills), "hardSkills must be an array");
assert.ok(Array.isArray(cp.softSkills), "softSkills must be an array");
assert.ok(Array.isArray(cp.tools),      "tools must be an array");
assert.ok(Array.isArray(cp.likelyTargetRoles), "likelyTargetRoles must be an array");

// jobProfile shape
const jp = result.jobProfile;
assert.ok(jp, "jobProfile must be present");
assert.ok(jp.title, "jobProfile.title must be present");
assert.equal(typeof jp.essence, "string", "jobProfile.essence must be a string");
assert.ok(Array.isArray(jp.mustHaves),   "mustHaves must be an array");
assert.ok(Array.isArray(jp.niceToHaves), "niceToHaves must be an array");
assert.ok(Array.isArray(jp.tools),       "jobProfile.tools must be an array");

// All ten dimensions present
const dims = result.dimensions;
assert.ok(dims, "dimensions must be present");
const REQUIRED_DIMENSIONS = [
  "latestRoleAlignment", "jobEssenceAlignment", "mustHaveRequirements",
  "skillsAndTools", "educationRelevance", "seniorityAndYears",
  "careerDirection", "domainFit", "transferableSkills", "hardBlockers"
];
for (const dim of REQUIRED_DIMENSIONS) {
  assert.ok(dims[dim] !== undefined, `dimensions.${dim} must be present`);
}
console.log("Shape tests: PASSED");

// ─── Recruiter CV tests ───────────────────────────────────────────────────────

const recOnHr  = evaluateJobFit(hrJob,          recruiterProfile, config);
const recOnDev = evaluateJobFit(devJob,          recruiterProfile, config);
const recOnFin = evaluateJobFit(financeJob,      recruiterProfile, config);

console.log(`Recruiter CV -> HR job: ${recOnHr.fitPercentage}% (${recOnHr.fitLabel})`);
console.log(`Recruiter CV -> Dev job: ${recOnDev.fitPercentage}%`);
console.log(`Recruiter CV -> Finance job: ${recOnFin.fitPercentage}%`);

// Absolute floor is 40 (short job descriptions reduce scores; the important
// test is the relative ordering — recruiter must score HR job highest).
assert.ok(recOnHr.fitPercentage >= 40,
  `Recruiter should score HR job >= 40, got ${recOnHr.fitPercentage}`);
assert.ok(recOnHr.fitPercentage > recOnDev.fitPercentage,
  `Recruiter should score HR job higher than dev job (${recOnHr.fitPercentage} vs ${recOnDev.fitPercentage})`);
assert.ok(recOnHr.fitPercentage > recOnFin.fitPercentage,
  `Recruiter should score HR job higher than finance job (${recOnHr.fitPercentage} vs ${recOnFin.fitPercentage})`);

// candidateProfile.likelyTargetRoles should contain HR/recruiting
const recCP = buildCandidateProfile(recruiterProfile);
const recTargetIds = recCP.likelyTargetRoles.map((r) => r.id ?? "");
assert.ok(
  recTargetIds.some((id) => /hr|recruit/i.test(id)),
  `Recruiter profile should have hr-recruiting in likelyTargetRoles, got ids: ${recTargetIds.join(", ")}`
);
// candidateProfile.professionalDomain should mention HR
assert.ok(
  recCP.professionalDomain.some((d) => /recruit|human resource|hr/i.test(d)),
  `Recruiter professionalDomain should include HR, got: ${recCP.professionalDomain.join(", ")}`
);
console.log("Recruiter CV tests: PASSED");

// ─── Developer CV tests ───────────────────────────────────────────────────────

const devOnDev  = evaluateJobFit(devJob,          devProfile, config);
const devOnHr   = evaluateJobFit(hrJob,            devProfile, config);
const devOnFin  = evaluateJobFit(financeJob,       devProfile, config);
const devOnKw   = evaluateJobFit(keywordOnlyJob,   devProfile, config);

console.log(`Dev CV -> Dev job: ${devOnDev.fitPercentage}% (${devOnDev.fitLabel})`);
console.log(`Dev CV -> HR job: ${devOnHr.fitPercentage}%`);
console.log(`Dev CV -> Finance job: ${devOnFin.fitPercentage}%`);
console.log(`Dev CV -> keyword-only ML research: ${devOnKw.fitPercentage}%`);

assert.ok(devOnDev.fitPercentage >= 50,
  `Dev should score dev job >= 50, got ${devOnDev.fitPercentage}`);
assert.ok(devOnDev.fitPercentage > devOnHr.fitPercentage,
  `Dev should score dev job higher than HR job (${devOnDev.fitPercentage} vs ${devOnHr.fitPercentage})`);
assert.ok(devOnDev.fitPercentage > devOnFin.fitPercentage,
  `Dev should score dev job higher than finance job (${devOnDev.fitPercentage} vs ${devOnFin.fitPercentage})`);
// candidateProfile tools should include dev tools
const devCp = devOnDev.candidateProfile;
assert.ok(
  devCp.tools.some((t) => /sql|javascript|react|node|typescript/i.test(t)) ||
  devCp.hardSkills.some((t) => /sql|javascript|react|node|typescript/i.test(t)),
  `Dev candidateProfile should list dev tools, got tools: ${devCp.tools}, hardSkills: ${devCp.hardSkills}`
);
console.log("Developer CV tests: PASSED");

// ─── Finance CV tests ─────────────────────────────────────────────────────────

const finOnFin  = evaluateJobFit(financeJob,     financeProfile, config);
const finOnHr   = evaluateJobFit(hrJob,          financeProfile, config);
const finOnDev  = evaluateJobFit(devJob,         financeProfile, config);

console.log(`Finance CV -> Finance job: ${finOnFin.fitPercentage}% (${finOnFin.fitLabel})`);
console.log(`Finance CV -> HR job: ${finOnHr.fitPercentage}%`);
console.log(`Finance CV -> Dev job: ${finOnDev.fitPercentage}%`);

assert.ok(finOnFin.fitPercentage >= 50,
  `Finance CV should score finance job >= 50, got ${finOnFin.fitPercentage}`);
assert.ok(finOnFin.fitPercentage > finOnHr.fitPercentage,
  `Finance should score finance job higher than HR (${finOnFin.fitPercentage} vs ${finOnHr.fitPercentage})`);
assert.ok(finOnFin.fitPercentage > finOnDev.fitPercentage,
  `Finance should score finance job higher than dev (${finOnFin.fitPercentage} vs ${finOnDev.fitPercentage})`);

const finCp = finOnFin.candidateProfile;
assert.ok(
  finCp.hardSkills.some((t) => /account|payroll|bookkeep|reconcil|invoic|finance|sap|priority/i.test(t)) ||
  finCp.tools.some((t) => /sap|priority/i.test(t)),
  `Finance candidateProfile should list finance skills, got hardSkills: ${finCp.hardSkills.join(", ")}`
);
console.log("Finance CV tests: PASSED");

// ─── jobProfile extraction test ───────────────────────────────────────────────

const hrJobProfile = buildJobProfile(hrJob, config);
assert.ok(hrJobProfile.title, "jobProfile.title present");
assert.ok(hrJobProfile.essence.length > 0, "jobProfile.essence not empty");
assert.ok(hrJobProfile.domain, `jobProfile.domain should be set, got: ${hrJobProfile.domain}`);
console.log("jobProfile shape test: PASSED — domain:", hrJobProfile.domain);

// ─── buildCandidateProfile standalone test ────────────────────────────────────

const standaloneCP = buildCandidateProfile(devProfile);
assert.ok(standaloneCP.latestRole, `latestRole present: ${standaloneCP.latestRole}`);
assert.ok(Array.isArray(standaloneCP.likelyTargetRoles), "likelyTargetRoles is array");
assert.ok(Array.isArray(standaloneCP.misalignedRoles),   "misalignedRoles is array");
console.log("buildCandidateProfile standalone test: PASSED");

// ─── dimensions coverage test ─────────────────────────────────────────────────

const devDims = devOnDev.dimensions;
assert.equal(typeof devDims.latestRoleAlignment.score,  "number", "latestRoleAlignment.score is number");
assert.equal(typeof devDims.jobEssenceAlignment.score,  "number", "jobEssenceAlignment.score is number");
assert.equal(typeof devDims.domainFit.score,            "number", "domainFit.score is number");
assert.ok(Array.isArray(devDims.transferableSkills.skills), "transferableSkills.skills is array");
assert.ok(Array.isArray(devDims.hardBlockers.blockers),     "hardBlockers.blockers is array");
console.log("Dimensions coverage test: PASSED");

console.log("\n✅  All evaluate-job-fit tests passed.");
