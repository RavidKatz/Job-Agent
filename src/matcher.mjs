import { includesPhrase, normalizeText, tokenize, uniqueSorted } from "./text.mjs";

const GENERIC_OVERLAP_TOKENS = new Set([
  "ability",
  "background",
  "business",
  "company",
  "cross",
  "customer",
  "delivery",
  "environment",
  "experience",
  "functional",
  "lead",
  "leading",
  "management",
  "manager",
  "process",
  "processes",
  "project",
  "projects",
  "responsibilities",
  "stakeholder",
  "stakeholders",
  "team",
  "teams",
  "technical",
  "work",
  "working"
]);

const REQUIREMENT_CUES = [
  "requirement",
  "requirements",
  "qualification",
  "qualifications",
  "what you bring",
  "must have",
  "required",
  "requirements",
  "experience with",
  "experience in",
  "proficiency",
  "proficient",
  "knowledge of",
  "familiarity",
  "hands-on",
  "advantage",
  "nice to have",
  "preferred"
];

const HARD_REQUIREMENT_CUES = [
  "must",
  "required",
  "minimum",
  "at least",
  "proven experience",
  "hands-on",
  "strong experience"
];

const SENIORITY_TERMS = [
  "Senior",
  "Lead",
  "Head of",
  "Director",
  "VP"
];

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

function collectMatches(text, terms) {
  return uniqueSorted((terms ?? []).filter((term) => includesPhrase(text, term)));
}

function distinctiveResumeTerms(resumeProfile, config) {
  return uniqueSorted([
    ...(resumeProfile.matchedConfiguredTerms ?? []),
    ...(config.coreSkills ?? []).filter((skill) => resumeProfile.matchedConfiguredTerms.includes(skill)),
    ...(config.domainKeywords ?? []).filter((term) => resumeProfile.matchedConfiguredTerms.includes(term))
  ]);
}

function tokenOverlapScore(resumeProfile, jobText, config) {
  const jobTokens = new Set(tokenize(jobText));
  const allowedTokens = new Set(
    distinctiveResumeTerms(resumeProfile, config)
      .flatMap((term) => tokenize(term))
      .filter((token) => token.length > 2 && !GENERIC_OVERLAP_TOKENS.has(token))
  );
  const overlap = [...jobTokens].filter((token) => allowedTokens.has(token));
  const denominator = Math.max(8, allowedTokens.size || 1);

  return {
    score: Math.min(8, Math.round((overlap.length / denominator) * 12)),
    overlap: uniqueSorted(overlap).slice(0, 12)
  };
}

function splitRequirementSegments(text) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .split(/[\n.;•]+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 12);
}

function extractRequirementText(rawText) {
  const segments = splitRequirementSegments(rawText);
  const directSegments = segments.filter((segment) => {
    return hasAnyPhrase(segment, REQUIREMENT_CUES);
  });
  const firstHeaderIndex = segments.findIndex((segment) => {
    return hasAnyPhrase(segment, ["requirements", "qualifications", "what you bring"]);
  });
  const followingSegments = firstHeaderIndex >= 0
    ? segments.slice(firstHeaderIndex, firstHeaderIndex + 10)
    : [];

  return uniqueSorted([...directSegments, ...followingSegments]).join(" ");
}

function inferRequiredYears(text) {
  const normalized = normalizeText(text);
  const years = [];
  const patterns = [
    /(\d{1,2})\+?\s*(?:years|year)\s+(?:of\s+)?(?:experience|relevant experience)/giu,
    /(?:at least|minimum)\s+(\d{1,2})\+?\s*(?:years|year)/giu,
    /(\d{1,2})\+?\s*(?:yrs|yr)/giu
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0 && value < 30) {
        years.push(value);
      }
    }
  }

  return years.length ? Math.max(...years) : null;
}

function isOutOfMarket(location, workMode, config) {
  const locationText = normalizeText(location);
  const text = normalizeText(`${location ?? ""} ${workMode ?? ""}`);
  const localMarket = (config.preferredLocations ?? [])
    .filter((place) => !["Remote", "Hybrid", "On-site"].includes(place))
    .some((place) => includesPhrase(text, place));
  const remoteOnly = locationText === "remote" || locationText === "";
  const clearForeignMarket = [
    "Amsterdam",
    "Belgium",
    "Canada",
    "Europe",
    "France",
    "Netherlands",
    "Serbia",
    "South Africa",
    "Spain",
    "United States",
    "USA",
    "US only",
    "New York",
    "California",
    "United Kingdom",
    "UK"
  ].some((place) => includesPhrase(text, place));

  return !localMarket && (clearForeignMarket || !remoteOnly);
}

function isSeniorityMismatch(title, resumeProfile) {
  const seniorTitle = SENIORITY_TERMS.some((term) => includesPhrase(title, term));
  if (!seniorTitle) return false;
  return resumeProfile.yearsExperience == null || resumeProfile.yearsExperience < 5;
}

function capScore(score, cap, warnings, message) {
  if (score > cap) {
    warnings.push(message);
    return cap;
  }
  return score;
}

function dedupeRankedJobs(rankedJobs) {
  const bestByKey = new Map();

  for (const job of rankedJobs) {
    const normalizedUrl = normalizeText(job.applyUrl).replace(/\/+$/u, "");
    const key = normalizedUrl || [
      normalizeText(job.company),
      normalizeText(job.position)
    ].join("|");
    const existing = bestByKey.get(key);
    if (!existing || job.matchPercent > existing.matchPercent) {
      bestByKey.set(key, job);
    }
  }

  return [...bestByKey.values()];
}

function scoreRoleFit(title, body, config, reasons) {
  const titleRoleMatches = collectMatches(title, config.targetRoles);
  const bodyRoleMatches = collectMatches(body, config.targetRoles).filter((role) => {
    return !titleRoleMatches.includes(role);
  });

  if (titleRoleMatches.length > 0) {
    const score = Math.min(30, 18 + (titleRoleMatches.length * 6));
    reasons.push(`Role fit from title: ${titleRoleMatches.join(", ")}`);
    return { score, titleRoleMatches, bodyRoleMatches };
  }

  if (bodyRoleMatches.length > 0) {
    reasons.push(`Role signal in description: ${bodyRoleMatches.slice(0, 4).join(", ")}`);
    return { score: Math.min(8, bodyRoleMatches.length * 3), titleRoleMatches, bodyRoleMatches };
  }

  return { score: 0, titleRoleMatches, bodyRoleMatches };
}

function scoreRequirementFit({ body, requirementText, resumeProfile, config, reasons, warnings }) {
  const comparisonText = requirementText || body;
  const requirementTerms = collectMatches(comparisonText, config.coreSkills);
  const resumeRequirementMatches = requirementTerms.filter((skill) => {
    return resumeProfile.matchedConfiguredTerms.includes(skill);
  });
  const missingRequirementTerms = requirementTerms.filter((skill) => {
    return !resumeRequirementMatches.includes(skill);
  });
  const hardRequirementTerms = requirementTerms.filter((skill) => {
    return includesPhrase(requirementText, skill) && hasAnyPhrase(requirementText, HARD_REQUIREMENT_CUES);
  });
  const hardMatches = hardRequirementTerms.filter((skill) => resumeRequirementMatches.includes(skill));
  const coverage = requirementTerms.length
    ? resumeRequirementMatches.length / requirementTerms.length
    : 0;
  const hardCoverage = hardRequirementTerms.length
    ? hardMatches.length / hardRequirementTerms.length
    : 1;
  const score = requirementTerms.length
    ? Math.round((coverage * 26) + (hardCoverage * 6))
    : Math.min(18, resumeRequirementMatches.length * 4);

  if (requirementTerms.length > 0) {
    reasons.push(`Requirement coverage: ${resumeRequirementMatches.length}/${requirementTerms.length} matched`);
  }

  if (resumeRequirementMatches.length > 0) {
    reasons.push(`Matched requirements: ${resumeRequirementMatches.slice(0, 8).join(", ")}`);
  }

  if (missingRequirementTerms.length > 0 && requirementTerms.length >= 4) {
    warnings.push(`Missing requirement signals: ${missingRequirementTerms.slice(0, 5).join(", ")}`);
  }

  return {
    score,
    requirementTerms,
    resumeRequirementMatches,
    missingRequirementTerms,
    coverage,
    hardCoverage
  };
}

function scoreExperienceFit(jobText, resumeProfile, reasons, warnings) {
  const requiredYears = inferRequiredYears(jobText);
  if (requiredYears == null) {
    return { score: 6, requiredYears };
  }

  if (resumeProfile.yearsExperience == null) {
    warnings.push(`Required experience not confirmed: ${requiredYears}+ years`);
    return { score: 2, requiredYears };
  }

  if (resumeProfile.yearsExperience >= requiredYears) {
    reasons.push(`Experience fit: ${resumeProfile.yearsExperience}/${requiredYears}+ years`);
    return { score: 8, requiredYears };
  }

  warnings.push(`Experience gap: ${resumeProfile.yearsExperience}/${requiredYears}+ years`);
  return { score: 1, requiredYears };
}

export function scoreJob(job, resumeProfile, config) {
  const title = normalizeText(job.title);
  const rawJobText = [
    job.company,
    job.title,
    job.location,
    job.workMode,
    job.description,
    ...(job.tags ?? [])
  ].join(" ");
  const body = normalizeText(rawJobText);
  const requirementText = normalizeText(extractRequirementText(rawJobText));

  let score = 4;
  const reasons = [];
  const warnings = [];

  const roleFit = scoreRoleFit(title, body, config, reasons);
  score += roleFit.score;

  const requirementFit = scoreRequirementFit({
    body,
    requirementText,
    resumeProfile,
    config,
    reasons,
    warnings
  });
  score += requirementFit.score;

  const domainMatches = collectMatches(body, config.domainKeywords);
  const resumeDomainMatches = domainMatches.filter((domain) => resumeProfile.matchedConfiguredTerms.includes(domain));
  if (resumeDomainMatches.length > 0) {
    score += Math.min(5, resumeDomainMatches.length * 3);
    reasons.push(`Domain match: ${resumeDomainMatches.join(", ")}`);
  } else if (domainMatches.length > 0) {
    score += Math.min(3, domainMatches.length);
  }

  const locationMatches = collectMatches(`${job.location ?? ""} ${job.workMode ?? ""}`, [
    ...(config.preferredLocations ?? []),
    ...(config.preferredWorkModes ?? [])
  ]);
  if (locationMatches.length > 0) {
    score += 10;
    reasons.push(`Location fit: ${locationMatches.join(", ")}`);
  }

  const experienceFit = scoreExperienceFit(body, resumeProfile, reasons, warnings);
  score += experienceFit.score;

  const overlap = tokenOverlapScore(resumeProfile, body, config);
  score += overlap.score;
  if (overlap.overlap.length > 0) {
    reasons.push(`Resume evidence overlap: ${overlap.overlap.slice(0, 10).join(", ")}`);
  }

  const avoidMatches = collectMatches(body, config.avoidKeywords);
  if (avoidMatches.length > 0) {
    score -= Math.min(35, avoidMatches.length * 15);
    warnings.push(`Negative filters: ${avoidMatches.join(", ")}`);
  }

  if (hasAnyPhrase(title, config.seniority?.avoid ?? [])) {
    score -= 14;
    warnings.push("Seniority level is less aligned with the profile settings");
  }

  if (isSeniorityMismatch(title, resumeProfile)) {
    score = capScore(score - 10, 64, warnings, "Role seniority appears too high for the detected experience level");
  }

  if (!job.applyUrl) {
    score -= 5;
    warnings.push("Missing direct application link");
  }

  if (roleFit.titleRoleMatches.length === 0) {
    score = capScore(score, 68, warnings, "Title is not a direct fit for the recommended role directions");
  }

  if (requirementFit.requirementTerms.length >= 4 && requirementFit.coverage < 0.5) {
    score = capScore(score, 66, warnings, "Less than half of detected requirements are supported by the resume");
  }

  if (requirementFit.hardCoverage < 0.6) {
    score = capScore(score, 62, warnings, "Hard requirements are not sufficiently covered by the resume");
  }

  if (requirementFit.resumeRequirementMatches.length < 3) {
    score = capScore(score, 68, warnings, "Not enough requirement-backed resume evidence");
  }

  if (experienceFit.requiredYears != null && resumeProfile.yearsExperience != null && resumeProfile.yearsExperience < experienceFit.requiredYears) {
    score = capScore(score, 63, warnings, "Required years of experience exceed detected resume experience");
  }

  if (isOutOfMarket(job.location, job.workMode, config)) {
    score = capScore(score, 62, warnings, "Location appears outside the preferred market");
  }

  const matchPercent = Math.max(0, Math.min(100, Math.round(score)));

  return {
    company: job.company ?? "",
    position: job.title ?? "",
    matchPercent,
    status: "Found",
    appliedVia: job.source ?? "",
    applyUrl: job.applyUrl ?? "",
    location: job.location ?? "",
    postedAt: job.postedAt ?? "",
    notes: reasons.join(" | "),
    warnings: warnings.join(" | "),
    matchedKeywords: uniqueSorted([
      ...roleFit.titleRoleMatches,
      ...requirementFit.resumeRequirementMatches,
      ...resumeDomainMatches
    ]),
    matchBreakdown: {
      roleFit: roleFit.score,
      requirementFit: requirementFit.score,
      requirementCoverage: requirementFit.requirementTerms.length
        ? Math.round(requirementFit.coverage * 100)
        : null,
      requiredYears: experienceFit.requiredYears
    }
  };
}

export function rankJobs(jobs, resumeProfile, config) {
  const ranked = jobs
    .map((job) => scoreJob(job, resumeProfile, config))
    .sort((a, b) => b.matchPercent - a.matchPercent || a.company.localeCompare(b.company));

  return dedupeRankedJobs(ranked)
    .sort((a, b) => b.matchPercent - a.matchPercent || a.company.localeCompare(b.company));
}
