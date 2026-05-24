import { includesPhrase, normalizeText, tokenize, uniqueSorted } from "./text.mjs";

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

function collectMatches(text, terms) {
  return uniqueSorted((terms ?? []).filter((term) => includesPhrase(text, term)));
}

function tokenOverlapScore(resumeTokens, jobText) {
  const jobTokens = new Set(tokenize(jobText));
  const overlap = [...jobTokens].filter((token) => resumeTokens.has(token));
  const usefulOverlap = overlap.filter((token) => token.length > 2);
  const denominator = Math.max(12, jobTokens.size);
  return {
    score: Math.min(20, Math.round((usefulOverlap.length / denominator) * 100)),
    overlap: uniqueSorted(usefulOverlap).slice(0, 20)
  };
}

export function scoreJob(job, resumeProfile, config) {
  const title = normalizeText(job.title);
  const body = normalizeText([
    job.company,
    job.title,
    job.location,
    job.workMode,
    job.description,
    ...(job.tags ?? [])
  ].join(" "));

  let score = 35;
  const reasons = [];
  const warnings = [];

  const roleMatches = collectMatches(`${title} ${body}`, config.targetRoles);
  if (roleMatches.length > 0) {
    score += Math.min(22, roleMatches.length * 9);
    reasons.push(`תפקיד קרוב לפרופיל: ${roleMatches.join(", ")}`);
  }

  const skillMatches = collectMatches(body, config.coreSkills);
  const resumeSkillMatches = skillMatches.filter((skill) => resumeProfile.matchedConfiguredTerms.includes(skill));
  if (skillMatches.length > 0) {
    score += Math.min(24, skillMatches.length * 4);
    reasons.push(`התאמת כישורים: ${skillMatches.slice(0, 8).join(", ")}`);
  }

  if (resumeSkillMatches.length > 0) {
    score += Math.min(10, resumeSkillMatches.length * 2);
  }

  const domainMatches = collectMatches(body, config.domainKeywords);
  if (domainMatches.length > 0) {
    score += Math.min(8, domainMatches.length * 3);
    reasons.push(`תחום רלוונטי: ${domainMatches.join(", ")}`);
  }

  const locationMatches = collectMatches(`${job.location ?? ""} ${job.workMode ?? ""}`, [
    ...(config.preferredLocations ?? []),
    ...(config.preferredWorkModes ?? [])
  ]);
  if (locationMatches.length > 0) {
    score += 6;
    reasons.push(`מיקום/מודל עבודה מתאים: ${locationMatches.join(", ")}`);
  }

  const overlap = tokenOverlapScore(resumeProfile.tokens, body);
  score += overlap.score;
  if (overlap.overlap.length > 0) {
    reasons.push(`חפיפה טקסטואלית עם קורות החיים: ${overlap.overlap.slice(0, 10).join(", ")}`);
  }

  const avoidMatches = collectMatches(body, config.avoidKeywords);
  if (avoidMatches.length > 0) {
    score -= Math.min(35, avoidMatches.length * 15);
    warnings.push(`מילות סינון: ${avoidMatches.join(", ")}`);
  }

  if (hasAnyPhrase(title, config.seniority?.avoid ?? [])) {
    score -= 14;
    warnings.push("רמת בכירות פחות מתאימה להגדרות");
  }

  if (!job.applyUrl) {
    score -= 5;
    warnings.push("חסר קישור הגשה");
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
    matchedKeywords: uniqueSorted([...roleMatches, ...skillMatches, ...domainMatches])
  };
}

export function rankJobs(jobs, resumeProfile, config) {
  return jobs
    .map((job) => scoreJob(job, resumeProfile, config))
    .sort((a, b) => b.matchPercent - a.matchPercent || a.company.localeCompare(b.company));
}
