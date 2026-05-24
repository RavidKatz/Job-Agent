import { includesPhrase, normalizeText, tokenize, uniqueSorted } from "./text.mjs";

export function buildResumeProfile(resumeText, config) {
  const normalized = normalizeText(resumeText);
  const tokens = new Set(tokenize(normalized));
  const configuredSkills = [
    ...(config.coreSkills ?? []),
    ...(config.domainKeywords ?? []),
    ...(config.targetRoles ?? [])
  ];

  const matchedConfiguredTerms = configuredSkills.filter((term) => includesPhrase(normalized, term));

  return {
    text: normalized,
    tokens,
    matchedConfiguredTerms: uniqueSorted(matchedConfiguredTerms),
    tokenCount: tokens.size
  };
}
