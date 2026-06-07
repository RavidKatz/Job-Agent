import { includesPhrase, normalizeText, tokenize, uniqueSorted } from "./text.mjs";
import {
  buildDirectionSignals,
  buildDynamicSearchTerms,
  extractEducationProfile,
  extractLastRoleProfile,
  extractLatestResumeContext,
  inferSeniority,
  inferYearsExperience,
  recommendRoleFromTargetInput,
  recommendRoles
} from "./role-recommender.mjs";

function matchesConfiguredTerm(normalizedResume, term, aliases = {}) {
  const candidates = [term, ...(aliases[term] ?? [])];
  return candidates.some((candidate) => includesPhrase(normalizedResume, candidate));
}

export function buildResumeProfile(resumeText, config) {
  const normalized = normalizeText(resumeText);
  const tokens = new Set(tokenize(normalized));
  const configuredSkills = [
    ...(config.coreSkills ?? []),
    ...(config.domainKeywords ?? []),
    ...(config.targetRoles ?? [])
  ];

  const matchedConfiguredTerms = configuredSkills.filter((term) => {
    return matchesConfiguredTerm(normalized, term, config.skillAliases ?? {});
  });
  const yearsExperience = inferYearsExperience(resumeText);
  const latestContext = extractLatestResumeContext(resumeText, config);
  let roleRecommendations = recommendRoles(resumeText, config, latestContext);

  // Fallback: when the CV produces no strong recommendation, seed the candidate
  // direction from the explicitly typed target role. This keeps "best direction",
  // role recommendations, direction signals, and the per-job evidence chain
  // populated for sparse or non-English CVs. Strong CVs are left untouched.
  if (!roleRecommendations.length && config.targetRoleInput) {
    const fallback = recommendRoleFromTargetInput(config.targetRoleInput);
    if (fallback) roleRecommendations = [fallback];
  }

  const dynamicSearchTerms = buildDynamicSearchTerms(roleRecommendations, config, latestContext);
  const searchTermWarning = dynamicSearchTerms.length
    ? null
    : "We could not confidently detect your target roles. Please add a target role or improve your CV text.";
  const education = extractEducationProfile(resumeText, config);
  const lastRole = extractLastRoleProfile(resumeText, config);
  const directionSignals = buildDirectionSignals(roleRecommendations);

  return {
    text: normalized,
    tokens,
    matchedConfiguredTerms: uniqueSorted(matchedConfiguredTerms),
    yearsExperience,
    seniority: inferSeniority(yearsExperience),
    latestRole: latestContext.latestRole,
    latestEducation: latestContext.latestEducation,
    education,
    lastRole,
    directionSignals,
    roleRecommendations,
    dynamicSearchTerms,
    searchTermWarning,
    targetRoleInput: config.targetRoleInput ?? null,
    tokenCount: tokens.size
  };
}

export function toPublicResumeProfile(resumeProfile) {
  return {
    matchedTerms: resumeProfile.matchedConfiguredTerms,
    yearsExperience: resumeProfile.yearsExperience,
    seniority: resumeProfile.seniority,
    latestRole: resumeProfile.latestRole,
    latestEducation: resumeProfile.latestEducation,
    education: resumeProfile.education,
    lastRole: resumeProfile.lastRole,
    roleRecommendations: resumeProfile.roleRecommendations,
    searchTerms: resumeProfile.dynamicSearchTerms,
    searchTermWarning: resumeProfile.searchTermWarning,
    targetRoleInput: resumeProfile.targetRoleInput
  };
}
