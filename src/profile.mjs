import { includesPhrase, normalizeText, tokenize, uniqueSorted } from "./text.mjs";
import {
  buildDirectionSignals,
  buildDynamicSearchTerms,
  extractEducationProfile,
  extractLastRoleProfile,
  extractLatestResumeContext,
  inferSeniority,
  inferYearsExperience,
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
  const roleRecommendations = recommendRoles(resumeText, config, latestContext);
  const dynamicSearchTerms = buildDynamicSearchTerms(roleRecommendations, config, latestContext);
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
    searchTerms: resumeProfile.dynamicSearchTerms
  };
}
