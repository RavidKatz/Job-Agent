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

  // When the user explicitly provides a target role, its family always leads
  // roleRecommendations — the user's stated intent wins over CV-inferred
  // directions, no matter how strong the CV evidence is. CV-inferred roles stay
  // as secondary context. If the CV already detected the same family, that
  // entry is lifted to the front (keeping its CV score) instead of duplicated.
  if (config.targetRoleInput) {
    const targetRec = recommendRoleFromTargetInput(config.targetRoleInput);
    if (targetRec) {
      const existing = roleRecommendations.find((r) => r.id === targetRec.id);
      const rest = roleRecommendations.filter((r) => r.id !== targetRec.id);
      const lead = existing ? { ...existing, fromTargetRoleInput: true } : targetRec;
      roleRecommendations = [lead, ...rest];
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

export function mergeClaudeProfile(resumeProfile, claudeProfile) {
  if (!claudeProfile) {
    return {
      ...resumeProfile,
      profileSource: "rules"
    };
  }

  return {
    ...resumeProfile,
    previousRoles: claudeProfile.previousRoles ?? [],
    languageDetected: claudeProfile.languageDetected ?? null,
    profileWarnings: claudeProfile.profileWarnings ?? [],
    extractionQualityNotes: claudeProfile.extractionQualityNotes ?? [],
    claudeConfidenceScore: claudeProfile.claudeConfidenceScore ?? null,
    claudeSuggestedRoles: claudeProfile.claudeSuggestedRoles ?? [],
    profileSource: "claude+rules"
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
    targetRoleInput: resumeProfile.targetRoleInput,
    profileSource: resumeProfile.profileSource ?? "rules",
    previousRoles: resumeProfile.previousRoles ?? [],
    languageDetected: resumeProfile.languageDetected ?? null,
    profileWarnings: resumeProfile.profileWarnings ?? [],
    extractionQualityNotes: resumeProfile.extractionQualityNotes ?? [],
    claudeConfidenceScore: resumeProfile.claudeConfidenceScore ?? null,
    claudeSuggestedRoles: resumeProfile.claudeSuggestedRoles ?? []
  };
}
