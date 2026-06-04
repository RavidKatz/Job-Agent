/**
 * job-fit.mjs — Explicit CV-to-job evaluator layer (Phase 3A)
 *
 * Exports three named functions that make the matching flow explicit:
 *
 *   buildCandidateProfile(resumeProfile)
 *   buildJobProfile(job, config)
 *   evaluateJobFit(job, resumeProfile, config)
 *
 * This module is ADDITIVE. It wraps the existing `scoreJob` engine from
 * matcher.mjs and does not reimplement scoring. All weights and hard rules
 * stay in scoreJob; this layer only adds structure and surfaces two dimensions
 * (domainFit, transferableSkills) that were previously implicit.
 */

import { includesPhrase, normalizeText, uniqueSorted } from "./text.mjs";
import { inferJobFamily } from "./role-recommender.mjs";
import { scoreJob } from "./matcher.mjs";

// ---------------------------------------------------------------------------
// Soft-skill terms — used to split matchedConfiguredTerms into hard/soft
// ---------------------------------------------------------------------------
const SOFT_SKILL_TERMS = new Set([
  "Stakeholder Management",
  "Client Communication",
  "Project Management",
  "Project Coordination",
  "Delivery Management",
  "Process Improvement",
  "Requirements Gathering",
  "Reporting",
  "Scheduling",
  "Roadmap",
  "User Stories",
  "UAT",
  "Product Operations",
  "Project Control",
  "Project Manager",
  "PMO"
]);

// Light certification/qualification keywords used for a quick scan.
const CERTIFICATION_SIGNALS = [
  "PMP", "Prince2", "PRINCE2", "Scrum", "SAFe", "ITIL", "CPA", "CFA",
  "SHRM", "PHR", "SPHR", "AWS Certified", "Google Cloud", "Azure Certified",
  "Salesforce Certified", "certified", "certification", "license"
];

// Maps job direction IDs to plain English labels shown in jobProfile.
const DIRECTION_LABEL_EN = {
  "ai-ops": "AI / Product Operations",
  "pmo": "Project Management / PMO",
  "operations": "Operations & Process",
  "product-ops": "Product Operations",
  "implementation": "Systems Implementation",
  "data-bi": "Data & BI",
  "engineering": "Software Engineering",
  "research": "Research & ML",
  "finance": "Finance & Accounting",
  "hr-recruiting": "Human Resources & Recruiting",
  "sales": "Sales & Customer Service",
  "marketing": "Marketing & Content",
  "logistics": "Logistics & Supply Chain",
  "admin": "Administration",
  "general": "General"
};

// Full mapping from role-family IDs (from inferJobFamily) to direction IDs.
// Extends the incomplete map inside matcher.mjs to cover ALL 15 role families.
const FAMILY_TO_DIRECTION = {
  "ai-solutions":        "ai-ops",
  "project-coordination":"pmo",
  "data-business-analysis":"data-bi",
  "implementation-erp":  "implementation",
  "digital-projects":    "product-ops",
  "operations":          "operations",
  "product-operations":  "product-ops",
  "software-development":"engineering",
  "finance-accounting":  "finance",
  "hr-recruiting":       "hr-recruiting",
  "sales-customer-service":"sales",
  "marketing-content":   "marketing",
  "logistics-supply-chain":"logistics",
  "administration-office":"admin"
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectMatches(text, terms) {
  return uniqueSorted((terms ?? []).filter((term) => includesPhrase(text, term)));
}

function splitRequirementSegments(text) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .split(/[\n.;•]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

const OPTIONAL_CUES = ["advantage", "nice to have", "preferred", "bonus", "plus"];
const MUST_HAVE_CUES = [
  "requirement", "requirements", "qualifications", "must have", "required",
  "experience with", "experience in", "proficiency", "knowledge of", "hands-on"
];
const HARD_REQUIREMENT_CUES = ["must", "required", "minimum", "at least", "mandatory", "proven", "hands-on"];
const RESPONSIBILITY_CUES = [
  "responsibilities", "what you will do", "what you'll do", "day to day",
  "in this role", "you will", "own", "lead", "manage", "coordinate"
];
const EDUCATION_CUES = [
  "degree", "bachelor", "master", "b.sc", "m.sc", "b.a", "m.a", "mba",
  "computer science", "engineering", "information systems", "finance", "accounting"
];

function hasAnyPhrase(text, phrases) {
  return phrases.some((p) => includesPhrase(text, p));
}

// ---------------------------------------------------------------------------
// buildCandidateProfile(resumeProfile) → structured candidate view
//
// Pure mapping over the existing resumeProfile — no new analysis performed.
// ---------------------------------------------------------------------------
export function buildCandidateProfile(resumeProfile) {
  const matched = resumeProfile.matchedConfiguredTerms ?? [];
  const hardSkills = matched.filter((t) => !SOFT_SKILL_TERMS.has(t));
  const softSkills = matched.filter((t) => SOFT_SKILL_TERMS.has(t));

  // Quick scan of last-role text for certifications.
  const lastRoleText = (resumeProfile.lastRole?.responsibilities ?? []).join(" ");
  const cvText = resumeProfile.text ?? "";
  const certifications = CERTIFICATION_SIGNALS.filter(
    (sig) => includesPhrase(cvText, sig) || includesPhrase(lastRoleText, sig)
  );

  const likelyTargetRoles = (resumeProfile.roleRecommendations ?? [])
    .filter((r) => r.score >= 40)
    .map((r) => ({
      title: r.title,
      id: r.id,
      score: r.score,
      searchTerms: r.searchTerms,
      evidence: r.matchedSignals ?? []
    }));

  const misalignedRoles = uniqueSorted(
    (resumeProfile.directionSignals?.negative ?? []).slice(0, 10)
  );

  // Map role-family IDs → direction labels (covers all 15 families).
  const professionalDomain = uniqueSorted([
    ...(resumeProfile.education?.directions ?? [])
      .map((d) => DIRECTION_LABEL_EN[d] ?? d),
    ...(resumeProfile.roleRecommendations ?? [])
      .slice(0, 3)
      .map((r) => DIRECTION_LABEL_EN[FAMILY_TO_DIRECTION[r.id] ?? r.id] ?? r.id)
  ]).filter(Boolean).slice(0, 4);

  return {
    latestRole: resumeProfile.lastRole?.title ?? resumeProfile.latestRole ?? null,
    latestRoleTools: resumeProfile.lastRole?.tools ?? [],
    latestRoleResponsibilities: resumeProfile.lastRole?.responsibilities ?? [],
    previousRoles: [],                          // populated when employment entries exposed
    professionalDomain,
    seniority: resumeProfile.seniority ?? null,
    yearsExperience: resumeProfile.yearsExperience ?? null,
    educationField: resumeProfile.education?.field ?? null,
    educationSpecialization: resumeProfile.education?.specialization ?? null,
    educationSupportsEngineering: resumeProfile.education?.supportsEngineering ?? false,
    certifications,
    tools: uniqueSorted([
      ...(resumeProfile.lastRole?.tools ?? []),
      ...hardSkills.filter((t) => /sql|python|java|react|node|excel|tableau|qlik|jira|monday|erp|crm|sap|power bi|api/i.test(t))
    ]),
    hardSkills,
    softSkills,
    likelyTargetRoles,
    misalignedRoles,
    targetRoleInput: resumeProfile.targetRoleInput ?? null,
    searchTermWarning: resumeProfile.searchTermWarning ?? null,
    // Evidence chain: per direction, which CV signals support the conclusion.
    evidence: Object.fromEntries(
      (resumeProfile.roleRecommendations ?? []).map((r) => [r.title, r.matchedSignals ?? []])
    )
  };
}

// ---------------------------------------------------------------------------
// buildJobProfile(job, config) → structured job view
//
// Extracts the explainability view of a job. This is independent of scoring;
// it is only used to show the user what the job requires.
// ---------------------------------------------------------------------------
export function buildJobProfile(job, config) {
  const rawText = [
    job.company,
    job.title,
    job.location,
    job.workMode,
    job.description,
    ...(job.tags ?? [])
  ].join(" ");
  const body = normalizeText(rawText);
  const segments = splitRequirementSegments(rawText);

  const mustHaves = uniqueSorted(
    segments
      .filter((s) => hasAnyPhrase(s, MUST_HAVE_CUES) && !hasAnyPhrase(s, OPTIONAL_CUES))
      .slice(0, 8)
  );

  const niceToHaves = uniqueSorted(
    segments
      .filter((s) => hasAnyPhrase(s, OPTIONAL_CUES))
      .slice(0, 5)
  );

  const essence = uniqueSorted(
    segments
      .filter((s) => hasAnyPhrase(s, RESPONSIBILITY_CUES))
      .slice(0, 6)
  ).join(" ").trim() || normalizeText(job.description ?? "").slice(0, 300);

  const requiredEducation = segments
    .filter((s) => hasAnyPhrase(s, EDUCATION_CUES))
    .slice(0, 3)
    .join(" ").trim() || null;

  // Required years — pull the highest numeric year mention.
  const yearMatches = [...normalizeText(rawText).matchAll(/(\d{1,2})\+?\s*(?:years?|yrs?)\b/giu)];
  const requiredYears = yearMatches.length
    ? Math.max(...yearMatches.map((m) => Number(m[1])).filter((v) => v > 0 && v < 30))
    : null;

  const toolsFound = collectMatches(body, config.toolKeywords ?? []);
  const skillsFound = collectMatches(body, config.coreSkills ?? []);

  const redFlagSignals = [
    "backend developer", "backend development", "software engineer",
    "machine learning engineer", "deep learning", "devops", "full stack",
    "frontend developer", "llm engineer", "cyber", "production ml"
  ].filter((s) => includesPhrase(body, s));

  // Infer seniority from title + body.
  const seniority =
    /senior|lead|head of|director|vp\b/i.test(rawText) ? "senior"
    : /junior|intern|internship|entry level/i.test(rawText) ? "junior"
    : "mid";

  const jobFamilyId = inferJobFamily(rawText);
  const domain = jobFamilyId
    ? (DIRECTION_LABEL_EN[FAMILY_TO_DIRECTION[jobFamilyId] ?? "general"] ?? null)
    : null;

  return {
    title: job.title ?? null,
    company: job.company ?? null,
    essence,
    mustHaves,
    niceToHaves,
    requiredYears,
    requiredEducation,
    tools: toolsFound,
    skills: skillsFound,
    domain,
    seniority,
    redFlags: redFlagSignals,
    source: job.source ?? null,
    dataQualityScore: job.quality?.dataQualityScore ?? null
  };
}

// ---------------------------------------------------------------------------
// evaluateJobFit(job, resumeProfile, config) → the named evaluator entry point
//
// Delegates scoring to the existing scoreJob engine and returns a structured
// object covering all ten dimensions plus the two candidate/job profiles.
// ---------------------------------------------------------------------------
export function evaluateJobFit(job, resumeProfile, config) {
  // Delegate scoring to the battle-tested engine.
  const scored = scoreJob(job, resumeProfile, config);
  const fa = scored.fitAnalysis;
  const mb = scored.matchBreakdown;

  // Build the explicit structured objects.
  const candidateProfile = buildCandidateProfile(resumeProfile);
  const jobProfile = buildJobProfile(job, config);

  // Domain fit: does the job's inferred domain match the candidate's directions?
  const candidateDirectionLabels = new Set(
    candidateProfile.professionalDomain.map((d) => d.toLowerCase())
  );
  const jobDomainLower = (jobProfile.domain ?? "").toLowerCase();
  const domainFitScore = jobDomainLower && candidateProfile.professionalDomain.length
    ? (candidateDirectionLabels.has(jobDomainLower) ? 1.0 : 0.3)
    : 0.5;  // unknown → neutral

  // Transferable skills: candidate skills that appear in the job text (beyond exact matches).
  const jobBody = normalizeText([job.title, job.description].join(" "));
  const allCandidateSkills = uniqueSorted([
    ...candidateProfile.hardSkills,
    ...candidateProfile.softSkills,
    ...candidateProfile.tools
  ]);
  const exactMatches = new Set(scored.matchedKeywords ?? []);
  const transferable = allCandidateSkills.filter(
    (skill) => !exactMatches.has(skill) && includesPhrase(jobBody, skill)
  );

  // Hard blockers: critical missing requirements + engineering cap.
  const hardBlockers = [];
  if ((scored.fitAnalysis.gaps ?? "").includes("קריטיות")) {
    hardBlockers.push("Critical must-have requirement missing");
  }
  if (jobProfile.redFlags.length && !candidateProfile.educationSupportsEngineering) {
    hardBlockers.push(`Role requires deep technical signals: ${jobProfile.redFlags.slice(0, 3).join(", ")}`);
  }

  const dimensions = {
    // 1–8 come directly from the weighted model scores
    latestRoleAlignment:  { score: mb.recentRoleAlignment,  maxScore: 30, evidence: fa.recentRoleSupport  },
    jobEssenceAlignment:  { score: mb.jobEssenceAlignment,  maxScore: 25, evidence: fa.whyFits           },
    mustHaveRequirements: { score: mb.mustHaveMatch,        maxScore: 20, evidence: fa.whatsMissing       },
    skillsAndTools:       { score: mb.toolsMatch,           maxScore: 10, evidence: scored.matchedKeywords?.join(", ") ?? "" },
    educationRelevance:   { score: mb.educationMatch,       maxScore: 10, evidence: fa.educationSupport   },
    seniorityAndYears:    { score: mb.experienceSeniority,  maxScore: 5,  evidence: fa.experienceFit ?? "" },
    careerDirection:      { score: mb.careerDirectionFit,   maxScore: 30, evidence: fa.recentRoleSupport  },
    // 9–10 newly surfaced from domain + transferable logic
    domainFit: {
      score:    Math.round(domainFitScore * 10),
      maxScore: 10,
      candidateDomains: candidateProfile.professionalDomain,
      jobDomain:        jobProfile.domain,
      aligned:          domainFitScore >= 0.7
    },
    transferableSkills: {
      skills:   transferable.slice(0, 8),
      count:    transferable.length,
      evidence: transferable.length
        ? `${transferable.slice(0, 5).join(", ")} appear in the job but are not exact matches`
        : "No additional transferable signals detected"
    },
    hardBlockers: {
      blockers: hardBlockers,
      hasBlockers: hardBlockers.length > 0
    }
  };

  return {
    // Core fit output
    fitPercentage:    scored.matchPercent,
    confidenceScore:  scored.confidenceScore ?? fa.confidenceScore ?? null,
    fitLabel:         fa.fitLabel,
    recommendation:   fa.finalRecommendation,
    recommendationHe: fa.finalRecommendationHe,

    // Explanations (Hebrew primary)
    hebrewSummary:    fa.hebrewSummary,
    whyItFits:        fa.whyFits,
    whatIsMissing:    fa.whatsMissing,
    risks:            fa.risks,
    cvTailoring:      fa.cvTailoring,
    recentRoleNote:   fa.recentRoleSupport,
    educationNote:    fa.educationSupport,

    // Structured profiles
    candidateProfile,
    jobProfile,

    // Ten dimensions
    dimensions,

    // Pass-through for UI/pipeline compatibility
    matchBreakdown:   mb,
    warnings:         scored.warnings,
    category:         scored.category,
    dataQuality:      scored.dataQuality
  };
}
