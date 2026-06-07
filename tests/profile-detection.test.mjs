/**
 * Tests for candidate profile detection (Phase 6B).
 *
 * Two fixes are validated:
 *   A. targetRoleInput seeds the candidate direction when the CV yields no
 *      strong recommendation (generic fallback, any profession).
 *   B. Hebrew + broader skill aliases let non-English CVs produce profile
 *      evidence (matchedConfiguredTerms) and role recommendations generically.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";
import { buildCandidateProfile } from "../src/job-fit.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// ─── Test A1: sparse CV + targetRoleInput seeds the direction ────────────────

const sparseCV = "Jane Doe. Hard worker, team player, looking for a new opportunity.";
const fallbackProfile = buildResumeProfile(sparseCV, { ...config, targetRoleInput: "HR" });

console.log("Fallback profile:");
console.log("  roleRecommendations:", fallbackProfile.roleRecommendations.map((r) => `${r.id} (${r.score})`));
console.log("  directionSignals.positive:", fallbackProfile.directionSignals.positive.slice(0, 4));

assert.ok(fallbackProfile.roleRecommendations.length >= 1,
  "sparse CV + targetRoleInput should produce a fallback recommendation");
assert.equal(fallbackProfile.roleRecommendations[0].id, "hr-recruiting",
  "fallback should map 'HR' to the hr-recruiting family");
assert.equal(fallbackProfile.roleRecommendations[0].fromTargetRoleInput, true,
  "fallback recommendation should be flagged as derived from targetRoleInput");
assert.ok(fallbackProfile.directionSignals.positive.length > 0,
  "directionSignals.positive should be populated from the fallback");
assert.ok(fallbackProfile.dynamicSearchTerms.length > 0,
  "dynamicSearchTerms should be populated");

console.log("Test A1 (fallback seeding): PASSED");

// ─── Test A2: fallback is generic across professions ─────────────────────────

const fallbackCases = [
  { input: "Marketing", expected: "marketing-content" },
  { input: "Software Developer", expected: "software-development" },
  { input: "Accountant", expected: "finance-accounting" },
  { input: "Sales", expected: "sales-customer-service" },
  { input: "Operations Coordinator", expected: "operations" },
  { input: "UX Designer", expected: "design" },
  { input: "Attorney", expected: "legal" }
];
for (const { input, expected } of fallbackCases) {
  const p = buildResumeProfile(sparseCV, { ...config, targetRoleInput: input });
  assert.ok(p.roleRecommendations.length >= 1, `"${input}" should seed a recommendation`);
  assert.equal(p.roleRecommendations[0].id, expected,
    `"${input}" should map to ${expected}, got ${p.roleRecommendations[0].id}`);
}
console.log("Test A2 (fallback is generic): PASSED");

// ─── Test A3: strong CV keeps its direction first; targetRoleInput is secondary ─

const devCV = `Professional Experience
2021 - present | Full Stack Developer, TechCorp
Built React and Node.js web applications, REST APIs, SQL databases, software engineering.
Education
2017 - 2021 | B.Sc. Computer Science`;

const strongProfile = buildResumeProfile(devCV, { ...config, targetRoleInput: "HR" });
console.log("Strong CV + conflicting targetRoleInput:");
console.log("  roleRecommendations:", strongProfile.roleRecommendations.map((r) => `${r.id} (${r.score})`));

assert.ok(strongProfile.roleRecommendations.length >= 1, "dev CV should produce CV-derived recommendations");
assert.equal(strongProfile.roleRecommendations[0].id, "software-development",
  "strong dev CV must stay first even when targetRoleInput conflicts");
assert.ok(!strongProfile.roleRecommendations[0].fromTargetRoleInput,
  "the leading recommendation for a strong CV must come from CV evidence, not targetRoleInput");
// Phase 7B: targetRoleInput may appear as a secondary recommendation for display
// purposes, but the leading direction is always CV-derived when score >= 75.
const hrEntry = strongProfile.roleRecommendations.find((r) => r.id === "hr-recruiting");
if (hrEntry) {
  assert.ok(hrEntry.fromTargetRoleInput, "secondary hr entry must be tagged fromTargetRoleInput");
  assert.ok(
    strongProfile.roleRecommendations.indexOf(hrEntry) > 0,
    "hr secondary entry must not be at position 0"
  );
}

console.log("Test A3 (strong CV direction preserved): PASSED");

// ─── Test B1: Hebrew CVs produce profile evidence generically ────────────────

const hebrewCVs = {
  "hr-recruiting": `ניסיון תעסוקתי
2020 - 2024 רכזת גיוס בחברת הייטק
אחריות על משאבי אנוש, גיוס, סינון מועמדים, ניהול ראיונות, קליטת עובדים חדשים.
השכלה
2016 - 2019 תואר ראשון בניהול`,
  "marketing-content": `ניסיון תעסוקתי
2020 - 2024 מנהלת שיווק
אחריות על שיווק דיגיטלי, ניהול תוכן, רשתות חברתיות וקמפיינים.
השכלה תואר ראשון בשיווק`,
  "finance-accounting": `ניסיון תעסוקתי
2020 - 2024 חשבת שכר
אחריות על הנהלת חשבונות, חשבונאות, שכר ודוחות כספים.
השכלה תואר ראשון בחשבונאות`,
  "sales-customer-service": `ניסיון תעסוקתי
2020 - 2024 איש מכירות
אחריות על מכירות, שירות לקוחות ותמיכת לקוחות.
השכלה תואר ראשון`,
  "operations": `ניסיון תעסוקתי
2020 - 2024 מנהל תפעול
אחריות על תפעול, לוגיסטיקה ורכש.
השכלה תואר ראשון`,
  "software-development": `ניסיון תעסוקתי
2020 - 2024 מפתח תוכנה
פיתוח תוכנה ב React ו Node.js, בסיסי נתונים SQL.
השכלה תואר ראשון במדעי המחשב`,
  "design": `ניסיון תעסוקתי
2020 - 2024 מעצבת UX/UI בחברת סטארטאפ
אחריות על עיצוב ממשק משתמש, חוויית משתמש, פרוטוטייפים ב-Figma.
השכלה תואר ראשון בעיצוב`,
  "legal": `ניסיון תעסוקתי
2020 - 2024 עורכת דין בתחום המשפט העסקי
אחריות על ניהול חוזים, ייעוץ משפטי, ציות לרגולציה.
השכלה תואר ראשון במשפטים`,
  "pmo": `ניסיון תעסוקתי
2020 - 2024 מנהל פרויקטים
אחריות על ניהול פרויקטים, PMO, תכנון פרויקט ותיאום בין-צוותי.
השכלה תואר ראשון בהנדסת תעשייה וניהול`
};

for (const [family, cv] of Object.entries(hebrewCVs)) {
  const p = buildResumeProfile(cv, config); // no targetRoleInput — pure CV detection
  console.log(`Hebrew ${family}: matchedTerms=[${p.matchedConfiguredTerms.slice(0, 4).join(", ")}] recs=${p.roleRecommendations.map((r) => r.id).join(",")}`);
  assert.ok(p.matchedConfiguredTerms.length > 0,
    `Hebrew ${family} CV should produce profile evidence (matchedConfiguredTerms), got none`);
}
console.log("Test B1 (Hebrew evidence is generic): PASSED");

// ─── Test B2: Hebrew CVs reach role recommendations for strong families ───────

for (const family of ["hr-recruiting", "marketing-content", "finance-accounting", "software-development", "design", "legal"]) {
  const p = buildResumeProfile(hebrewCVs[family], config);
  assert.ok(p.roleRecommendations.length > 0,
    `Hebrew ${family} CV should produce a role recommendation, got none`);
  assert.ok(p.roleRecommendations.some((r) => r.id === family && !r.fromTargetRoleInput),
    `Hebrew ${family} CV should recommend ${family} from CV evidence (not fallback)`);
}
console.log("Test B2 (Hebrew recommendations from CV evidence): PASSED");

// ─── Test C: buildCandidateProfile reflects the fallback direction ───────────

const candidate = buildCandidateProfile(fallbackProfile);
console.log("Candidate profile from fallback:");
console.log("  professionalDomain:", candidate.professionalDomain);
console.log("  evidence keys:", Object.keys(candidate.evidence));

assert.ok(candidate.professionalDomain.length > 0,
  "candidate professionalDomain should be populated from the fallback recommendation");
assert.ok(Object.keys(candidate.evidence).length > 0,
  "candidate evidence chain should be populated from the fallback recommendation");

console.log("Test C (candidate profile evidence): PASSED");

console.log("\n✅  All profile-detection tests passed.");
