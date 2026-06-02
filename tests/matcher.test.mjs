import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";
import { rankJobs, scoreJob } from "../src/matcher.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

// A realistic candidate: Industrial Engineering & Management with a Data Science
// specialization, whose last role is PMO / AI implementation oriented.
const resumeText = `
Professional Experience

2022 - present | AI Solutions & PMO Coordinator, Acme Tech
Led AI workflow automation projects end to end, gathered business requirements,
coordinated diverse stakeholders, built KPI dashboards, improved processes,
and managed delivery using Jira and Monday. Worked with SQL, Python and Make.

2019 - 2022 | Project Coordinator, Beta Systems
Managed project tracking, reporting and status updates, supported CRM and ERP
systems implementation, prepared Excel dashboards.

Education
2016 - 2019 | B.Sc. Industrial Engineering and Management, Data Science specialization
`;

const profile = buildResumeProfile(resumeText, config);

// --- Mock jobs -------------------------------------------------------------
const strongPmoAiJob = {
  company: "Matrix",
  title: "AI Solutions Project Manager (PMO)",
  location: "Tel Aviv, Hybrid",
  workMode: "Hybrid",
  source: "Test",
  applyUrl: "https://example.com/1",
  postedAt: "2026-05-24",
  description: `Requirements: 3+ years managing AI automation and workflow projects.
  Responsibilities: gather requirements, coordinate stakeholders, manage delivery,
  build KPI dashboards, improve processes, report progress. Tools: Jira, Monday, SQL.`
};

const mediumDataPmJob = {
  company: "DataCorp",
  title: "Data Project Manager",
  location: "Ramat Gan, Hybrid",
  workMode: "Hybrid",
  source: "Test",
  applyUrl: "https://example.com/2",
  postedAt: "2026-05-24",
  description: `Requirements: 5+ years of experience leading large data projects and
  data warehouse delivery. Must have strong SQL and hands-on Tableau. Coordinate
  data engineers and analysts, manage roadmaps and reporting.`
};

const lowDevJob = {
  company: "Code Factory",
  title: "Senior Backend Developer / ML Research Engineer",
  location: "Remote",
  workMode: "Remote",
  source: "Test",
  applyUrl: "https://example.com/3",
  postedAt: "2026-05-24",
  description: `Hands-on coding role. Required: deep Node.js, distributed systems,
  backend architecture, production software engineering, machine learning model
  training and algorithm research. Must have 6+ years of software development.`
};

const strong = scoreJob(strongPmoAiJob, profile, config);
const medium = scoreJob(mediumDataPmJob, profile, config);
const low = scoreJob(lowDevJob, profile, config);

console.log("Strong PMO/AI job:", strong.matchPercent, strong.fitAnalysis.fitLabel, strong.fitAnalysis.finalRecommendation);
console.log("Medium data PM job:", medium.matchPercent, medium.fitAnalysis.fitLabel, medium.fitAnalysis.finalRecommendation);
console.log("Low dev/ML job:", low.matchPercent, low.fitAnalysis.fitLabel, low.fitAnalysis.finalRecommendation);

// --- Assertions ------------------------------------------------------------
// 1. Strong-fit PMO / AI implementation job scores highest and is recommended.
assert.ok(strong.matchPercent >= 75, `strong should be High, got ${strong.matchPercent}`);
assert.equal(strong.fitAnalysis.finalRecommendation, "Apply");

// 2. Medium data project manager sits below the strong fit (years gap lowers it).
assert.ok(medium.matchPercent < strong.matchPercent, "medium should rank below strong");
assert.ok(medium.matchPercent >= 50 && medium.matchPercent < 80, `medium should be mid, got ${medium.matchPercent}`);

// 3. Deep software developer / ML research job is rated low and not recommended.
assert.ok(low.matchPercent < 60, `low dev job should be < 60, got ${low.matchPercent}`);
assert.equal(low.fitAnalysis.finalRecommendation, "Not recommended");
assert.ok(low.matchPercent < medium.matchPercent, "dev job should rank below data PM");

// 4. The engine does not over-rate keyword-only overlap.
assert.ok(strong.matchPercent > low.matchPercent, "real fit should beat keyword-only fit");

// 5. Ranking returns the strong job first.
const ranked = rankJobs([lowDevJob, mediumDataPmJob, strongPmoAiJob], profile, config);
assert.equal(ranked[0].position, strongPmoAiJob.title, "strong job should rank first");

// 6. Explanation is populated in Hebrew.
assert.ok(strong.fitAnalysis.whyFits.length > 0);
assert.ok(low.fitAnalysis.risks.length > 0);

console.log("\nAll matcher tests passed.");
