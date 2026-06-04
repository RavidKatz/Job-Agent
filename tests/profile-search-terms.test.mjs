import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeProfile } from "../src/profile.mjs";
import { normalizeText } from "../src/text.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const config = JSON.parse(fs.readFileSync(path.join(rootDir, "config", "search-profile.json"), "utf8"));

function normalizedTerms(profile) {
  return profile.dynamicSearchTerms.map(normalizeText);
}

function assertIncludesAny(terms, expected, message) {
  assert.ok(
    expected.some((term) => terms.includes(normalizeText(term))),
    `${message}. Got: ${terms.join(", ")}`
  );
}

function assertExcludesAll(terms, blocked, message) {
  for (const term of blocked) {
    assert.ok(!terms.includes(normalizeText(term)), `${message}: ${term}. Got: ${terms.join(", ")}`);
  }
}

const softwareDeveloperResume = `
Professional Experience
2021 - present | Full Stack Developer, CodeCo
Built web applications with React, Node.js, TypeScript and JavaScript.
Designed backend APIs, frontend features, unit tests and SQL queries.

2019 - 2021 | Frontend Developer, Product Studio
Developed React components and shipped production web features.

Education
2015 - 2019 | B.Sc. Computer Science
`;

const recruiterResume = `
Professional Experience
2020 - present | Recruiter, PeopleCo
Managed full-cycle recruiting, candidate screening, interviews, onboarding,
talent acquisition pipelines and employee experience coordination.

2018 - 2020 | HR Coordinator, People Services
Supported human resources operations, onboarding and hiring processes.

Education
2015 - 2018 | B.A. Human Resources Management
`;

const sparseMarketingResume = `
Professional Experience
2022 - present | Marketing Coordinator, BrandCo

Education
2018 - 2021 | B.A. Communication
`;

const unclearResume = `
Summary
Reliable and motivated candidate with good communication skills.

Education
High school diploma
`;

const developerProfile = buildResumeProfile(softwareDeveloperResume, config);
const recruiterProfile = buildResumeProfile(recruiterResume, config);
const sparseMarketingProfile = buildResumeProfile(sparseMarketingResume, config);
const unclearProfile = buildResumeProfile(unclearResume, config);
const developerTerms = normalizedTerms(developerProfile);
const recruiterTerms = normalizedTerms(recruiterProfile);
const sparseMarketingTerms = normalizedTerms(sparseMarketingProfile);

console.log("Developer latest role:", developerProfile.latestRole);
console.log("Developer search terms:", developerProfile.dynamicSearchTerms.join(" | "));
console.log("Recruiter latest role:", recruiterProfile.latestRole);
console.log("Recruiter search terms:", recruiterProfile.dynamicSearchTerms.join(" | "));
console.log("Sparse latest role:", sparseMarketingProfile.latestRole);
console.log("Sparse search terms:", sparseMarketingProfile.dynamicSearchTerms.join(" | "));
console.log("Unclear search warning:", unclearProfile.searchTermWarning);

assert.equal(developerProfile.latestRole, "Full Stack Developer");
assertIncludesAny(developerTerms, ["Software Developer", "Backend Developer", "Frontend Developer", "Full Stack Developer"], "developer CV should produce software terms");
assertExcludesAll(developerTerms, ["PMO", "Finance", "Industrial Engineering", "Operations", "AI Project Manager"], "developer CV should not produce unrelated default directions");
assert.equal(developerProfile.roleRecommendations[0]?.id, "software-development");

assert.equal(recruiterProfile.latestRole, "Recruiter");
assertIncludesAny(recruiterTerms, ["Recruiter", "HR Coordinator", "Talent Acquisition Coordinator"], "recruiter CV should produce HR terms");
assertExcludesAll(recruiterTerms, ["AI", "PMO", "Finance", "Industrial Engineering", "Software Developer"], "recruiter CV should not produce unrelated default directions");
assert.equal(recruiterProfile.roleRecommendations[0]?.id, "hr-recruiting");

assert.notDeepEqual(developerProfile.dynamicSearchTerms, recruiterProfile.dynamicSearchTerms, "different CVs should produce different search terms");

assert.equal(sparseMarketingProfile.latestRole, "Marketing Coordinator");
assertIncludesAny(sparseMarketingTerms, ["Marketing Coordinator", "Digital Marketing Specialist", "Content Manager"], "sparse CV with clear latest role should still produce role terms");
assert.ok(sparseMarketingProfile.dynamicSearchTerms.length >= 3, "sparse CV with clear latest role should produce multiple terms");
assertExcludesAll(sparseMarketingTerms, ["PMO", "Finance", "AI Project Manager"], "sparse CV should not use personal defaults");

assert.equal(unclearProfile.latestRole, null);
assert.deepEqual(unclearProfile.dynamicSearchTerms, []);
assert.equal(unclearProfile.searchTermWarning, "We could not confidently detect your target roles. Please add a target role or improve your CV text.");

console.log("\nAll profile search-term tests passed.");
