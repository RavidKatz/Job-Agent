import { includesPhrase, normalizeText, uniqueSorted } from "./text.mjs";
import { inferJobFamily } from "./role-recommender.mjs";

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

const RESPONSIBILITY_CUES = [
  "responsibilities",
  "what you will do",
  "what you'll do",
  "day to day",
  "in this role",
  "you will",
  "own",
  "lead",
  "manage",
  "coordinate",
  "track",
  "define",
  "analyze",
  "improve"
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

const CRITICAL_REQUIREMENT_CUES = [
  "must",
  "required",
  "minimum",
  "at least",
  "mandatory",
  "proven",
  "hands-on"
];

const OPTIONAL_REQUIREMENT_CUES = [
  "advantage",
  "nice to have",
  "preferred",
  "bonus",
  "plus"
];

const RELATED_SKILL_GROUPS = [
  [
    "Low-code",
    "No-code",
    "AI Agent",
    "AI Workflows",
    "Automation",
    "Builder Mindset",
    "Dashboard",
    "KPI Dashboard",
    "Knowledge Agent",
    "Workflow Automation"
  ],
  [
    "AI Solution Manager",
    "AI Project Manager",
    "AI Operations Manager",
    "AI",
    "AI Agent",
    "AI Workflows",
    "Automation",
    "Process Improvement",
    "Stakeholder Management",
    "Workflow Automation"
  ],
  [
    "Project Management",
    "Project Coordination",
    "PMO",
    "Process Improvement",
    "Project Manager",
    "Stakeholder Management"
  ],
  [
    "Dashboard",
    "KPI Dashboard",
    "Data Analysis",
    "Data Visualization",
    "Excel",
    "Qlik",
    "Reporting",
    "Tableau"
  ]
];

const EXACT_SUPPORT = 1;
const RELATED_SUPPORT = 0.62;
const STRONG_RELATED_SUPPORT = 0.78;
const MIN_SUPPORTED_STRENGTH = 0.5;
const STRONG_SUPPORTED_STRENGTH = 0.72;

const STRICT_EXACT_TERMS = [
  "Make",
  "n8n",
  "Workato",
  "Zapier",
  "SQL",
  "SQL Server",
  "Python",
  "Tableau",
  "Qlik",
  "NetSuite",
  "Jira",
  "Monday",
  "Figma"
];

const SENIORITY_TERMS = [
  "Senior",
  "Lead",
  "Head of",
  "Director",
  "VP"
];

const ENTRY_LEVEL_TERMS = [
  "Intern",
  "Internship",
  "Student",
  "Junior",
  "Associate",
  "Coordinator",
  "Entry Level"
];

const MID_LEVEL_TERMS = [
  "Specialist",
  "Analyst",
  "Project Manager",
  "Implementation",
  "Operations"
];

const ROLE_SUBSTANCE_SIGNALS = [
  "Project tracking",
  "Delivery execution",
  "Cross-functional coordination",
  "PMO",
  "Operations",
  "Requirements gathering",
  "Dashboard",
  "KPI Dashboard",
  "Process Improvement",
  "AI Agent",
  "AI Workflows",
  "CRM",
  "ERP",
  "Systems Implementation",
  "Stakeholder Management",
  "Data Analysis",
  "Reporting",
  "Workflow Automation"
];

const NEGATIVE_ROLE_SUBSTANCE = [
  "backend developer",
  "backend development",
  "software engineer",
  "development manager",
  "software development manager",
  "deep learning engineer",
  "machine learning engineer",
  "AI engineer",
  "cloud architect",
  "devops",
  "infrastructure",
  "cyber",
  "cyber systems",
  "performance marketing",
  "recruiter",
  "talent acquisition",
  "מנהל/ת פיתוח",
  "מנהל פיתוח",
  "פיתוח תוכנה",
  "סייבר"
];

const ENGINEERING_DEPTH_SIGNALS = [
  "backend developer",
  "backend development",
  "software engineer",
  "software development manager",
  "development manager",
  "full stack",
  "frontend",
  "react developer",
  "node.js",
  "java",
  "c#",
  "kubernetes",
  "docker",
  "devops",
  "ci/cd",
  "cloud architecture",
  "aws architecture",
  "microservices",
  "production ml",
  "model training",
  "rag production",
  "vector database",
  "llm engineer",
  "ml engineer",
  "machine learning engineer",
  "deep learning",
  "cyber",
  "cyber systems",
  "מנהל/ת פיתוח",
  "מנהל פיתוח",
  "פיתוח תוכנה",
  "סייבר"
];

const JOB_CATEGORIES = [
  {
    name: "AI / Product Ops",
    highTerms: ["AI Solution Manager", "AI Operations Manager", "Product Operations", "AI Workflows", "AI Agent", "Workflow Automation"],
    mediumTerms: ["AI Project Manager", "Automation", "Dashboard", "KPI Dashboard"]
  },
  {
    name: "Technical PMO",
    highTerms: ["Technical PMO", "PMO", "Project Coordinator", "Project Management", "Project Coordination"],
    mediumTerms: ["Reporting", "Dashboard", "Jira", "Monday", "Stakeholder Management"]
  },
  {
    name: "Delivery & Operations",
    highTerms: ["Delivery", "Operations", "Project Manager", "Process Improvement", "Stakeholder Management"],
    mediumTerms: ["Project Coordination", "Reporting", "Workflow Automation"]
  },
  {
    name: "Junior Product",
    highTerms: ["Junior Product Manager", "Product Operations", "Product Analyst", "Requirements gathering"],
    mediumTerms: ["Figma", "Data Analysis", "Stakeholder Management", "CRM"]
  },
  {
    name: "Solutions / Implementation",
    highTerms: ["Implementation", "Solutions Engineer", "Systems Implementation", "CRM", "ERP"],
    mediumTerms: ["NetSuite", "Stakeholder Management", "Project Management"]
  },
  {
    name: "Information Systems",
    highTerms: ["Information Systems", "Systems Implementer", "ERP", "CRM", "NetSuite"],
    mediumTerms: ["SQL", "Microsoft Access", "Data Analysis"]
  },
  {
    name: "Data / BI",
    highTerms: ["Data Analyst", "BI", "Data Visualization", "SQL", "Tableau", "Qlik"],
    mediumTerms: ["Python", "Excel", "Statistical Analysis"]
  }
];

function hasAnyPhrase(text, phrases) {
  return phrases.some((phrase) => includesPhrase(text, phrase));
}

function collectMatches(text, terms) {
  return uniqueSorted((terms ?? []).filter((term) => includesPhrase(text, term)));
}

function collectConfiguredMatches(text, terms, aliases = {}) {
  return uniqueSorted((terms ?? []).filter((term) => {
    return [term, ...(aliases[term] ?? [])].some((candidate) => includesPhrase(text, candidate));
  }));
}

function hasMatchedResumeTerm(resumeProfile, term) {
  const normalizedTerm = normalizeText(term);
  return (resumeProfile.matchedConfiguredTerms ?? []).some((matchedTerm) => {
    return normalizeText(matchedTerm) === normalizedTerm;
  });
}

function supportEvidenceForTerm(term, resumeProfile) {
  if (hasMatchedResumeTerm(resumeProfile, term)) {
    return [term];
  }

  const normalizedTerm = normalizeText(term);
  const relatedGroup = RELATED_SKILL_GROUPS.find((group) => {
    return group.some((relatedTerm) => normalizeText(relatedTerm) === normalizedTerm);
  });

  if (!relatedGroup) return [];

  return uniqueSorted(relatedGroup.filter((relatedTerm) => {
    return normalizeText(relatedTerm) !== normalizedTerm && hasMatchedResumeTerm(resumeProfile, relatedTerm);
  }));
}

function isStrictExactTerm(term) {
  return STRICT_EXACT_TERMS.some((strictTerm) => normalizeText(strictTerm) === normalizeText(term));
}

function supportForTerm(term, resumeProfile) {
  if (hasMatchedResumeTerm(resumeProfile, term)) {
    return {
      term,
      evidence: [term],
      strength: EXACT_SUPPORT,
      type: "exact"
    };
  }

  if (isStrictExactTerm(term)) {
    return {
      term,
      evidence: [],
      strength: 0,
      type: "missing"
    };
  }

  const evidence = supportEvidenceForTerm(term, resumeProfile);
  const strength = evidence.length >= 3 ? STRONG_RELATED_SUPPORT : RELATED_SUPPORT;

  return {
    term,
    evidence,
    strength: evidence.length ? strength : 0,
    type: evidence.length ? "related" : "missing"
  };
}

function weightedCoverage(supports, denominator) {
  if (!denominator) return 0;
  const total = supports.reduce((sum, support) => sum + support.strength, 0);
  return Math.min(1, total / denominator);
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

function extractResponsibilityText(rawText) {
  const segments = splitRequirementSegments(rawText);
  const directSegments = segments.filter((segment) => hasAnyPhrase(segment, RESPONSIBILITY_CUES));
  const firstHeaderIndex = segments.findIndex((segment) => {
    return hasAnyPhrase(segment, ["responsibilities", "what you will do", "what you'll do", "day to day", "in this role"]);
  });
  const followingSegments = firstHeaderIndex >= 0
    ? segments.slice(firstHeaderIndex, firstHeaderIndex + 12)
    : [];

  return uniqueSorted([...directSegments, ...followingSegments]).join(" ");
}

function extractRequiredRequirementText(rawText) {
  const segments = splitRequirementSegments(rawText);
  const directSegments = segments.filter((segment) => {
    return hasAnyPhrase(segment, REQUIREMENT_CUES)
      && !hasAnyPhrase(segment, OPTIONAL_REQUIREMENT_CUES);
  });
  const firstHeaderIndex = segments.findIndex((segment) => {
    return hasAnyPhrase(segment, ["requirements", "qualifications", "what you bring"]);
  });
  const followingSegments = firstHeaderIndex >= 0
    ? segments.slice(firstHeaderIndex, firstHeaderIndex + 10).filter((segment) => {
      return !hasAnyPhrase(segment, OPTIONAL_REQUIREMENT_CUES);
    })
    : [];

  return uniqueSorted([...directSegments, ...followingSegments]).join(" ");
}

function extractOptionalRequirementText(rawText) {
  return splitRequirementSegments(rawText)
    .filter((segment) => hasAnyPhrase(segment, OPTIONAL_REQUIREMENT_CUES))
    .join(" ");
}

function extractHardRequirementText(rawText) {
  return splitRequirementSegments(rawText)
    .filter((segment) => {
      return hasAnyPhrase(segment, HARD_REQUIREMENT_CUES)
        && !hasAnyPhrase(segment, OPTIONAL_REQUIREMENT_CUES);
    })
    .join(" ");
}

function inferRequiredYears(text) {
  const normalized = normalizeText(text);
  const years = [];
  const patterns = [
    /(\d{1,2})\+?\s*(?:years|year)\s+(?:of\s+)?(?:experience|relevant experience)/giu,
    /(\d{1,2})\+?\s*(?:years|year)\s+(?:of\s+)?(?:hands-on\s+|proven\s+|relevant\s+|direct\s+)?(?:in\s+|with\s+)?(?:project|product|program|operations|delivery|data|business|systems|implementation|software|engineering|management|analysis|devops|cloud|ai|ml|python)/giu,
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

function inferJobSeniority(title, body) {
  const text = `${title ?? ""} ${body ?? ""}`;
  if (hasAnyPhrase(text, SENIORITY_TERMS)) return "senior";
  if (hasAnyPhrase(text, ENTRY_LEVEL_TERMS)) return "entry";
  if (hasAnyPhrase(text, MID_LEVEL_TERMS)) return "mid";
  return "unspecified";
}

function capScore(score, cap, warnings, message) {
  if (score > cap) {
    warnings.push(message);
    return cap;
  }
  return score;
}

function humanList(values, fallback = "no clear signals") {
  const items = uniqueSorted(values ?? []).slice(0, 5);
  if (!items.length) return fallback;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function priorityFromPercent(matchPercent) {
  if (matchPercent >= 90) return "Very strong fit";
  if (matchPercent >= 80) return "Strong fit";
  if (matchPercent >= 70) return "Good fit";
  if (matchPercent >= 60) return "Stretch or backup";
  if (matchPercent < 50) return "Low fit";
  return "Low-medium fit";
}

// Candidate-aware role substance. Positive and negative signals come from the
// candidate's own detected role families (resumeProfile.directionSignals), so a
// software, finance, or sales CV is scored on its own direction rather than a
// fixed PMO/ops bias. Falls back to generic lists when the profile is unknown.
function scoreRoleSubstance(body, resumeProfile) {
  const positiveTerms = resumeProfile?.directionSignals?.positive?.length
    ? resumeProfile.directionSignals.positive
    : ROLE_SUBSTANCE_SIGNALS;
  const negativeTerms = resumeProfile?.directionSignals?.negative?.length
    ? resumeProfile.directionSignals.negative
    : NEGATIVE_ROLE_SUBSTANCE;

  const positiveMatches = collectMatches(body, positiveTerms);
  const negativeMatches = collectMatches(body, negativeTerms);
  const positiveScore = Math.min(30, positiveMatches.length * 4);
  const penalty = Math.min(24, negativeMatches.length * 8);

  return {
    score: Math.max(0, positiveScore - penalty),
    positiveMatches,
    negativeMatches,
    weightedMatches: positiveMatches.slice(0, 8)
  };
}

function classifyJobCategory(title, body, requirementFit, roleSubstanceFit) {
  if (roleSubstanceFit.negativeMatches.length >= 2) return "Not recommended";

  const text = `${title ?? ""} ${body ?? ""}`;
  const scoredCategories = JOB_CATEGORIES.map((category) => {
    const highMatches = collectMatches(text, category.highTerms);
    const mediumMatches = collectMatches(text, category.mediumTerms);
    return {
      name: category.name,
      score: (highMatches.length * 3) + mediumMatches.length,
      matches: [...highMatches, ...mediumMatches]
    };
  }).sort((a, b) => b.score - a.score);

  const best = scoredCategories[0];
  if (best?.score > 0) return best.name;
  if (requirementFit.resumeRequirementMatches.length >= 3) return "Backup";
  return "Not recommended";
}

function inferJobArchetype(title, body, roleSubstanceFit) {
  const text = `${title ?? ""} ${body ?? ""}`;
  const engineeringSignals = collectMatches(text, ENGINEERING_DEPTH_SIGNALS);
  const productOpsSignals = collectMatches(text, [
    "Product Operations",
    "Requirements Gathering",
    "User Stories",
    "Roadmap",
    "Stakeholder Management",
    "Dashboard",
    "KPI Dashboard"
  ]);
  const deliverySignals = collectMatches(text, [
    "Delivery Management",
    "Project Management",
    "Project Coordination",
    "Project tracking",
    "Project Control",
    "PMO",
    "Operations"
  ]);
  const aiOperationsSignals = collectMatches(text, [
    "AI Solution Manager",
    "AI Operations Manager",
    "AI Workflows",
    "AI Agent",
    "Workflow Automation",
    "Low-code",
    "No-code"
  ]);

  if (engineeringSignals.length >= 2 && roleSubstanceFit.positiveMatches.length < 5) {
    return {
      type: "engineering-heavy",
      signals: engineeringSignals
    };
  }

  if (aiOperationsSignals.length >= 2) {
    return {
      type: "ai-operations",
      signals: aiOperationsSignals
    };
  }

  if (productOpsSignals.length >= 2) {
    return {
      type: "product-operations",
      signals: productOpsSignals
    };
  }

  if (deliverySignals.length >= 2) {
    return {
      type: "delivery-operations",
      signals: deliverySignals
    };
  }

  return {
    type: "general",
    signals: [...roleSubstanceFit.positiveMatches]
  };
}

function assessMissingJobData({ job, rawJobText, requirementFit, experienceFit, jobSeniority }) {
  const warnings = [];
  const descriptionLength = normalizeText(job.description).length;

  if (descriptionLength < 220) {
    warnings.push("Job description is too short to identify must-have requirements.");
  }

  if (!requirementFit.requiredRequirementTerms.length) {
    warnings.push("Must-have requirements were not clearly detected.");
  }

  if (experienceFit.requiredYears == null) {
    warnings.push("Required years of experience were not found.");
  }

  if (jobSeniority === "unspecified") {
    warnings.push("Seniority level is unclear.");
  }

  if (!job.company || !job.location) {
    warnings.push("Company or location context is missing.");
  }

  if (normalizeText(rawJobText).length < 320) {
    warnings.push("Overall job data is limited, so the score should be treated cautiously.");
  }

  return uniqueSorted(warnings);
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

function scoreRoleFit(title, body, config, resumeProfile, reasons, warnings) {
  const recommendedTerms = resumeProfile.dynamicSearchTerms ?? [];
  const recommendedTitleMatches = collectMatches(title, recommendedTerms);
  const recommendedBodyMatches = collectMatches(body, recommendedTerms).filter((role) => {
    return !recommendedTitleMatches.includes(role);
  });
  const titleRoleMatches = collectMatches(title, config.targetRoles);
  const bodyRoleMatches = collectMatches(body, config.targetRoles).filter((role) => {
    return !titleRoleMatches.includes(role);
  });

  if (recommendedTitleMatches.length > 0) {
    const score = Math.min(32, 22 + (recommendedTitleMatches.length * 5));
    reasons.push(`Recommended role fit from title: ${recommendedTitleMatches.join(", ")}`);
    return { score, recommendedTitleMatches, recommendedBodyMatches, titleRoleMatches, bodyRoleMatches };
  }

  if (titleRoleMatches.length > 0) {
    const score = Math.min(22, 12 + (titleRoleMatches.length * 4));
    warnings.push("Role matches the broad target list, but not the strongest resume-based recommendations");
    reasons.push(`Broad role fit from title: ${titleRoleMatches.join(", ")}`);
    return { score, recommendedTitleMatches, recommendedBodyMatches, titleRoleMatches, bodyRoleMatches };
  }

  if (recommendedBodyMatches.length > 0) {
    reasons.push(`Recommended role signal in description: ${recommendedBodyMatches.slice(0, 4).join(", ")}`);
    return { score: Math.min(12, recommendedBodyMatches.length * 4), recommendedTitleMatches, recommendedBodyMatches, titleRoleMatches, bodyRoleMatches };
  }

  if (bodyRoleMatches.length > 0) {
    reasons.push(`Broad role signal in description: ${bodyRoleMatches.slice(0, 4).join(", ")}`);
    return { score: Math.min(6, bodyRoleMatches.length * 2), recommendedTitleMatches, recommendedBodyMatches, titleRoleMatches, bodyRoleMatches };
  }

  return { score: 0, recommendedTitleMatches, recommendedBodyMatches, titleRoleMatches, bodyRoleMatches };
}

function scoreRequirementFit({ body, requirementText, requiredRequirementText, optionalRequirementText, hardRequirementText, resumeProfile, config, reasons, warnings }) {
  const comparisonText = requirementText || body;
  const requirementTerms = collectConfiguredMatches(comparisonText, config.coreSkills, config.skillAliases);
  const optionalRequirementTerms = collectConfiguredMatches(optionalRequirementText, config.coreSkills, config.skillAliases);
  const requiredRequirementTerms = collectConfiguredMatches(requiredRequirementText || comparisonText, config.coreSkills, config.skillAliases);
  const optionalOnlyTerms = optionalRequirementTerms.filter((term) => !requiredRequirementTerms.includes(term));
  const resumeRequirementMatches = requirementTerms.filter((skill) => {
    return hasMatchedResumeTerm(resumeProfile, skill);
  });
  const termSupport = new Map(requirementTerms.map((skill) => {
    return [skill, supportForTerm(skill, resumeProfile)];
  }));
  const supportedRequirementTerms = requirementTerms.filter((skill) => {
    return termSupport.get(skill)?.strength >= MIN_SUPPORTED_STRENGTH;
  });
  const requiredSupportedTerms = requiredRequirementTerms.filter((skill) => {
    return termSupport.get(skill)?.strength >= MIN_SUPPORTED_STRENGTH;
  });
  const exactRequirementTerms = requiredRequirementTerms.filter((skill) => {
    return termSupport.get(skill)?.type === "exact";
  });
  const partialRequirementTerms = requiredRequirementTerms.filter((skill) => {
    const support = termSupport.get(skill);
    return support?.strength >= MIN_SUPPORTED_STRENGTH && support.strength < EXACT_SUPPORT;
  });
  const optionalMatches = optionalOnlyTerms.filter((skill) => {
    return hasMatchedResumeTerm(resumeProfile, skill);
  });
  const missingRequirementTerms = requiredRequirementTerms.filter((skill) => {
    return (termSupport.get(skill)?.strength ?? 0) < MIN_SUPPORTED_STRENGTH;
  });
  const missingOptionalTerms = optionalOnlyTerms.filter((skill) => {
    return !hasMatchedResumeTerm(resumeProfile, skill);
  });
  const hardRequirementTerms = collectConfiguredMatches(hardRequirementText, config.coreSkills, config.skillAliases);
  const hardSupportedTerms = hardRequirementTerms.filter((skill) => {
    return termSupport.get(skill)?.strength >= STRONG_SUPPORTED_STRENGTH;
  });
  const criticalRequirementTerms = requiredRequirementTerms.filter((skill) => {
    const normalizedSkill = normalizeText(skill);
    return splitRequirementSegments(requiredRequirementText || requirementText || body).some((segment) => {
      return includesPhrase(segment, normalizedSkill) && hasAnyPhrase(segment, CRITICAL_REQUIREMENT_CUES);
    });
  });
  const criticalMissingTerms = criticalRequirementTerms.filter((skill) => {
    return (termSupport.get(skill)?.strength ?? 0) < STRONG_SUPPORTED_STRENGTH;
  });
  const requiredSupports = requiredRequirementTerms.map((skill) => termSupport.get(skill) ?? supportForTerm(skill, resumeProfile));
  const hardSupports = hardRequirementTerms.map((skill) => termSupport.get(skill) ?? supportForTerm(skill, resumeProfile));
  const resumeSupportEvidence = uniqueSorted([...termSupport.values()].flatMap((support) => support.evidence));
  const coverage = requiredRequirementTerms.length
    ? weightedCoverage(requiredSupports, requiredRequirementTerms.length)
    : 0;
  const exactCoverage = requiredRequirementTerms.length
    ? exactRequirementTerms.length / requiredRequirementTerms.length
    : 0;
  const optionalCoverage = optionalOnlyTerms.length
    ? optionalMatches.length / optionalOnlyTerms.length
    : 1;
  const hardCoverage = hardRequirementTerms.length
    ? weightedCoverage(hardSupports, hardRequirementTerms.length)
    : 1;
  const score = requirementTerms.length
    ? Math.min(42, Math.round((coverage * 26) + (exactCoverage * 7) + (optionalCoverage * 3) + (hardCoverage * 4) + Math.min(3, resumeRequirementMatches.length)))
    : Math.min(18, resumeRequirementMatches.length * 4);

  if (requirementTerms.length > 0) {
    reasons.push(`Requirement coverage: ${requiredSupportedTerms.length}/${requiredRequirementTerms.length || requirementTerms.length} required supported`);
  }

  if (resumeRequirementMatches.length > 0) {
    reasons.push(`Exact resume signals: ${resumeRequirementMatches.slice(0, 8).join(", ")}`);
  }

  if (supportedRequirementTerms.length > resumeRequirementMatches.length) {
    reasons.push(`Related capability support: ${resumeSupportEvidence.slice(0, 8).join(", ")}`);
  }

  if (partialRequirementTerms.length > 0) {
    warnings.push(`Partial requirement evidence: ${partialRequirementTerms.slice(0, 5).join(", ")}`);
  }

  if (missingRequirementTerms.length > 0 && requirementTerms.length >= 4) {
    warnings.push(`Missing requirement signals: ${missingRequirementTerms.slice(0, 5).join(", ")}`);
  }

  if (criticalMissingTerms.length > 0) {
    warnings.push(`Critical missing requirements: ${criticalMissingTerms.slice(0, 4).join(", ")}`);
  }

  if (missingOptionalTerms.length > 0) {
    warnings.push(`Optional gaps: ${missingOptionalTerms.slice(0, 4).join(", ")}`);
  }

  return {
    score,
    requirementTerms,
    requiredRequirementTerms,
    optionalRequirementTerms: optionalOnlyTerms,
    resumeRequirementMatches,
    supportedRequirementTerms,
    requiredSupportedTerms,
    exactRequirementTerms,
    partialRequirementTerms,
    resumeSupportEvidence,
    missingRequirementTerms,
    missingOptionalTerms,
    coverage,
    exactCoverage,
    optionalCoverage,
    hardCoverage,
    criticalRequirementTerms,
    criticalMissingTerms
  };
}

function scoreExperienceFit(jobText, resumeProfile, reasons, warnings) {
  const requiredYears = inferRequiredYears(jobText);
  const resumeYears = resumeProfile.yearsExperience;
  if (requiredYears == null) {
    return {
      score: 6,
      requiredYears,
      resumeYears,
      gap: null,
      label: resumeYears == null ? "Experience requirement not detected" : `${resumeYears} resume years, no explicit requirement`
    };
  }

  if (resumeYears == null) {
    warnings.push(`Required experience not confirmed: ${requiredYears}+ years`);
    return {
      score: requiredYears >= 3 ? 1 : 3,
      requiredYears,
      resumeYears,
      gap: null,
      label: `Required ${requiredYears}+ years, resume years not confirmed`
    };
  }

  const gap = requiredYears - resumeYears;
  if (gap <= 0) {
    reasons.push(`Experience fit: ${resumeYears}/${requiredYears}+ years`);
    return {
      score: gap <= -4 ? 7 : 10,
      requiredYears,
      resumeYears,
      gap,
      label: `${resumeYears} resume years covers ${requiredYears}+ required years`
    };
  }

  warnings.push(`Experience gap: ${resumeYears}/${requiredYears}+ years`);
  return {
    score: gap === 1 ? 4 : 1,
    requiredYears,
    resumeYears,
    gap,
    label: `${resumeYears} resume years vs ${requiredYears}+ required years`
  };
}

// ---------------------------------------------------------------------------
// Weighted matching model (v2)
//
// The final fit score is a weighted sum of six explainable components that
// total 100. Each component returns a normalized 0..1 strength plus the
// evidence used to build a Hebrew explanation. After the weighted sum, a set
// of hard rules cap the score to keep the fit realistic rather than optimistic.
// ---------------------------------------------------------------------------
const MODEL_WEIGHTS = {
  recentRoleAlignment: 30, // how well the job matches the candidate's most recent role
  jobEssenceAlignment: 25, // whether the day-to-day work matches the candidate direction
  mustHaveMatch: 20, // coverage of the real must-have requirements
  educationMatch: 10, // education field / specialization relevance
  toolsMatch: 10, // tools, systems and technologies overlap
  experienceSeniority: 5 // years of experience and seniority fit
};

// English category labels per direction, used when the legacy category
// taxonomy has no entry but the job matches the candidate's direction.
const DIRECTION_LABEL = {
  "ai-ops": "AI / Product Ops",
  "pmo": "PMO",
  "operations": "Operations",
  "product-ops": "Product Ops",
  "implementation": "Implementation",
  "data-bi": "Data / BI",
  "engineering": "Software Development",
  "research": "Research",
  "finance": "Finance",
  "general": "General"
};

// Hebrew labels for the inferred job direction, used in the explanation output.
const DIRECTION_HE = {
  "ai-ops": "AI ותפעול מוצר",
  "pmo": "ניהול וריכוז פרויקטים / PMO",
  "operations": "תפעול ושיפור תהליכים",
  "product-ops": "תפעול מוצר",
  "implementation": "הטמעה ומערכות מידע",
  "data-bi": "דאטה ו-BI",
  "engineering": "פיתוח תוכנה",
  "research": "מחקר ואלגוריתמיקה",
  "finance": "כספים וחשבונאות",
  "general": "כללי"
};

// Maps recommended role families to a normalized job direction, so the model
// can tell whether a job's direction matches the candidate's real directions.
const ROLE_FAMILY_DIRECTION = {
  "ai-solutions": "ai-ops",
  "project-coordination": "pmo",
  "data-business-analysis": "data-bi",
  "implementation-erp": "implementation",
  "digital-projects": "product-ops",
  "operations": "operations",
  "product-operations": "product-ops",
  "software-development": "engineering",
  "finance-accounting": "finance"
};

// Title keywords grouped by the direction they signal. Used for a robust,
// word-order-independent title alignment that does not depend on exact phrases.
const TITLE_DIRECTION_KEYWORDS = {
  "ai-ops": ["ai", "automation", "workflow"],
  "pmo": ["pmo", "project manager", "project coordinator", "project"],
  "operations": ["operations", "process"],
  "product-ops": ["product"],
  "implementation": ["implementation", "systems", "erp", "crm", "netsuite"],
  "data-bi": ["data", "bi", "analyst", "analytics"],
  "finance": ["finance", "accounting", "bookkeeper"]
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// Builds the set of directions the candidate genuinely fits, from the education
// field directions plus the strongest resume-based role recommendations.
function buildCandidateDirections(resumeProfile) {
  const directions = new Set(resumeProfile.education?.directions ?? []);
  for (const role of (resumeProfile.roleRecommendations ?? []).slice(0, 4)) {
    const direction = ROLE_FAMILY_DIRECTION[role.id];
    if (direction) directions.add(direction);
  }
  return directions;
}

// Joins values into a natural Hebrew list (a, b ו-c).
function heList(values, fallback = "ללא") {
  const items = uniqueSorted(values ?? []).slice(0, 5);
  if (!items.length) return fallback;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ו${items.at(-1)}`;
}

// Decides whether the candidate genuinely supports deep software engineering.
// Used to avoid over-rating engineering-heavy jobs for a PMO/data/AI profile.
function candidateSupportsEngineering(resumeProfile) {
  const devTerms = [
    "Software Developer", "Software Engineering", "Full Stack", "Frontend", "Backend",
    "JavaScript", "TypeScript", "React", "Node.js", "Java", "C#", "Web Development"
  ];
  const hits = devTerms.filter((term) => hasMatchedResumeTerm(resumeProfile, term));
  return hits.length >= 3 || (hits.length >= 2 && (resumeProfile.education?.supportsEngineering ?? false));
}

// Classifies the real direction of the job, not just its keywords. Deep
// development and research are detected first so they are never mislabeled as
// product/PMO work because of shared buzzwords like "AI" or "data".
function classifyJobDirection({ title, body, archetype, substance, requirementFit }) {
  const text = `${title} ${body}`;
  if (archetype.type === "engineering-heavy") return "engineering";
  if (hasAnyPhrase(text, [
    "data scientist", "machine learning researcher", "ml researcher", "algorithm engineer",
    "research scientist", "deep learning researcher", "algorithm developer", "חוקר", "אלגוריתם"
  ])) {
    return "research";
  }
  if (hasAnyPhrase(text, ["accounting", "bookkeeper", "payroll", "accounts payable", "חשבונאות", "הנהלת חשבונות"])) {
    return "finance";
  }

  const category = classifyJobCategory(title, body, requirementFit, substance);
  const mapped = {
    "AI / Product Ops": "ai-ops",
    "Technical PMO": "pmo",
    "Delivery & Operations": "operations",
    "Junior Product": "product-ops",
    "Solutions / Implementation": "implementation",
    "Information Systems": "implementation",
    "Data / BI": "data-bi"
  }[category];
  if (mapped) return mapped;

  // Fall back to the generic role-family taxonomy so directions outside the
  // legacy PMO/ops categories (engineering, finance, sales, HR, ...) are detected.
  const family = inferJobFamily(text);
  if (family && ROLE_FAMILY_DIRECTION[family]) return ROLE_FAMILY_DIRECTION[family];
  return "general";
}

// Component 1 (30): alignment with the candidate's most recent role and the
// strongest resume-based role directions. Combines exact title matches, a
// direction match, and word-order-independent title keywords.
function scoreRecentRoleAlignment({ title, body, resumeProfile, roleFit, jobDirection, candidateDirections }) {
  let score = 0;
  const evidence = [];
  const lastTitle = normalizeText(resumeProfile.lastRole?.title || resumeProfile.latestRole || "");

  if (lastTitle && includesPhrase(title, lastTitle)) {
    score += 0.4;
    evidence.push("התפקיד האחרון מופיע בכותרת המשרה");
  } else if (lastTitle && includesPhrase(body, lastTitle)) {
    score += 0.2;
    evidence.push("התפקיד האחרון מוזכר בתיאור המשרה");
  }

  if (roleFit.recommendedTitleMatches.length) {
    score += Math.min(0.4, roleFit.recommendedTitleMatches.length * 0.2);
    evidence.push(`כיוון מומלץ בכותרת: ${roleFit.recommendedTitleMatches.slice(0, 3).join(", ")}`);
  } else if (roleFit.titleRoleMatches.length) {
    score += Math.min(0.3, roleFit.titleRoleMatches.length * 0.15);
  }

  // Direction match: the job's direction is one the candidate genuinely fits.
  if (candidateDirections.has(jobDirection)) {
    score += 0.35;
    evidence.push(`כיוון המשרה (${DIRECTION_HE[jobDirection] ?? jobDirection}) תואם את הפרופיל`);
  }

  // Title keywords for the candidate's directions, regardless of word order.
  const titleKeywords = [...candidateDirections]
    .flatMap((direction) => TITLE_DIRECTION_KEYWORDS[direction] ?? [])
    .filter((keyword) => includesPhrase(title, keyword));
  if (titleKeywords.length) {
    score += Math.min(0.4, uniqueSorted(titleKeywords).length * 0.2);
  }

  return { score: clamp01(score), evidence };
}

// Component 2 (25): does the day-to-day essence of the job match the candidate
// direction? Built from resume-backed skill signals in the responsibilities and
// body (using aliases, so plurals and phrasing variants still match), with a
// direction floor and a penalty for engineering-heavy day-to-day work.
function scoreJobEssenceAlignment({ responsibilityText, body, resumeProfile, config, jobDirection, candidateDirections }) {
  const essenceText = `${responsibilityText} ${body}`;
  const substance = scoreRoleSubstance(essenceText, resumeProfile);
  const essenceSignals = collectConfiguredMatches(essenceText, config.coreSkills, config.skillAliases);
  const supported = essenceSignals.filter((term) => hasMatchedResumeTerm(resumeProfile, term));

  let score = essenceSignals.length ? supported.length / essenceSignals.length : 0.4;
  if (candidateDirections.has(jobDirection)) score = Math.max(score, 0.6);
  // Penalize only directions that conflict with this candidate's profile.
  if (substance.negativeMatches.length) score -= Math.min(0.6, substance.negativeMatches.length * 0.3);

  return { score: clamp01(score), substance, supported };
}

// Component 3 (20): coverage of the real must-have requirements, weighted
// toward exact matches and penalized for missing critical requirements.
function scoreMustHaveMatch(requirementFit) {
  if (!requirementFit.requiredRequirementTerms.length) {
    return { score: 0.55, note: "לא זוהו דרישות חובה ברורות" };
  }
  let score = (requirementFit.coverage * 0.7) + (requirementFit.exactCoverage * 0.3);
  if (requirementFit.criticalMissingTerms.length) {
    // A missing critical requirement matters, but should not erase solid
    // overall coverage; the hard-rule score cap handles the harder limit.
    score -= Math.min(0.3, requirementFit.criticalMissingTerms.length * 0.15);
  }
  return { score: clamp01(score), note: null };
}

// Component 4 (10): education field and specialization relevance. An Industrial
// Engineering & Management / Data Science background helps data, systems, PMO
// and AI-implementation roles, but does not make pure development/research fit.
function scoreEducationMatch({ resumeProfile, jobDirection, body }) {
  const education = resumeProfile.education;
  if (!education || (!education.field && !education.specialization)) {
    return { score: 0.4, evidence: [] };
  }

  if (jobDirection === "engineering" || jobDirection === "research") {
    return education.supportsEngineering
      ? { score: 0.7, evidence: [`ההשכלה (${education.field}) תומכת בכיוון פיתוח/מחקר`] }
      : { score: 0.15, evidence: [`ההשכלה (${education.field}) אינה תומכת בפיתוח/מחקר עמוק`] };
  }

  const evidence = [];
  let score = 0.4;
  if ((education.directions ?? []).includes(jobDirection)) {
    score = 0.9;
    const spec = education.specialization ? ` + ${education.specialization}` : "";
    evidence.push(`ההשכלה (${education.field}${spec}) מתאימה לכיוון ${DIRECTION_HE[jobDirection] ?? jobDirection}`);
  }
  if ((education.fields ?? []).some((field) => includesPhrase(body, field))) {
    score = Math.max(score, 0.8);
    evidence.push("תחום הלימודים מוזכר במשרה");
  }
  return { score: clamp01(score), evidence };
}

// Component 5 (10): how many of the tools/systems the job asks for the
// candidate actually has.
function scoreToolsMatch({ requirementText, body, resumeProfile, config }) {
  const jobTools = collectConfiguredMatches(requirementText || body, config.toolKeywords, config.skillAliases);
  if (!jobTools.length) {
    return { score: 0.5, jobTools: [], matched: [] };
  }
  const matched = jobTools.filter((tool) => hasMatchedResumeTerm(resumeProfile, tool));
  return { score: clamp01(matched.length / jobTools.length), jobTools, matched };
}

// Component 6 (5): years of experience and seniority fit.
function scoreExperienceSeniority({ experienceFit, jobSeniority, resumeProfile }) {
  let score = 0.6;
  if (experienceFit.requiredYears != null && experienceFit.resumeYears != null) {
    const gap = experienceFit.gap;
    if (gap <= 0) score = 1;
    else if (gap === 1) score = 0.7;
    else if (gap === 2) score = 0.45;
    else score = 0.2;
  } else if (experienceFit.requiredYears != null && experienceFit.resumeYears == null) {
    score = experienceFit.requiredYears >= 5 ? 0.3 : 0.5;
  }
  if (jobSeniority === "senior" && (resumeProfile.yearsExperience == null || resumeProfile.yearsExperience < 5)) {
    score = Math.min(score, 0.3);
  }
  return clamp01(score);
}

// Builds the explainable output: a Hebrew explanation plus the English keys the
// UI and CSV export already consume.
function buildFitExplanation({
  job, matchPercent, components, jobDirection, requirementFit, experienceFit,
  resumeProfile, warnings, missingDataWarnings
}) {
  const { recent, essence, mustHave, education, tools } = components;
  const directionHe = DIRECTION_HE[jobDirection] ?? jobDirection;

  const fitLabel = matchPercent >= 75 ? "High" : matchPercent >= 60 ? "Medium" : "Low";
  const finalRecommendation = (matchPercent >= 75 && !requirementFit.criticalMissingTerms.length)
    ? "Apply"
    : matchPercent >= 60 ? "Maybe apply" : "Not recommended";
  const recommendationHe = finalRecommendation === "Apply"
    ? "מומלץ להגיש"
    : finalRecommendation === "Maybe apply" ? "אפשר להגיש עם התאמות" : "בדרך כלל לא מומלץ";

  const whySignals = uniqueSorted([
    ...essence.supported,
    ...requirementFit.resumeRequirementMatches,
    ...tools.matched
  ]);

  const missing = [];
  if (requirementFit.criticalMissingTerms.length) {
    missing.push(`דרישות חובה קריטיות חסרות: ${heList(requirementFit.criticalMissingTerms)}`);
  } else if (requirementFit.missingRequirementTerms.length) {
    missing.push(`דרישות חסרות: ${heList(requirementFit.missingRequirementTerms)}`);
  }
  const missingTools = tools.jobTools.filter((tool) => !tools.matched.includes(tool));
  if (missingTools.length) missing.push(`כלים חסרים: ${heList(missingTools)}`);
  if (experienceFit.requiredYears != null && resumeProfile.yearsExperience != null
    && resumeProfile.yearsExperience < experienceFit.requiredYears) {
    missing.push(`פער ניסיון: ${resumeProfile.yearsExperience}/${experienceFit.requiredYears}+ שנים`);
  }

  const sharedTools = (resumeProfile.lastRole?.tools ?? []).filter((tool) => includesPhrase(normalizeText(job.description ?? ""), tool));
  let recentRoleSupport = recent.evidence.length ? recent.evidence.join("; ") : "אין חפיפה ישירה לתפקיד האחרון";
  if (sharedTools.length) recentRoleSupport += `. כלים מהתפקיד האחרון שמופיעים במשרה: ${heList(sharedTools)}`;

  const educationSupport = education.evidence.length
    ? education.evidence.join("; ")
    : `השכלה: ${resumeProfile.education?.field ?? "לא זוהתה"}`;

  const risks = uniqueSorted([
    ...warnings,
    ...(essence.substance.negativeMatches.length ? [`המשרה כוללת אופי של ${heList(essence.substance.negativeMatches)}`] : [])
  ]).slice(0, 5);

  const cvTailoring = whySignals.length
    ? `מקד את קורות החיים סביב ${heList(whySignals)}, והדגש את ההתאמה לכיוון ${directionHe}.`
    : `הדגש ניסיון רלוונטי בפרויקטים, תפעול, דאטה ו-AI שמתאים לכיוון ${directionHe}.`;

  const confidence = missingDataWarnings.length >= 3
    ? "low"
    : (recent.score >= 0.5 && mustHave.score >= 0.6) ? "high" : "medium";

  return {
    // English keys kept for the existing UI table and CSV export
    fitScore: matchPercent,
    recommendation: finalRecommendation,
    confidence,
    requirementCoverage: requirementFit.requiredRequirementTerms.length
      ? `${requirementFit.requiredSupportedTerms.length}/${requirementFit.requiredRequirementTerms.length} required, ${Math.round(requirementFit.exactCoverage * 100)}% exact`
      : "Not detected",
    experienceFit: experienceFit.label,
    roleNeed: `Direction: ${jobDirection}. Needs ${humanList([...requirementFit.requiredRequirementTerms, ...essence.substance.positiveMatches])}.`,
    strongFit: `Strong signals: ${humanList(whySignals, "no resume-backed signals detected")}.`,
    gaps: missing.length ? missing.join(" | ") : "No major gap detected.",
    missingDataWarnings,
    // Hebrew explanation (primary, simple language)
    fitLabel,
    hebrewSummary: `התאמה ${matchPercent}% (${fitLabel}). כיוון המשרה: ${directionHe}.`,
    whyFits: whySignals.length ? `מתאים בזכות ${heList(whySignals)}.` : "אין סימני התאמה חזקים שמגובים בקו\"ח.",
    whatsMissing: missing.length ? missing.join(" | ") : "לא זוהה פער מהותי.",
    recentRoleSupport,
    educationSupport,
    risks: risks.length ? risks.join(" | ") : "לא זוהו סיכונים מהותיים.",
    cvTailoring,
    finalRecommendation,
    finalRecommendationHe: recommendationHe
  };
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
  const responsibilityText = normalizeText(extractResponsibilityText(rawJobText));
  const requiredRequirementText = normalizeText(extractRequiredRequirementText(rawJobText));
  const optionalRequirementText = normalizeText(extractOptionalRequirementText(rawJobText));
  const hardRequirementText = normalizeText(extractHardRequirementText(rawJobText));

  const reasons = [];
  const warnings = [];

  // Reuse the existing extractors for role, requirement and experience signals.
  const roleFit = scoreRoleFit(title, body, config, resumeProfile, reasons, warnings);
  const requirementFit = scoreRequirementFit({
    body,
    requirementText,
    requiredRequirementText,
    optionalRequirementText,
    hardRequirementText,
    resumeProfile,
    config,
    reasons,
    warnings
  });
  const experienceFit = scoreExperienceFit(body, resumeProfile, reasons, warnings);
  const jobSeniority = inferJobSeniority(title, body);

  // Classify the real direction of the job (engineering/research detected first).
  const substancePreview = scoreRoleSubstance(responsibilityText || body, resumeProfile);
  const archetype = inferJobArchetype(title, body, substancePreview);
  const jobDirection = classifyJobDirection({ title, body, archetype, substance: substancePreview, requirementFit });
  const candidateEng = candidateSupportsEngineering(resumeProfile);
  const candidateDirections = buildCandidateDirections(resumeProfile);

  // --- Weighted model: six explainable components that total 100 ---
  const recent = scoreRecentRoleAlignment({ title, body, resumeProfile, roleFit, jobDirection, candidateDirections });
  const essence = scoreJobEssenceAlignment({ responsibilityText, body, resumeProfile, config, jobDirection, candidateDirections });
  const mustHave = scoreMustHaveMatch(requirementFit);
  const education = scoreEducationMatch({ resumeProfile, jobDirection, body });
  const tools = scoreToolsMatch({ requirementText, body, resumeProfile, config });
  const experience = scoreExperienceSeniority({ experienceFit, jobSeniority, resumeProfile });

  let score = Math.round(
    (recent.score * MODEL_WEIGHTS.recentRoleAlignment)
    + (essence.score * MODEL_WEIGHTS.jobEssenceAlignment)
    + (mustHave.score * MODEL_WEIGHTS.mustHaveMatch)
    + (education.score * MODEL_WEIGHTS.educationMatch)
    + (tools.score * MODEL_WEIGHTS.toolsMatch)
    + (experience * MODEL_WEIGHTS.experienceSeniority)
  );

  reasons.push(`Model: recent ${Math.round(recent.score * 30)}/30, essence ${Math.round(essence.score * 25)}/25, must-have ${Math.round(mustHave.score * 20)}/20, education ${Math.round(education.score * 10)}/10, tools ${Math.round(tools.score * 10)}/10, experience ${Math.round(experience * 5)}/5`);
  reasons.push(`Job direction: ${jobDirection}`);

  // --- Hard rules: keep the fit realistic rather than optimistic ---
  // Missing a critical must-have requirement caps the score.
  if (requirementFit.criticalMissingTerms.length) {
    score = capScore(score, 70, warnings, "חסרה דרישת חובה קריטית");
  }
  // Deep hands-on development/research vs a PMO/implementation/data/AI profile.
  if ((jobDirection === "engineering" || jobDirection === "research") && !candidateEng) {
    score = capScore(score, 60, warnings, "המשרה דורשת פיתוח/מחקר עמוק שאינו ליבת הפרופיל");
  }
  // Job requires clearly more years than the CV shows.
  if (experienceFit.requiredYears != null && resumeProfile.yearsExperience != null) {
    const gap = experienceFit.requiredYears - resumeProfile.yearsExperience;
    if (gap >= 4) score = capScore(score, 55, warnings, "פער שנות ניסיון גדול מהנדרש");
    else if (gap === 3) score = capScore(score, 63, warnings, "פער שנות ניסיון מהנדרש");
    else if (gap === 2) score = capScore(score, 70, warnings, "פער שנות ניסיון קל מהנדרש");
  } else if (experienceFit.requiredYears != null && resumeProfile.yearsExperience == null && experienceFit.requiredYears >= 5) {
    score = capScore(score, 65, warnings, "נדרש ניסיון רב שאינו מאומת בקורות החיים");
  }
  // Senior/management role vs a junior/mid candidate.
  if ((jobSeniority === "senior" || isSeniorityMismatch(title, resumeProfile))
    && (resumeProfile.yearsExperience == null || resumeProfile.yearsExperience < 5)) {
    score = capScore(score, 60, warnings, "דרגת בכירות גבוהה מהפרופיל שזוהה");
  }
  // Keyword-only similarity but a different day-to-day role.
  if (recent.score < 0.2 && essence.supported.length < 2) {
    score = capScore(score, 58, warnings, "דמיון במילות מפתח בלבד, התפקיד היומיומי שונה");
  }

  // Configured negative filters and out-of-market location.
  const avoidMatches = collectMatches(body, config.avoidKeywords);
  if (avoidMatches.length > 0) {
    score -= Math.min(30, avoidMatches.length * 15);
    warnings.push(`מסננים שליליים: ${avoidMatches.join(", ")}`);
  }
  if (!job.applyUrl) {
    score -= 3;
    warnings.push("אין קישור הגשה ישיר");
  }
  if (isOutOfMarket(job.location, job.workMode, config)) {
    score = capScore(score, 62, warnings, "המיקום נראה מחוץ לשוק המועדף");
  }

  // Missing job data lowers confidence in the score.
  const missingDataWarnings = assessMissingJobData({
    job,
    rawJobText,
    requirementFit,
    experienceFit,
    jobSeniority
  });
  if (missingDataWarnings.length >= 4) {
    score = capScore(score, 72, warnings, "נתוני משרה חסרים מגבילים את ודאות הציון");
  }

  const matchPercent = Math.max(0, Math.min(100, Math.round(score)));
  const components = { recent, essence, mustHave, education, tools, experience };
  const fitAnalysis = buildFitExplanation({
    job,
    matchPercent,
    components,
    jobDirection,
    requirementFit,
    experienceFit,
    resumeProfile,
    warnings,
    missingDataWarnings
  });

  let category = classifyJobCategory(title, body, requirementFit, essence.substance);
  if ((jobDirection === "engineering" || jobDirection === "research") && !candidateEng) {
    // Deep dev/research only counts against candidates whose CV does not support it.
    category = "Not recommended";
  } else if ((category === "Not recommended" || category === "Backup") && candidateDirections.has(jobDirection)) {
    // The legacy taxonomy has no label for this direction, but it fits the CV.
    category = DIRECTION_LABEL[jobDirection] ?? category;
  }

  return {
    company: job.company ?? "",
    position: job.title ?? "",
    category,
    matchPercent,
    priority: priorityFromPercent(matchPercent),
    status: "Found",
    appliedVia: job.source ?? "",
    source: job.source ?? "",
    sourceLabel: job.sourceLabel ?? "",
    applyUrl: job.applyUrl ?? "",
    location: job.location ?? "",
    workModel: job.workMode ?? "",
    postedAt: job.postedAt ?? "",
    dataQuality: job.quality ?? null,
    mainFit: fitAnalysis.whyFits,
    mainGap: fitAnalysis.whatsMissing,
    recommendedAction: fitAnalysis.finalRecommendationHe,
    notes: reasons.join(" | "),
    warnings: warnings.join(" | "),
    fitAnalysis,
    matchedKeywords: uniqueSorted([
      ...roleFit.titleRoleMatches,
      ...requirementFit.resumeRequirementMatches,
      ...tools.matched,
      ...essence.supported
    ]),
    matchBreakdown: {
      recentRoleAlignment: Math.round(recent.score * 30),
      jobEssenceAlignment: Math.round(essence.score * 25),
      mustHaveMatch: Math.round(mustHave.score * 20),
      educationMatch: Math.round(education.score * 10),
      toolsMatch: Math.round(tools.score * 10),
      experienceSeniority: Math.round(experience * 5),
      jobDirection,
      requirementCoverage: requirementFit.requirementTerms.length
        ? Math.round(requirementFit.coverage * 100)
        : null,
      exactRequirementCoverage: requirementFit.requiredRequirementTerms.length
        ? Math.round(requirementFit.exactCoverage * 100)
        : null,
      confidence: fitAnalysis.confidence,
      requiredYears: experienceFit.requiredYears,
      resumeYears: experienceFit.resumeYears,
      experienceGap: experienceFit.gap,
      jobSeniority,
      // legacy aliases kept for the CSV export columns
      mustHaveFit: Math.round(mustHave.score * 20),
      roleSubstanceFit: Math.round(essence.score * 25),
      careerDirectionFit: Math.round(recent.score * 30),
      marketCompetitiveness: Math.round(experience * 5),
      missingDataWarnings
    }
  };
}

export function rankJobs(jobs, resumeProfile, config) {
  const ranked = jobs
    .map((job) => scoreJob(job, resumeProfile, config))
    .sort((a, b) => b.matchPercent - a.matchPercent || String(a.company ?? "").localeCompare(String(b.company ?? "")));

  return dedupeRankedJobs(ranked)
    .sort((a, b) => b.matchPercent - a.matchPercent || String(a.company ?? "").localeCompare(String(b.company ?? "")));
}
