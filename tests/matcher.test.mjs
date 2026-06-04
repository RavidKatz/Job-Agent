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
const shortButRelevantJob = {
  company: "LeanOps",
  title: "AI Solutions Project Manager",
  location: "Tel Aviv",
  workMode: "Hybrid",
  source: "Test",
  applyUrl: "https://example.com/short",
  postedAt: "2026-05-24",
  quality: {
    dataQualityScore: 45,
    sourceReliability: "low",
    missingFields: [],
    qualityWarnings: ["short description"],
    isSearchShortcut: false,
    isRealJob: true
  },
  description: "Manage AI workflow projects, requirements, stakeholders, Jira and KPI dashboards."
};
const shortRelevant = scoreJob(shortButRelevantJob, profile, config);

console.log("Strong PMO/AI job:", strong.matchPercent, strong.fitAnalysis.fitLabel, strong.fitAnalysis.finalRecommendation);
console.log("Medium data PM job:", medium.matchPercent, medium.fitAnalysis.fitLabel, medium.fitAnalysis.finalRecommendation);
console.log("Low dev/ML job:", low.matchPercent, low.fitAnalysis.fitLabel, low.fitAnalysis.finalRecommendation);
console.log("Short relevant job:", shortRelevant.matchPercent, "confidence", shortRelevant.fitAnalysis.confidenceScore);

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

// 4b. Low data quality should lower confidence, not automatically crush fit.
assert.ok(shortRelevant.matchPercent >= 60, `short relevant job should remain viable, got ${shortRelevant.matchPercent}`);
assert.ok(shortRelevant.fitAnalysis.confidenceScore < shortRelevant.matchPercent, "short job should have lower confidence than fit");
assert.notEqual(shortRelevant.fitAnalysis.finalRecommendation, "Not recommended");

// 5. Ranking returns the strong job first.
const ranked = rankJobs([lowDevJob, mediumDataPmJob, strongPmoAiJob], profile, config);
assert.equal(ranked[0].position, strongPmoAiJob.title, "strong job should rank first");

// 6. Explanation is populated in Hebrew.
assert.ok(strong.fitAnalysis.whyFits.length > 0);
assert.ok(low.fitAnalysis.risks.length > 0);

// --- Candidate-agnostic checks: the engine must adapt to each CV ------------

// Software developer CV: dev roles should fit, PMO should not auto-win.
const devResume = `
Professional Experience
2021 - present | Full Stack Developer, Acme
Built web applications with React, Node.js, TypeScript and JavaScript. Designed
REST APIs, wrote unit tests, and shipped features to production. Worked with SQL.
2019 - 2021 | Frontend Developer, Beta
Developed React components and frontend features in JavaScript.
Education
2015 - 2019 | B.Sc. Computer Science
`;
const devProfile = buildResumeProfile(devResume, config);

const devJob = {
  company: "Code Labs", title: "Backend Developer", location: "Tel Aviv", workMode: "Hybrid",
  source: "Test", applyUrl: "https://example.com/dev", postedAt: "2026-05-24",
  description: "Build and maintain backend services in Node.js, design REST APIs, write tests, deploy to production. Requirements: 3+ years software development with JavaScript, TypeScript, React and SQL."
};
const pmoJobForDev = {
  company: "Matrix", title: "Project Manager (PMO)", location: "Tel Aviv", workMode: "Hybrid",
  source: "Test", applyUrl: "https://example.com/pmo", postedAt: "2026-05-24",
  description: "Coordinate projects, manage delivery, build KPI dashboards and reports, stakeholder management and process improvement. Requirements: PMO experience with Jira and Monday."
};

const devOnDev = scoreJob(devJob, devProfile, config);
const devOnPmo = scoreJob(pmoJobForDev, devProfile, config);
console.log("dev CV -> dev job:", devOnDev.matchPercent, devOnDev.fitAnalysis.finalRecommendation, "| PMO job:", devOnPmo.matchPercent);
assert.ok(devOnDev.matchPercent > devOnPmo.matchPercent, "dev CV should prefer the dev job over PMO");
assert.notEqual(devOnDev.category, "Not recommended", "dev job should not be rejected for a dev CV");
assert.notEqual(devOnDev.fitAnalysis.finalRecommendation, "Not recommended", "dev job should be viable for a dev CV");

// Finance CV: finance roles should fit better than PMO.
const financeResume = `
Professional Experience
2020 - present | Bookkeeper, Finance Group
Handled bookkeeping, accounts payable and accounts receivable, payroll, invoices,
reconciliation and financial statements using SAP and Priority.
Education
2016 - 2019 | B.A. Accounting
`;
const financeProfile = buildResumeProfile(financeResume, config);

const financeJob = {
  company: "LedgerCo", title: "Bookkeeper", location: "Tel Aviv", workMode: "On-site",
  source: "Test", applyUrl: "https://example.com/fin", postedAt: "2026-05-24",
  description: "Manage bookkeeping, accounts payable and receivable, payroll, invoices and reconciliation. Prepare financial statements. Requirements: experience with SAP or Priority."
};
const pmoJobForFinance = { ...pmoJobForDev, applyUrl: "https://example.com/pmo2" };

const finOnFin = scoreJob(financeJob, financeProfile, config);
const finOnPmo = scoreJob(pmoJobForFinance, financeProfile, config);
console.log("finance CV -> finance job:", finOnFin.matchPercent, finOnFin.fitAnalysis.finalRecommendation, "| PMO job:", finOnPmo.matchPercent);
assert.ok(finOnFin.matchPercent > finOnPmo.matchPercent, "finance CV should prefer the finance job over PMO");
assert.notEqual(finOnFin.fitAnalysis.finalRecommendation, "Not recommended", "finance job should be viable for a finance CV");

// The same PMO job should still score well for the original PMO/AI candidate,
// proving scores are profile-relative rather than fixed.
assert.ok(strong.matchPercent > devOnPmo.matchPercent, "PMO job fits the PMO CV better than the dev CV");

console.log("\nAll matcher tests passed.");
