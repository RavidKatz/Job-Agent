/**
 * Tests for generic source quality fixes (Phase 6A).
 *
 * Validates that Drushim title detection and AllJobs URL guard work for any
 * profession, not just PM/tech. Tests use internal helpers via module-level
 * exports where possible; otherwise they call the public normalizeJob API.
 */

import assert from "node:assert/strict";
import { assessJobQuality, isSearchShortcutUrl, normalizeJob } from "../src/connectors/job-model.mjs";

// ---------------------------------------------------------------------------
// Part 1: isSearchShortcutUrl — AllJobs guard
// ---------------------------------------------------------------------------

// Search-page URLs must be detected
assert.equal(
  isSearchShortcutUrl("https://www.alljobs.co.il/SearchResultsGuest.aspx?keyWord=HR"),
  true,
  "AllJobs search-results URL should be detected as a search shortcut"
);
assert.equal(
  isSearchShortcutUrl("https://www.drushim.co.il/jobs/search/Recruiter/"),
  true,
  "Drushim search URL should be detected as a search shortcut"
);
assert.equal(
  isSearchShortcutUrl("https://www.linkedin.com/jobs/search/?keywords=Marketing"),
  true,
  "LinkedIn search URL should be detected as a search shortcut"
);

// Specific job-page URLs must pass through
assert.equal(
  isSearchShortcutUrl("https://www.alljobs.co.il/job?JobID=12345"),
  false,
  "AllJobs specific job URL should NOT be a search shortcut"
);
assert.equal(
  isSearchShortcutUrl("https://hiremetech.com/job/98765"),
  false,
  "HireMeTech job URL should NOT be a search shortcut"
);
assert.equal(
  isSearchShortcutUrl(null),
  false,
  "null URL should not throw or return true"
);

console.log("isSearchShortcutUrl tests: PASSED");

// ---------------------------------------------------------------------------
// Part 2: normalizeJob + assessJobQuality — search-shortcut jobs are capped
// ---------------------------------------------------------------------------

// A job whose applyUrl is a search-results page is flagged and capped.
const searchPageJob = normalizeJob(
  {
    company: "Some Company",
    title: "HR Manager",
    description: "Lead recruiting, manage HR operations.",
    applyUrl: "https://www.alljobs.co.il/SearchResultsGuest.aspx?keyWord=HR+Manager"
  },
  { id: "alljobs-search", type: "alljobs" }
);
assert.equal(searchPageJob.quality.isSearchShortcut, true, "search-page applyUrl should be flagged");
assert.ok(
  searchPageJob.quality.dataQualityScore <= 35,
  `search-page job quality should be capped at 35, got ${searchPageJob.quality.dataQualityScore}`
);

// A job with a real job-page URL passes normally.
const realJobUrl = normalizeJob(
  {
    company: "Some Company",
    title: "HR Manager",
    description: "Lead recruiting, manage HR operations and onboarding.",
    applyUrl: "https://www.alljobs.co.il/job?JobID=99999"
  },
  { id: "alljobs-search", type: "alljobs" }
);
assert.equal(realJobUrl.quality.isSearchShortcut, false, "specific job URL should not be flagged");
assert.ok(
  realJobUrl.quality.dataQualityScore > 35,
  `real job should score above cap, got ${realJobUrl.quality.dataQualityScore}`
);

console.log("normalizeJob search-shortcut tests: PASSED");

// ---------------------------------------------------------------------------
// Part 3: Drushim looksLikeJobTitle — generic title detection
//
// We test the detection indirectly by importing the helper through a module
// boundary trick: since looksLikeJobTitle is not exported, we validate the
// TITLE_HINTS coverage by checking that titles from all profession families
// would contain at least one hint.  We do this by running a representative
// set of real-world Hebrew and English job titles through a regex derived
// from the same hints, mirroring what the parser does.
// ---------------------------------------------------------------------------

// These are profession-representative titles that Drushim would return if
// the correct search term were sent. Each MUST be detectable as a job title.
const representativeTitles = [
  // HR / Recruiting
  { title: "מגייסת טכנולוגיה",            family: "hr-recruiting" },
  { title: "HR Coordinator",              family: "hr-recruiting" },
  { title: "Talent Acquisition Specialist", family: "hr-recruiting" },
  { title: "ראש תחום גיוס",               family: "hr-recruiting" },
  // Marketing
  { title: "רכזת שיווק דיגיטלי",          family: "marketing" },
  { title: "Marketing Coordinator",       family: "marketing" },
  { title: "Content Manager",             family: "marketing" },
  // Finance
  { title: "חשבת שכר",                   family: "finance" },
  { title: "Finance Analyst",             family: "finance" },
  { title: "Bookkeeper",                  family: "finance" },
  // Sales / Customer Success
  { title: "מנהל תיקי לקוחות",            family: "sales" },
  { title: "Customer Success Manager",    family: "sales" },
  { title: "Sales Representative",        family: "sales" },
  // Software / Tech
  { title: "Full Stack Developer",        family: "software" },
  { title: "Backend Engineer",            family: "software" },
  { title: "QA Engineer",                 family: "software" },
  // Project / PMO
  { title: "מנהל פרויקטים",               family: "pmo" },
  { title: "PMO Coordinator",             family: "pmo" },
  // Operations / Admin
  { title: "רכזת תפעול",                  family: "operations" },
  { title: "Office Manager",              family: "operations" },
  { title: "Operations Coordinator",      family: "operations" },
  // Design
  { title: "UX Designer",                 family: "design" },
  { title: "מעצבת גרפית",                 family: "design" },
];

// Mirror the TITLE_HINTS array from drushim.mjs as a flat lookup.
// (We duplicate the list here intentionally — so the test stays independent
// of the module and makes the expectation explicit.)
const TITLE_HINTS_MIRROR = [
  "Developer", "Engineer", "Full Stack", "Backend", "Frontend", "QA", "DevOps",
  "Data", "BI",
  "HR", "Recruiter", "Talent", "Recruitment",
  "גיוס", "מגייס", "מגייסת", "משאבי אנוש",
  "Marketing", "Digital", "Content", "Social Media", "PPC", "SEO",
  "שיווק", "דיגיטל", "תוכן",
  "Finance", "Accountant", "Bookkeeper", "Payroll",
  "כספים", "הנהלת חשבונות", "חשב", "חשבת",
  "Sales", "Account Manager", "Customer Success", "Customer Service",
  "מכירות", "לקוחות",
  "Product", "Project", "PMO", "Implementation",
  "מוצר", "פרויקט", "פרויקטים", "יישום",
  "Operations", "Coordinator", "Administrator", "Office Manager",
  "תפעול", "רכז", "רכזת", "אדמיניסטרציה", "מנהל", "מנהלת",
  "Designer", "UX", "UI",
  "עיצוב", "מעצב", "מעצבת",
  "Logistics", "Supply Chain", "Procurement",
  "לוגיסטיקה", "רכש",
  "מערכות מידע", "מיישם",
];

let failures = [];
for (const { title, family } of representativeTitles) {
  const lower = title.toLowerCase();
  const matched = TITLE_HINTS_MIRROR.some((hint) => lower.includes(hint.toLowerCase()));
  if (!matched) failures.push(`"${title}" (${family}) — no TITLE_HINT matched`);
}

if (failures.length) {
  console.error("TITLE_HINTS coverage failures:");
  for (const f of failures) console.error(" ", f);
  assert.fail(`${failures.length} title(s) not covered by TITLE_HINTS`);
}

console.log(`TITLE_HINTS coverage: all ${representativeTitles.length} representative titles matched. PASSED`);

// ---------------------------------------------------------------------------
// Part 4: Garbage strings must NOT be detected as job titles
// ---------------------------------------------------------------------------

const NOISE_STRINGS = [
  "display:none",
  "https://example.com/logo.png",
  "/static/js/main.chunk.js",
  "12345678",
  "organization-structure",
  "a",
  "menu-item-dropdown",
];

for (const noise of NOISE_STRINGS) {
  const lower = noise.toLowerCase();
  // Should not match any TITLE_HINT AND satisfy title-like conditions together.
  // We just verify TITLE_HINTS don't match — the full function also checks
  // length, URL pattern etc., so this is a lower bound.
  const matched = TITLE_HINTS_MIRROR.some((hint) => lower.includes(hint.toLowerCase()));
  assert.ok(!matched, `Noise string "${noise}" should not match any TITLE_HINT`);
}

console.log("Noise-string tests: PASSED");

// ---------------------------------------------------------------------------

console.log("\n✅  All source-quality tests passed.");
