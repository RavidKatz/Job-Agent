import { includesPhrase, normalizeText, uniqueSorted } from "./text.mjs";

const ROLE_FAMILIES = [
  {
    id: "ai-project-management",
    title: "AI project management",
    searchTerms: [
      "AI Project Manager",
      "AI Program Manager",
      "AI Product Operations",
      "Automation Project Manager"
    ],
    signals: [
      "AI",
      "automation",
      "project management",
      "PMO",
      "stakeholder",
      "process improvement"
    ],
    reasons: [
      "Combines project delivery, process thinking, and automation",
      "Fits profiles that translate business needs into technical execution"
    ]
  },
  {
    id: "pmo",
    title: "PMO and process management",
    searchTerms: [
      "PMO",
      "Project Coordinator",
      "Project Manager",
      "Program Coordinator"
    ],
    signals: [
      "PMO",
      "project management",
      "coordination",
      "Excel",
      "Jira",
      "Monday",
      "stakeholder"
    ],
    reasons: [
      "Matches experience in tracking, coordination, reporting, and process control",
      "Works well for cross-functional stakeholder environments"
    ]
  },
  {
    id: "business-applications",
    title: "Business applications and implementation",
    searchTerms: [
      "Business Applications Manager",
      "Systems Implementer",
      "Application Manager",
      "CRM Implementation Manager"
    ],
    signals: [
      "systems implementation",
      "CRM",
      "API",
      "QA",
      "SQL",
      "business applications",
      "implementation"
    ],
    reasons: [
      "Fits profiles that understand both business processes and systems",
      "Relevant for implementation, requirements, and rollout roles"
    ]
  },
  {
    id: "digital-projects",
    title: "Digital project management",
    searchTerms: [
      "Digital Project Manager",
      "Digital Operations Manager",
      "CRM Project Manager",
      "Customer Experience Project Manager"
    ],
    signals: [
      "digital projects",
      "CRM",
      "API",
      "customer",
      "operations",
      "loyalty",
      "process"
    ],
    reasons: [
      "Connects service, product, systems, and operations work",
      "Fits cross-functional digital delivery environments"
    ]
  },
  {
    id: "operations",
    title: "Operations and process improvement",
    searchTerms: [
      "Operations Manager",
      "Operations Project Manager",
      "Process Improvement Manager",
      "Business Operations Manager"
    ],
    signals: [
      "operations",
      "process improvement",
      "industrial engineering",
      "data analysis",
      "Excel",
      "SQL",
      "workflow"
    ],
    reasons: [
      "Fits analytical profiles with process-oriented thinking",
      "Relevant for improvement, control, and operational execution"
    ]
  },
  {
    id: "product-operations",
    title: "Product operations",
    searchTerms: [
      "Product Operations",
      "Product Operations Manager",
      "Product Project Manager",
      "Product Analyst"
    ],
    signals: [
      "product",
      "operations",
      "data analysis",
      "API",
      "stakeholder",
      "process",
      "CRM"
    ],
    reasons: [
      "Connects users, data, and product workflows",
      "Fits technical environments without requiring a developer role"
    ]
  }
];

const EXPERIENCE_PATTERNS = [
  /(\d{1,2})\+?\s*(?:years|year|שנים|שנה)/giu,
  /(?:experience|ניסיון)\s*(?:of|של)?\s*(\d{1,2})/giu
];

export function inferYearsExperience(text) {
  const normalized = normalizeText(text);
  const years = [];

  for (const pattern of EXPERIENCE_PATTERNS) {
    for (const match of normalized.matchAll(pattern)) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0 && value < 50) {
        years.push(value);
      }
    }
  }

  if (!years.length) return null;
  return Math.max(...years);
}

export function inferSeniority(yearsExperience) {
  if (yearsExperience == null) return "Not explicitly detected";
  if (yearsExperience < 2) return "Early career";
  if (yearsExperience < 5) return "Mid-level";
  if (yearsExperience < 9) return "Experienced";
  return "Senior";
}

export function recommendRoles(resumeText, config) {
  const normalized = normalizeText(resumeText);

  return ROLE_FAMILIES
    .map((family) => {
      const matchedSignals = family.signals.filter((signal) => includesPhrase(normalized, signal));
      const configuredHits = (config.coreSkills ?? []).filter((skill) => {
        return family.signals.some((signal) => normalizeText(signal) === normalizeText(skill))
          && includesPhrase(normalized, skill);
      });
      const score = Math.min(100, Math.round((matchedSignals.length * 15) + (configuredHits.length * 5)));

      return {
        id: family.id,
        title: family.title,
        score,
        searchTerms: family.searchTerms,
        matchedSignals: uniqueSorted(matchedSignals),
        reasons: family.reasons
      };
    })
    .filter((role) => role.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function buildDynamicSearchTerms(recommendations, config) {
  const roleTerms = recommendations.flatMap((role) => role.searchTerms);
  const configuredRoles = config.targetRoles ?? [];
  return uniqueSorted([...roleTerms, ...configuredRoles]).slice(0, 14);
}
