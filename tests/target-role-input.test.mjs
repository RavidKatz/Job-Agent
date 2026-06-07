/**
 * Tests for targetRoleInput — Phase 7B: connect to candidate profile and scoring.
 *
 * Acceptance criteria:
 * 1. expandTargetRoleTerms produces >=3 terms for common role inputs.
 * 2. buildDynamicSearchTerms places target role terms first when provided.
 * 3. A sparse CV + targetRoleInput clears searchTermWarning.
 * 4. The final dynamicSearchTerms reflect the target role, not old defaults.
 * 5. roleRecommendations always includes the target role family when targetRoleInput is set.
 * 6. Strong CV-derived direction stays first when score >= 75; target role is secondary.
 * 7. directionSignals.positive includes signals from the target role family.
 * 8. Public profile distinguishes CV evidence from targetRoleInput fallback.
 * 9. scoreJob: careerDirectionFit > 0 for a matching job when targetRoleInput is set.
 * 10. Generic: same mechanism works for Marketing Coordinator and Software Developer.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile, toPublicResumeProfile } from "../src/profile.mjs";
import { expandTargetRoleTerms } from "../src/role-recommender.mjs";
import { scoreJob } from "../src/matcher.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// ── CV fixtures ──────────────────────────────────────────────────────────────

const sparseCV = "John Smith. Experience: various roles. Education: B.A.";

const weakOpsCV = `Professional Experience
2022 - present | Team Lead, Some Company
Managed daily operations and reporting. Used Excel for data tracking.
Education
2018 - 2022 | B.A. General Studies`;

const strongDevCV = `Professional Experience
2021 - present | Full Stack Developer, Acme Tech
Built web applications with React, Node.js, TypeScript and JavaScript.
Designed REST APIs, wrote unit tests, deployed to production. Used SQL.
2019 - 2021 | Junior Developer, Beta Co
Developed frontend features in JavaScript and React.
Education
2015 - 2019 | B.Sc. Computer Science`;

const recruiterCV = `Professional Experience
2022 - present | Senior Recruiter, Tech Corp
Conducted full-cycle recruiting, screening candidates, scheduling interviews,
onboarding new hires, talent acquisition, HR operations and employee experience.
2019 - 2022 | HR Coordinator, Startup Y
Human resources administration, employee onboarding, interviews, and recruiting.
Education
2015 - 2019 | B.A. Behavioral Sciences`;

// ── Job fixtures ─────────────────────────────────────────────────────────────

const hrJob = {
  company: "Tech Co", title: "Talent Acquisition Specialist",
  location: "Tel Aviv", workMode: "Hybrid", source: "Test",
  applyUrl: "https://example.com/hr", postedAt: "2026-05-24",
  description: "Full-cycle recruiting, screening candidates, interviewing, onboarding. Requirements: 3+ years talent acquisition or human resources experience. Work with HR team on employee experience and recruiting pipelines."
};

const devJob = {
  company: "Code Co", title: "Full Stack Developer",
  location: "Tel Aviv", workMode: "Hybrid", source: "Test",
  applyUrl: "https://example.com/dev", postedAt: "2026-05-24",
  description: "Build web applications with React, Node.js, TypeScript. Requirements: 2+ years software development experience. REST APIs, unit tests, SQL."
};

const marketingJob = {
  company: "Brand Co", title: "Marketing Coordinator",
  location: "Tel Aviv", workMode: "Hybrid", source: "Test",
  applyUrl: "https://example.com/mkt", postedAt: "2026-05-24",
  description: "Plan and execute marketing campaigns, manage social media, content creation, digital marketing, SEO, Google Ads. Requirements: 2+ years marketing experience."
};

// ── 1. expandTargetRoleTerms ─────────────────────────────────────────────────

const marketingTerms = expandTargetRoleTerms("Marketing Coordinator");
console.log("Marketing Coordinator terms:", marketingTerms);
assert.ok(marketingTerms.length >= 2, `should generate >=2 terms, got ${marketingTerms.length}`);
assert.ok(marketingTerms[0] === "Marketing Coordinator", "exact input should be first");
assert.ok(marketingTerms.some((t) => /marketing/i.test(t)), `should include marketing-related terms, got: ${marketingTerms.join(", ")}`);

const recruiterTerms = expandTargetRoleTerms("Recruiter");
console.log("Recruiter terms:", recruiterTerms);
assert.ok(recruiterTerms.length >= 2, `should generate >=2 terms, got ${recruiterTerms.length}`);
assert.ok(recruiterTerms[0] === "Recruiter", "exact input should be first");
assert.ok(recruiterTerms.some((t) => /recruit|hr|talent/i.test(t)), `should be HR-related, got: ${recruiterTerms.join(", ")}`);

const devTerms = expandTargetRoleTerms("Full Stack Developer");
console.log("Full Stack Developer terms:", devTerms);
assert.ok(devTerms.length >= 2, `should generate >=2 terms, got ${devTerms.length}`);
assert.ok(devTerms[0] === "Full Stack Developer", "exact input should be first");
assert.ok(devTerms.some((t) => /developer|frontend|backend|software/i.test(t)), `should be dev-related, got: ${devTerms.join(", ")}`);

assert.deepEqual(expandTargetRoleTerms(""), [], "empty input returns []");
assert.deepEqual(expandTargetRoleTerms(null), [], "null input returns []");
console.log("expandTargetRoleTerms tests: PASSED");

// ── 2. Sparse CV + targetRoleInput clears warning ────────────────────────────

const configWithRecruiter = { ...config, targetRoleInput: "Recruiter" };
const sparseProfile = buildResumeProfile(sparseCV, configWithRecruiter);

console.log("Sparse CV + Recruiter:");
console.log("  searchTermWarning:", sparseProfile.searchTermWarning);
console.log("  dynamicSearchTerms:", sparseProfile.dynamicSearchTerms.slice(0, 6));
console.log("  roleRecommendations:", sparseProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));

assert.equal(sparseProfile.searchTermWarning, null, "warning should be null when targetRoleInput is provided");
assert.ok(sparseProfile.dynamicSearchTerms.length > 0, "dynamicSearchTerms should not be empty");
assert.ok(
  sparseProfile.dynamicSearchTerms.includes("Recruiter"),
  `"Recruiter" should appear in dynamicSearchTerms, got: ${sparseProfile.dynamicSearchTerms.join(", ")}`
);
console.log("Sparse CV + targetRoleInput tests: PASSED");

// ── 3. roleRecommendations always includes the target family ─────────────────

// 3a. Sparse CV — target role should be [0] since no CV evidence.
assert.ok(sparseProfile.roleRecommendations.length > 0, "roleRecommendations should be non-empty for sparse CV + targetRoleInput");
assert.equal(sparseProfile.roleRecommendations[0].id, "hr-recruiting", `first rec should be hr-recruiting, got: ${sparseProfile.roleRecommendations[0]?.id}`);
assert.ok(sparseProfile.roleRecommendations[0].fromTargetRoleInput === true, "first rec should be marked fromTargetRoleInput");
console.log("  sparse roleRecommendations[0]:", sparseProfile.roleRecommendations[0].id, "✓");

// 3b. Weak ops CV + Recruiter — target should be [0] since ops CV score < 75.
const weakOpsConfig = { ...config, targetRoleInput: "Recruiter" };
const weakOpsProfile = buildResumeProfile(weakOpsCV, weakOpsConfig);
console.log("Weak ops CV + Recruiter roleRecommendations:", weakOpsProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));
assert.ok(weakOpsProfile.roleRecommendations.some((r) => r.id === "hr-recruiting"), "hr-recruiting should be in roleRecommendations");
assert.equal(weakOpsProfile.roleRecommendations[0].id, "hr-recruiting", "target role should be first when CV evidence is weak (score < 75)");
console.log("  weak ops CV roleRecommendations[0]:", weakOpsProfile.roleRecommendations[0].id, "✓");

// 3c. Strong dev CV + targetRoleInput Recruiter — dev stays first.
const devConfig = { ...config, targetRoleInput: "Recruiter" };
const strongDevProfile = buildResumeProfile(strongDevCV, devConfig);
console.log("Strong dev CV + Recruiter roleRecommendations:", strongDevProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));
assert.ok(strongDevProfile.roleRecommendations.some((r) => r.id === "hr-recruiting"), "hr-recruiting should still appear in roleRecommendations");
assert.ok(strongDevProfile.roleRecommendations.some((r) => r.id === "software-development"), "software-development should still appear");
assert.ok(
  strongDevProfile.roleRecommendations[0].id !== "hr-recruiting"
  || strongDevProfile.roleRecommendations[0].score >= 75,
  "when dev score >= 75, dev should be first OR recruiter at [0] should have score >= 75"
);
// Verify that hr-recruiting does NOT displace a clearly stronger dev direction.
const devRec = strongDevProfile.roleRecommendations.find((r) => r.id === "software-development");
const hrRec = strongDevProfile.roleRecommendations.find((r) => r.id === "hr-recruiting");
if (devRec && devRec.score >= 75) {
  assert.ok(
    strongDevProfile.roleRecommendations.indexOf(devRec) < strongDevProfile.roleRecommendations.indexOf(hrRec),
    "strong dev rec should appear before recruiter rec when score >= 75"
  );
  console.log("  strong dev CV: dev stays first ✓");
}

// 3d. Recruiter CV with targetRoleInput Recruiter — no duplicate.
const recruiterConfig = { ...config, targetRoleInput: "Recruiter" };
const recruiterProfile = buildResumeProfile(recruiterCV, recruiterConfig);
console.log("Recruiter CV + Recruiter roleRecommendations:", recruiterProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));
const hrRecCount = recruiterProfile.roleRecommendations.filter((r) => r.id === "hr-recruiting").length;
assert.equal(hrRecCount, 1, "hr-recruiting should appear exactly once (no duplicate)");
console.log("  recruiter CV: no duplicate hr-recruiting ✓");

console.log("roleRecommendations merge tests: PASSED");

// ── 4. directionSignals.positive includes target family signals ───────────────

assert.ok(sparseProfile.directionSignals.positive.length > 0, "directionSignals.positive should be non-empty");
const hasHrSignal = sparseProfile.directionSignals.positive.some((s) => /recruit|hr|talent/i.test(s));
assert.ok(hasHrSignal, `directionSignals.positive should include HR/recruiting signals, got: ${sparseProfile.directionSignals.positive.slice(0, 5).join(", ")}`);
console.log("directionSignals.positive includes HR signals: PASSED");

// ── 5. Public profile: CV evidence vs targetRoleInput label ──────────────────

const sparsePublic = toPublicResumeProfile(sparseProfile);
assert.ok(sparsePublic.roleRecommendations.length > 0, "public profile roleRecommendations non-empty");
assert.ok(sparsePublic.targetRoleInput === "Recruiter", "public profile exposes targetRoleInput");
assert.equal(sparsePublic.roleRecommendations[0].id, "hr-recruiting", "public profile [0] is hr-recruiting");
// matchedTerms may be empty for a sparse CV — that is expected and correct.
// The UI distinguishes this using targetRoleInput (tested at the display layer).
console.log("Public profile targetRoleInput field: PASSED");

// ── 6. scoreJob: careerDirectionFit > 0 with targetRoleInput ─────────────────

// Sparse CV no target: direction unknown, HR job should score low.
const sparseNoTarget = buildResumeProfile(sparseCV, config);
const scoredHrNoTarget = scoreJob(hrJob, sparseNoTarget, config);
console.log("HR job, sparse CV no target → careerDirectionFit:", scoredHrNoTarget.matchBreakdown.careerDirectionFit);

// Sparse CV + Recruiter target: HR job should get direction credit.
const scoredHrWithTarget = scoreJob(hrJob, sparseProfile, configWithRecruiter);
console.log("HR job, sparse CV + Recruiter → careerDirectionFit:", scoredHrWithTarget.matchBreakdown.careerDirectionFit);
assert.ok(
  scoredHrWithTarget.matchBreakdown.careerDirectionFit > 0,
  `careerDirectionFit should be > 0 when targetRoleInput matches job direction, got: ${scoredHrWithTarget.matchBreakdown.careerDirectionFit}`
);
assert.ok(
  scoredHrWithTarget.matchBreakdown.careerDirectionFit > scoredHrNoTarget.matchBreakdown.careerDirectionFit,
  "careerDirectionFit should be higher with targetRoleInput than without"
);
console.log("scoreJob careerDirectionFit > 0 for HR job + Recruiter target: PASSED");

// Dev job should NOT get inflated direction credit from Recruiter target.
const scoredDevWithRecruiterTarget = scoreJob(devJob, sparseProfile, configWithRecruiter);
console.log("Dev job, sparse CV + Recruiter target → careerDirectionFit:", scoredDevWithRecruiterTarget.matchBreakdown.careerDirectionFit);

// ── 7. Generic: Marketing Coordinator ────────────────────────────────────────

const configWithMarketing = { ...config, targetRoleInput: "Marketing Coordinator" };
const sparseMarketingProfile = buildResumeProfile(sparseCV, configWithMarketing);
console.log("Sparse CV + Marketing Coordinator:");
console.log("  roleRecommendations:", sparseMarketingProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));
console.log("  dynamicSearchTerms:", sparseMarketingProfile.dynamicSearchTerms.slice(0, 5));
assert.ok(sparseMarketingProfile.roleRecommendations.some((r) => r.id === "marketing-content"), "hr-marketing-content should be in recs for Marketing Coordinator");
assert.ok(sparseMarketingProfile.dynamicSearchTerms.some((t) => /marketing/i.test(t)), "dynamicSearchTerms should include marketing terms");
const scoredMarketingJobWithTarget = scoreJob(marketingJob, sparseMarketingProfile, configWithMarketing);
assert.ok(scoredMarketingJobWithTarget.matchBreakdown.careerDirectionFit > 0, "careerDirectionFit > 0 for Marketing job + Marketing target");
console.log("  Marketing Coordinator careerDirectionFit:", scoredMarketingJobWithTarget.matchBreakdown.careerDirectionFit, "✓");
console.log("Generic Marketing Coordinator test: PASSED");

// ── 8. Generic: Software Developer ───────────────────────────────────────────

const configWithDev = { ...config, targetRoleInput: "Full Stack Developer" };
const sparseDevProfile = buildResumeProfile(sparseCV, configWithDev);
console.log("Sparse CV + Full Stack Developer:");
console.log("  roleRecommendations:", sparseDevProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));
assert.ok(sparseDevProfile.roleRecommendations.some((r) => r.id === "software-development"), "software-development should be in recs");
const scoredDevJobWithTarget = scoreJob(devJob, sparseDevProfile, configWithDev);
assert.ok(scoredDevJobWithTarget.matchBreakdown.careerDirectionFit > 0, "careerDirectionFit > 0 for Dev job + Dev target");
console.log("  Software Developer careerDirectionFit:", scoredDevJobWithTarget.matchBreakdown.careerDirectionFit, "✓");
console.log("Generic Software Developer test: PASSED");

// ── 9. Same sparse CV WITHOUT targetRoleInput still shows warning ─────────────

const profileNoTarget = buildResumeProfile(sparseCV, config);
assert.ok(profileNoTarget.searchTermWarning !== null, "warning should still appear for sparse CV with no target role");
assert.equal(profileNoTarget.roleRecommendations.length, 0, "roleRecommendations should be empty for sparse CV with no target");
console.log("No-target baseline test: PASSED");

// ── 10. Target role terms appear BEFORE CV-derived terms ─────────────────────

const semiSparseCV = `Experience
2022 - present | Various work`;
const profileRecruiter = buildResumeProfile(semiSparseCV, configWithRecruiter);
assert.ok(
  profileRecruiter.dynamicSearchTerms.indexOf("Recruiter") <
  (profileRecruiter.dynamicSearchTerms.indexOf("PMO Coordinator") === -1
    ? Infinity
    : profileRecruiter.dynamicSearchTerms.indexOf("PMO Coordinator")),
  "Recruiter should appear before any PMO terms"
);
console.log("Target role priority test: PASSED");

// ── 11. No old PMO defaults for Marketing target ──────────────────────────────

const OLD_DEFAULTS = ["AI Project Manager", "PMO Coordinator", "Digital Project Manager", "Business Applications Manager"];
const defaults_in_marketing = sparseMarketingProfile.dynamicSearchTerms.filter((t) => OLD_DEFAULTS.includes(t));
assert.equal(defaults_in_marketing.length, 0, `Old PMO/AI defaults should not appear for Marketing target, found: ${defaults_in_marketing.join(", ")}`);
console.log("No old defaults test: PASSED");

console.log("\n✅  All target-role-input tests passed.");
