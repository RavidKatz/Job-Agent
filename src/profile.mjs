import { includesPhrase, normalizeText, tokenize, uniqueSorted } from "./text.mjs";
import { buildDynamicSearchTerms, inferSeniority, inferYearsExperience, recommendRoles } from "./role-recommender.mjs";

export function buildResumeProfile(resumeText, config) {
  const normalized = normalizeText(resumeText);
  const tokens = new Set(tokenize(normalized));
  const configuredSkills = [
    ...(config.coreSkills ?? []),
    ...(config.domainKeywords ?? []),
    ...(config.targetRoles ?? [])
  ];

  const matchedConfiguredTerms = configuredSkills.filter((term) => includesPhrase(normalized, term));
  const yearsExperience = inferYearsExperience(resumeText);
  const roleRecommendations = recommendRoles(resumeText, config);
  const dynamicSearchTerms = buildDynamicSearchTerms(roleRecommendations, config);

  return {
    text: normalized,
    tokens,
    matchedConfiguredTerms: uniqueSorted(matchedConfiguredTerms),
    yearsExperience,
    seniority: inferSeniority(yearsExperience),
    roleRecommendations,
    dynamicSearchTerms,
    tokenCount: tokens.size
  };
}

export function toPublicResumeProfile(resumeProfile) {
  return {
    matchedTerms: resumeProfile.matchedConfiguredTerms,
    yearsExperience: resumeProfile.yearsExperience,
    seniority: resumeProfile.seniority,
    roleRecommendations: resumeProfile.roleRecommendations,
    searchTerms: resumeProfile.dynamicSearchTerms
  };
}
