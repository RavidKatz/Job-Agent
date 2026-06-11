/**
 * Inference gate: when targetRoleInput is empty, the server allows a scan only if
 * the CV alone produced credible role recommendations (a ROLE_FAMILY scored >= 60).
 *
 * The gate in server.mjs checks roleRecommendations.length — NOT dynamicSearchTerms —
 * because buildDynamicSearchTerms has latest-role/education fallbacks that can produce
 * non-empty terms even when no role family is credible. Those weak generic terms must
 * never trigger a scan on their own. This test pins that distinction.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// CV with a parseable latest role but no signals strong enough for any role family.
const weakCV = `Professional Experience
2022 - present | Team Member, Some Company
General daily tasks and assorted responsibilities at the office.
Education
2018 - 2022 | B.A. General Studies`;

const weakProfile = buildResumeProfile(weakCV, config);
console.log("weak CV roleRecommendations:", weakProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));
console.log("weak CV dynamicSearchTerms:", weakProfile.dynamicSearchTerms);

assert.equal(
  weakProfile.roleRecommendations.length,
  0,
  "weak CV must produce zero credible role recommendations — this is what the server gate rejects"
);
assert.ok(
  weakProfile.dynamicSearchTerms.length > 0,
  "weak CV still yields fallback search terms — proving the gate must check roleRecommendations, not search terms"
);

// CV with strong recruiting evidence — credible inference without any targetRoleInput.
const strongCV = `Professional Experience
2022 - present | Senior Recruiter, Tech Corp
Conducted full-cycle recruiting, screening candidates, scheduling interviews,
onboarding new hires, talent acquisition, HR operations and employee experience.
2019 - 2022 | HR Coordinator, Startup Y
Human resources administration, employee onboarding, interviews, and recruiting.
Education
2015 - 2019 | B.A. Behavioral Sciences`;

const strongProfile = buildResumeProfile(strongCV, config);
console.log("strong CV roleRecommendations:", strongProfile.roleRecommendations.map((r) => `${r.id}(${r.score})`));

assert.ok(
  strongProfile.roleRecommendations.length > 0,
  "strong CV must produce credible role recommendations without targetRoleInput"
);
assert.ok(
  strongProfile.roleRecommendations.every((r) => !r.fromTargetRoleInput),
  "with no targetRoleInput, recommendations must come purely from CV evidence"
);

// ── Frontend guards ──────────────────────────────────────────────────────────
// The frontend must not block empty target role, must surface backend errors,
// and must keep the scan timeout from commit 7450bee.

const appJs = fs.readFileSync(path.join(rootDir, "public", "app.js"), "utf8");

assert.ok(
  !appJs.includes("TARGET_ROLE_REQUIRED_MESSAGE"),
  "frontend must not hard-block an empty target role"
);
assert.ok(
  appJs.includes("payload.error"),
  "frontend must surface backend validation errors from the response payload"
);
assert.ok(
  /SCAN_TIMEOUT_MS\s*=\s*90000/.test(appJs) && appJs.includes("AbortError"),
  "scan timeout behavior (7450bee) must remain: 90s AbortController + AbortError handling"
);

console.log("All inference gate tests passed.");
