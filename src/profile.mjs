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

  // When the user explicitly provides a target role, always ensure its family
  // appears in roleRecommendations so the profile display, direction signals,
  // and scoring all reflect the user's stated intent.
  //
  // Ordering rule: prefer the target role as the top recommendation unless
  // the CV already has clearly strong evidence (score >= 75) for a different
  // direction. In that case, the CV-backed direction leads and the target role
  // is appended as a secondary option.
  //
  // If the CV already detected the same family, do not add a duplicate.
  if (config.targetRoleInput) {
    const targetRec = recommendRoleFromTargetInput(config.targetRoleInput);
    if (targetRec && !roleRecommendations.some((r) => r.id === targetRec.id)) {
      const hasStrongCvRec = roleRecommendations.some((r) => r.score >= 75);
      roleRecommendations = hasStrongCvRec
        ? [...roleRecommendations, targetRec]
        : [targetRec, ...roleRecommendations];
    }
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
