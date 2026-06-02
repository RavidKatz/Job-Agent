import assert from "node:assert/strict";
import { assessJobQuality, normalizeJob } from "../src/connectors/job-model.mjs";

// 1. A complete, structured job from a reliable source scores high and is real.
const fullJob = normalizeJob(
  {
    company: "Matrix",
    title: "AI Solutions Project Manager",
    location: "Tel Aviv",
    description: "Lead AI automation and PMO delivery projects, gather requirements, coordinate stakeholders, build KPI dashboards and report progress to management every week.",
    applyUrl: "https://example.com/jobs/12345"
  },
  { id: "remotive", name: "Remotive", type: "remotive" }
);
console.log("full:", fullJob.quality.dataQualityScore, fullJob.quality.sourceReliability);
assert.equal(fullJob.quality.sourceReliability, "high");
assert.ok(fullJob.quality.dataQualityScore >= 80, `full job should be high quality, got ${fullJob.quality.dataQualityScore}`);
assert.equal(fullJob.quality.isRealJob, true);
assert.equal(fullJob.quality.isSearchShortcut, false);
assert.deepEqual(fullJob.quality.missingFields, []);
// Backward compatibility: the normalized shape is unchanged, quality is additive.
assert.equal(fullJob.company, "Matrix");
assert.equal(fullJob.title, "AI Solutions Project Manager");

// 2. A numeric / garbage company value is flagged as suspicious.
const garbageCompanyJob = normalizeJob(
  {
    company: "12345",
    title: "Some Role",
    description: "A reasonably long description of the role and its day to day responsibilities for the team.",
    applyUrl: "https://example.com/jobs/99"
  },
  { id: "alljobs-search", name: "AllJobs", type: "alljobs" }
);
console.log("garbage company:", garbageCompanyJob.quality.dataQualityScore, garbageCompanyJob.quality.qualityWarnings);
assert.ok(garbageCompanyJob.quality.qualityWarnings.some((w) => w.includes("חברה")), "should warn about company");
assert.ok(garbageCompanyJob.quality.dataQualityScore < fullJob.quality.dataQualityScore);

// 3. A search-shortcut apply URL is detected and capped.
const shortcutJob = normalizeJob(
  {
    company: "",
    title: "PMO Roles",
    location: "Israel",
    description: "PMO PMO PMO Israel hybrid",
    applyUrl: "https://www.drushim.co.il/jobs/search/PMO/"
  },
  { id: "drushim-search", name: "Drushim", type: "drushim" }
);
console.log("shortcut:", shortcutJob.quality.dataQualityScore, shortcutJob.quality.isSearchShortcut);
assert.equal(shortcutJob.quality.isSearchShortcut, true);
assert.ok(shortcutJob.quality.dataQualityScore <= 35, `search shortcut should be capped, got ${shortcutJob.quality.dataQualityScore}`);
assert.equal(shortcutJob.quality.sourceReliability, "low");

// 4. A job with no title and no description is not a real job (will be filtered).
const emptyJob = normalizeJob({ applyUrl: "https://example.com/jobs/1" }, { id: "file", type: "file" });
console.log("empty:", emptyJob.quality.isRealJob, emptyJob.quality.missingFields);
assert.equal(emptyJob.quality.isRealJob, false);
assert.ok(emptyJob.quality.missingFields.includes("title"));

// 5. assessJobQuality never throws on a fully empty job and returns the shape.
const safe = assessJobQuality({}, {});
assert.equal(typeof safe.dataQualityScore, "number");
assert.ok(Array.isArray(safe.missingFields));
assert.ok(Array.isArray(safe.qualityWarnings));
assert.equal(safe.isRealJob, false);

console.log("\nAll job-quality tests passed.");
