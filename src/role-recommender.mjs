import { includesPhrase, normalizeText, uniqueSorted } from "./text.mjs";

const ROLE_FAMILIES = [
  {
    id: "project-coordination",
    title: "Project coordination and PMO",
    searchTerms: [
      "Project Coordinator",
      "PMO Coordinator",
      "Junior Project Manager",
      "Project Analyst"
    ],
    signals: [
      "project manager",
      "project coordination",
      "project management",
      "PMO",
      "scheduling",
      "reporting",
      "status updates",
      "stakeholder",
      "client communication",
      "Trello",
      "Jira"
    ],
    reasons: [
      "Matches hands-on project tracking, reporting, and stakeholder coordination",
      "Fits early to mid-level project delivery roles"
    ]
  },
  {
    id: "data-business-analysis",
    title: "Data and business analysis",
    searchTerms: [
      "Data Analyst",
      "Business Analyst",
      "Operations Analyst",
      "Project Analyst"
    ],
    signals: [
      "data analysis",
      "statistical analysis",
      "data science",
      "SQL",
      "SQL Server",
      "Python",
      "Machine Learning",
      "Data Visualization",
      "Tableau",
      "Qlik",
      "Excel",
      "reports"
    ],
    reasons: [
      "Matches analytical work, reporting, and large dataset handling",
      "Fits business-facing analysis roles that do not require senior ownership"
    ]
  },
  {
    id: "implementation-erp",
    title: "Implementation and ERP operations",
    searchTerms: [
      "Implementation Analyst",
      "Implementation Project Manager",
      "Systems Implementer",
      "ERP Implementer",
      "NetSuite Implementer"
    ],
    signals: [
      "systems implementation",
      "CRM",
      "ERP",
      "NetSuite",
      "Microsoft Access",
      "SQL",
      "business applications",
      "implementation",
      "QA"
    ],
    reasons: [
      "Fits technical-business profiles that can support system rollout",
      "Relevant for implementation support, requirements, and operations"
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
      "process",
      "Figma",
      "UX/UI"
    ],
    reasons: [
      "Connects service, product, systems, and operations work",
      "Fits cross-functional digital delivery environments"
    ]
  },
  {
    id: "operations",
    title: "Operations and process analysis",
    searchTerms: [
      "Operations Analyst",
      "Operations Coordinator",
      "Operations Project Coordinator",
      "Process Improvement Manager",
      "Business Operations Analyst"
    ],
    signals: [
      "operations",
      "process improvement",
      "industrial engineering",
      "industrial engineering and management",
      "data analysis",
      "Excel",
      "SQL",
      "workflow",
      "inventory",
      "logistics"
    ],
    reasons: [
      "Fits analytical profiles with process-oriented thinking",
      "Relevant for improvement, control, and operational analysis"
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
      "CRM",
      "Figma"
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

function extractSection(text, startLabel, endLabels) {
  const source = String(text ?? "");
  const lower = source.toLowerCase();
  const startIndex = lower.indexOf(startLabel.toLowerCase());
  if (startIndex < 0) return "";

  const afterStart = source.slice(startIndex + startLabel.length);
  const afterStartLower = afterStart.toLowerCase();
  const endIndexes = endLabels
    .map((label) => afterStartLower.indexOf(label.toLowerCase()))
    .filter((index) => index >= 0);
  const endIndex = endIndexes.length ? Math.min(...endIndexes) : afterStart.length;

  return afterStart.slice(0, endIndex);
}

function inferYearsFromEmploymentRanges(text) {
  const employmentText = extractSection(text, "Employment", [
    "Education",
    "Military Service",
    "Volunteer",
    "Skills",
    "Language"
  ]);
  const sourceText = employmentText || text;
  const ranges = [...String(sourceText ?? "").matchAll(/\b(20\d{2}|19\d{2})\s*[-–]\s*(20\d{2}|19\d{2}|present|current)\b/giu)];
  const durations = ranges
    .map((match) => {
      const start = Number(match[1]);
      const end = /present|current/iu.test(match[2]) ? new Date().getFullYear() : Number(match[2]);
      return end >= start ? end - start : 0;
    })
    .filter((duration) => duration > 0 && duration < 30);

  if (!durations.length) return null;
  return Math.max(...durations);
}

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

  const rangeYears = inferYearsFromEmploymentRanges(text);
  if (rangeYears != null) {
    years.push(rangeYears);
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
  const priorityTerms = recommendations.flatMap((role) => role.searchTerms.slice(0, 2));
  const remainingRoleTerms = recommendations.flatMap((role) => role.searchTerms.slice(2));
  const configuredRoles = config.targetRoles ?? [];
  const orderedTerms = [];

  for (const term of [...priorityTerms, ...remainingRoleTerms, ...configuredRoles]) {
    const normalized = normalizeText(term);
    if (!normalized || orderedTerms.some((existing) => normalizeText(existing) === normalized)) {
      continue;
    }
    orderedTerms.push(term);
  }

  return orderedTerms.slice(0, 18);
}
