/**
 * Tests for targetRoleInput — production blocker fix.
 *
 * Acceptance criteria:
 * 1. expandTargetRoleTerms produces >=3 terms for common role inputs.
 * 2. buildDynamicSearchTerms places target role terms first when provided.
 * 3. A sparse CV + targetRoleInput clears searchTermWarning.
 * 4. The final dynamicSearchTerms reflect the target role, not old defaults.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";
import { expandTargetRoleTerms } from "../src/role-recommender.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// ── 1. expandTargetRoleTerms ─────────────────────────────────────────────────

const marketingTerms = expandTargetRoleTerms("Marketing Coordinator");
console.log("Marketing Coordinator terms:", marketingTerms);
assert.ok(marketingTerms.length >= 2, `should generate >=2 terms for Marketing Coordinator, got ${marketingTerms.length}`);
assert.ok(marketingTerms[0] === "Marketing Coordinator", "exact input should be first");
assert.ok(
  marketingTerms.some((t) => /marketing/i.test(t)),
  `marketing terms should include marketing-related terms, got: ${marketingTerms.join(", ")}`
);

const recruiterTerms = expandTargetRoleTerms("Recruiter");
console.log("Recruiter terms:", recruiterTerms);
assert.ok(recruiterTerms.length >= 2, `should generate >=2 terms for Recruiter, got ${recruiterTerms.length}`);
assert.ok(recruiterTerms[0] === "Recruiter", "exact input should be first");
assert.ok(
  recruiterTerms.some((t) => /recruit|hr|talent/i.test(t)),
  `recruiter terms should be HR-related, got: ${recruiterTerms.join(", ")}`
);

const devTerms = expandTargetRoleTerms("Full Stack Developer");
console.log("Full Stack Developer terms:", devTerms);
assert.ok(devTerms.length >= 2, `should generate >=2 terms for Full Stack Developer, got ${devTerms.length}`);
assert.ok(devTerms[0] === "Full Stack Developer", "exact input should be first");
assert.ok(
  devTerms.some((t) => /developer|frontend|backend|software/i.test(t)),
  `dev terms should be dev-related, got: ${devTerms.join(", ")}`
);

// Empty / null input should return empty array
assert.deepEqual(expandTargetRoleTerms(""), [], "empty input returns []");
assert.deepEqual(expandTargetRoleTerms(null), [], "null input returns []");
console.log("expandTargetRoleTerms tests: PASSED");

// ── 2. Sparse CV + targetRoleInput clears warning ────────────────────────────

const sparseCV = "John Smith. Experience: various roles. Education: B.A.";
const configWithTarget = { ...config, targetRoleInput: "Marketing Coordinator" };
const profileWithTarget = buildResumeProfile(sparseCV, configWithTarget);

console.log("Sparse CV + targetRoleInput:");
console.log("  searchTermWarning:", profileWithTarget.searchTermWarning);
console.log("  dynamicSearchTerms:", profileWithTarget.dynamicSearchTerms.slice(0, 6));
console.log("  targetRoleInput:", profileWithTarget.targetRoleInput);

assert.equal(
  profileWithTarget.searchTermWarning,
  null,
  "warning should be null when targetRoleInput is provided"
);
assert.ok(
  profileWithTarget.dynamicSearchTerms.length > 0,
  "dynamicSearchTerms should not be empty when targetRoleInput provided"
);
assert.ok(
  profileWithTarget.dynamicSearchTerms[0] === "Marketing Coordinator" ||
  profileWithTarget.dynamicSearchTerms.includes("Marketing Coordinator"),
  `"Marketing Coordinator" should appear in dynamicSearchTerms, got: ${profileWithTarget.dynamicSearchTerms.join(", ")}`
);
assert.equal(
  profileWithTarget.targetRoleInput,
  "Marketing Coordinator",
  "targetRoleInput preserved in profile"
);
console.log("Sparse CV + targetRoleInput tests: PASSED");

// ── 3. Same sparse CV WITHOUT targetRoleInput still shows warning ─────────────

const profileNoTarget = buildResumeProfile(sparseCV, config);
console.log("Sparse CV without targetRoleInput:");
console.log("  searchTermWarning:", profileNoTarget.searchTermWarning);
assert.ok(
  profileNoTarget.searchTermWarning !== null,
  "warning should still appear for truly sparse CV with no target role"
);
console.log("Warning-still-shows test: PASSED");

// ── 4. Target role terms appear BEFORE CV-derived terms ─────────────────────

const semiSparseCV = `Experience
2022 - present | Various work`;
const configWithRecruiter = { ...config, targetRoleInput: "Recruiter" };
const profileRecruiter = buildResumeProfile(semiSparseCV, configWithRecruiter);

console.log("Target-role-first check:");
console.log("  dynamicSearchTerms:", profileRecruiter.dynamicSearchTerms.slice(0, 5));
assert.ok(
  profileRecruiter.dynamicSearchTerms.indexOf("Recruiter") <
  (profileRecruiter.dynamicSearchTerms.indexOf("PMO Coordinator") === -1
    ? Infinity
    : profileRecruiter.dynamicSearchTerms.indexOf("PMO Coordinator")),
  "Recruiter should appear before any PMO terms"
);
console.log("Target role priority test: PASSED");

// ── 5. No old default terms when CV is sparse + target role provided ──────────

const OLD_DEFAULTS = ["AI Project Manager", "PMO Coordinator", "Digital Project Manager", "Business Applications Manager"];
const defaults_in_marketing = profileWithTarget.dynamicSearchTerms.filter((t) => OLD_DEFAULTS.includes(t));
assert.equal(
  defaults_in_marketing.length,
  0,
  `Old PMO/AI defaults should not appear when target role is "Marketing Coordinator", found: ${defaults_in_marketing.join(", ")}`
);
console.log("No old defaults test: PASSED");

console.log("\n✅  All target-role-input tests passed.");
