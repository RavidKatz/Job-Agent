import { includesPhrase, normalizeText, uniqueSorted } from "./text.mjs";

const ROLE_FAMILIES = [
  {
    id: "ai-solutions",
    title: "AI solutions and workflow automation",
    searchTerms: [
      "AI Solution Manager",
      "AI Project Manager",
      "AI Operations Manager",
      "Automation Project Manager"
    ],
    signals: [
      "AI",
      "AI Agent",
      "AI Workflows",
      "Automation",
      "Builder Mindset",
      "Dashboard",
      "KPI Dashboard",
      "Knowledge Agent",
      "Low-code",
      "No-code",
      "Workflow Automation",
      "Stakeholder Management"
    ],
    reasons: [
      "Matches profiles that turn business needs into internal AI workflows",
      "Fits builder-oriented project and operations work around practical AI tools"
    ]
  },
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
  },
  {
    id: "software-development",
    title: "Software development",
    searchTerms: [
      "Software Developer",
      "Full Stack Developer",
      "Frontend Developer",
      "Backend Developer",
      "Junior Software Developer"
    ],
    signals: [
      "software developer",
      "full stack",
      "frontend",
      "backend",
      "JavaScript",
      "TypeScript",
      "React",
      "Node.js",
      "Java",
      "C#",
      "software engineering",
      "web development"
    ],
    reasons: [
      "Matches technical profiles with software development experience",
      "Uses actual programming and engineering signals from the resume"
    ]
  },
  {
    id: "finance-accounting",
    title: "Finance and accounting",
    searchTerms: [
      "Bookkeeper",
      "Accountant",
      "Accounts Payable",
      "Finance Analyst",
      "Payroll Accountant"
    ],
    signals: [
      "accounting",
      "bookkeeping",
      "bookkeeper",
      "accounts payable",
      "accounts receivable",
      "payroll",
      "finance",
      "financial statements",
      "reconciliation",
      "invoices",
      "SAP",
      "Priority"
    ],
    reasons: [
      "Matches profiles with accounting, bookkeeping, payroll, or finance operations experience",
      "Prioritizes finance roles instead of project or PMO roles"
    ]
  },
  {
    id: "sales-customer-service",
    title: "Sales and customer service",
    searchTerms: [
      "Sales Representative",
      "Customer Service Representative",
      "Account Manager",
      "Customer Success Representative",
      "Sales Coordinator"
    ],
    signals: [
      "sales",
      "customer service",
      "customer support",
      "account manager",
      "customer success",
      "retention",
      "upsell",
      "crm",
      "call center",
      "service representative"
    ],
    reasons: [
      "Matches commercial and service-facing profiles",
      "Searches for customer-facing roles when those signals dominate the resume"
    ]
  },
  {
    id: "hr-recruiting",
    title: "Human resources and recruiting",
    searchTerms: [
      "Recruiter",
      "HR Coordinator",
      "Talent Acquisition Coordinator",
      "Recruitment Coordinator",
      "HR Generalist"
    ],
    signals: [
      "human resources",
      "hr",
      "recruiter",
      "recruiting",
      "talent acquisition",
      "interviews",
      "onboarding",
      "screening candidates",
      "employee experience"
    ],
    reasons: [
      "Matches resumes centered on recruiting, HR operations, and people processes",
      "Keeps the search aligned with HR roles"
    ]
  },
  {
    id: "marketing-content",
    title: "Marketing and content",
    searchTerms: [
      "Marketing Coordinator",
      "Digital Marketing Specialist",
      "Content Manager",
      "Social Media Manager",
      "Performance Marketing Specialist"
    ],
    signals: [
      "marketing",
      "digital marketing",
      "content",
      "social media",
      "campaigns",
      "seo",
      "ppc",
      "google ads",
      "facebook ads",
      "copywriting"
    ],
    reasons: [
      "Matches marketing and content profiles",
      "Uses channel and campaign evidence from the resume"
    ]
  },
  {
    id: "logistics-supply-chain",
    title: "Logistics and supply chain",
    searchTerms: [
      "Logistics Coordinator",
      "Supply Chain Coordinator",
      "Procurement Coordinator",
      "Operations Coordinator",
      "Inventory Coordinator"
    ],
    signals: [
      "logistics",
      "supply chain",
      "procurement",
      "purchasing",
      "inventory",
      "warehouse",
      "shipping",
      "import",
      "export",
      "suppliers"
    ],
    reasons: [
      "Matches operational logistics and supply-chain experience",
      "Searches for hands-on coordination roles in logistics and procurement"
    ]
  },
  {
    id: "administration-office",
    title: "Administration and office management",
    searchTerms: [
      "Office Manager",
      "Administrative Assistant",
      "Operations Assistant",
      "Back Office Coordinator",
      "Executive Assistant"
    ],
    signals: [
      "administration",
      "administrative",
      "office manager",
      "back office",
      "secretary",
      "executive assistant",
      "calendar management",
      "office operations"
    ],
    reasons: [
      "Matches administrative and office-management resumes",
      "Avoids forcing technical PMO searches when the resume is office-focused"
    ]
  }
];

const BROAD_DIRECTION_SIGNALS = new Set([
  "api",
  "business",
  "client communication",
  "crm",
  "customer",
  "dashboard",
  "data",
  "data analysis",
  "excel",
  "management",
  "operations",
  "process",
  "product",
  "project",
  "reporting",
  "reports",
  "sql",
  "stakeholder",
  "stakeholder management",
  "workflow"
].map(normalizeText));

const EXPERIENCE_PATTERNS = [
  /(\d{1,2})\+?\s*(?:years|year|שנים|שנה)/giu,
  /(?:experience|ניסיון)\s*(?:of|של)?\s*(\d{1,2})/giu
];

const RELEVANT_EXPERIENCE_TERMS = [
  "project manager",
  "project management",
  "project coordination",
  "pmo",
  "planning",
  "scheduling",
  "monitoring progress",
  "status updates",
  "stakeholder",
  "client",
  "reports",
  "reporting",
  "data analysis",
  "statistical analysis",
  "dashboard",
  "kpi",
  "crm",
  "erp",
  "systems implementation",
  "process",
  "workflow"
];

const IRRELEVANT_EXPERIENCE_TERMS = [
  "bar manager",
  "bar staff",
  "inventory",
  "suppliers",
  "aircraft technician",
  "mechanical maintenance",
  "military service",
  "volunteer"
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

function extractFirstMatchingSection(text, startLabels, endLabels) {
  for (const label of startLabels) {
    const section = extractSection(text, label, endLabels);
    if (section.trim()) return section;
  }

  return "";
}

function inferYearsFromEmploymentRanges(text) {
  const employmentText = extractFirstMatchingSection(text, [
    "Employment",
    "Experience",
    "Professional Experience",
    "Work Experience",
    "ניסיון תעסוקתי",
    "ניסיון מקצועי",
    "תעסוקה"
  ], [
    "Education",
    "Military Service",
    "Volunteer",
    "Skills",
    "Language",
    "השכלה",
    "שירות צבאי",
    "כישורים",
    "שפות"
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

function getEmploymentEntries(text) {
  const employmentText = extractFirstMatchingSection(text, [
    "Employment",
    "Experience",
    "Professional Experience",
    "Work Experience",
    "ניסיון תעסוקתי",
    "ניסיון מקצועי",
    "תעסוקה"
  ], [
    "Education",
    "Military Service",
    "Volunteer",
    "Skills",
    "Language",
    "השכלה",
    "שירות צבאי",
    "כישורים",
    "שפות"
  ]);
  const sourceText = employmentText || text;
  const lines = String(sourceText ?? "").split(/\r?\n/);
  const rangePattern = /\b(20\d{2}|19\d{2})\s*[-\u2013\u2014]\s*(20\d{2}|19\d{2}|present|current)\b/iu;
  const lineEntries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(rangePattern);
    if (!match) continue;

    const entryLines = [lines[index]];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      if (rangePattern.test(lines[nextIndex])) break;
      entryLines.push(lines[nextIndex]);
    }

    lineEntries.push({
      start: Number(match[1]),
      end: /present|current/iu.test(match[2]) ? new Date().getFullYear() : Number(match[2]),
      text: entryLines.join("\n")
    });
  }

  if (lineEntries.length) {
    return lineEntries.filter((entry) => entry.end >= entry.start && entry.end - entry.start < 30);
  }

  const entryPattern = /\b(20\d{2}|19\d{2})\s*[-\u2013\u2014]\s*(20\d{2}|19\d{2}|present|current)\b[\s\S]*?(?=\n\s*(?:20\d{2}|19\d{2})\s*[-\u2013\u2014]\s*(?:20\d{2}|19\d{2}|present|current)\b|$)/giu;

  return [...String(sourceText ?? "").matchAll(entryPattern)]
    .map((match) => ({
      start: Number(match[1]),
      end: /present|current/iu.test(match[2]) ? new Date().getFullYear() : Number(match[2]),
      text: match[0]
    }))
    .filter((entry) => entry.end >= entry.start && entry.end - entry.start < 30);
}

function cleanResumeLine(line) {
  return String(line ?? "")
    .replace(/\b(20\d{2}|19\d{2})\s*[-\u2013\u2014]\s*(20\d{2}|19\d{2}|present|current|היום|נוכחי)\b/giu, "")
    .replace(/[|•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRoleTitle(title) {
  const cleaned = cleanResumeLine(title);
  if (!cleaned) return null;

  const [beforeComma] = cleaned.split(/\s*,\s*/u);
  if (beforeComma && beforeComma.length >= 3 && beforeComma.split(/\s+/u).length <= 8) {
    return beforeComma.trim();
  }

  return cleaned;
}

function looksLikeRoleLine(line) {
  const normalized = normalizeText(line);
  if (!normalized || normalized.length < 3 || normalized.length > 90) return false;
  if (/\b(?:email|phone|linkedin|github|address)\b/iu.test(normalized)) return false;
  if (/[,.]/u.test(normalized) && normalized.split(/\s+/u).length > 8) return false;

  return ROLE_FAMILIES.some((family) => {
    return [...family.signals, ...family.searchTerms].some((term) => includesPhrase(normalized, term));
  });
}

function extractTitleFromEmploymentEntry(entry) {
  // Split each line into its pipe-separated segments so the role title is not
  // lost when a line is formatted as "2022 - present | Role Title, Company".
  const lines = String(entry?.text ?? "")
    .split(/\r?\n/)
    .flatMap((line) => String(line).split("|"))
    .map(cleanResumeLine)
    .filter(Boolean);
  const roleLine = lines.find((line) => {
    return looksLikeRoleLine(line) && line.split(/\s+/u).length <= 8;
  }) ?? lines.find(looksLikeRoleLine);
  if (roleLine) return cleanRoleTitle(roleLine);

  const fallbackLine = lines.find((line) => {
    return line.length >= 3 && line.length <= 80 && !/^\d+$/.test(line);
  }) ?? null;

  return cleanRoleTitle(fallbackLine);
}

function getLatestEmploymentEntry(text) {
  const entries = getEmploymentEntries(text);
  if (!entries.length) return null;

  return entries
    .slice()
    .sort((a, b) => (b.end - a.end) || (b.start - a.start))[0];
}

function extractLatestEducation(text) {
  const educationText = extractFirstMatchingSection(text, [
    "Education",
    "Academic Education",
    "השכלה",
    "לימודים",
    "השכלה אקדמית"
  ], [
    "Employment",
    "Experience",
    "Professional Experience",
    "Work Experience",
    "Skills",
    "Language",
    "ניסיון תעסוקתי",
    "ניסיון מקצועי",
    "כישורים",
    "שפות"
  ]);
  const sourceText = educationText || text;
  const lines = String(sourceText ?? "")
    .split(/\r?\n/)
    .map(cleanResumeLine)
    .filter(Boolean);
  const educationLines = lines.filter((line) => {
    return /b\.?sc|b\.?a|m\.?sc|m\.?a|mba|bachelor|master|degree|diploma|תואר|הנדסאי|הנדסה|מדעי|כלכלה|חשבונאות|ניהול|קורס/iu.test(line);
  });

  if (!educationLines.length) return null;

  return educationLines
    .slice()
    .sort((a, b) => {
      const yearA = Math.max(...[...a.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map((match) => Number(match[1])), 0);
      const yearB = Math.max(...[...b.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map((match) => Number(match[1])), 0);
      return yearB - yearA;
    })[0];
}

function matchedFamiliesFromText(text, config) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  return ROLE_FAMILIES
    .map((family) => {
      const matchedSignals = family.signals.filter((signal) => signalMatchesResume(normalized, signal, config));
      const matchedTerms = family.searchTerms.filter((term) => includesPhrase(normalized, term));
      return {
        family,
        hits: uniqueSorted([...matchedSignals, ...matchedTerms])
      };
    })
    .filter((result) => result.hits.length);
}

function bestFamilyFromText(text, config) {
  const matches = matchedFamiliesFromText(text, config);
  if (!matches.length) return null;

  return matches
    .slice()
    .sort((a, b) => b.hits.length - a.hits.length)[0].family;
}

function inferEducationSearchTerms(educationText) {
  const normalized = normalizeText(educationText);
  const terms = [];

  if (includesPhrase(normalized, "computer science") || includesPhrase(normalized, "software engineering") || includesPhrase(normalized, "מדעי המחשב")) {
    terms.push("Junior Software Developer", "Software Developer");
  }
  if (includesPhrase(normalized, "industrial engineering") || includesPhrase(normalized, "industrial engineering and management") || includesPhrase(normalized, "הנדסת תעשייה וניהול")) {
    terms.push("Project Coordinator", "Operations Analyst", "PMO Coordinator");
  }
  if (includesPhrase(normalized, "data science") || includesPhrase(normalized, "data analysis") || includesPhrase(normalized, "מדעי הנתונים")) {
    terms.push("Data Analyst", "Business Analyst");
  }
  if (includesPhrase(normalized, "accounting") || includesPhrase(normalized, "finance") || includesPhrase(normalized, "חשבונאות") || includesPhrase(normalized, "כלכלה")) {
    terms.push("Bookkeeper", "Accountant", "Finance Analyst");
  }
  if (includesPhrase(normalized, "human resources") || includesPhrase(normalized, "recruiting") || includesPhrase(normalized, "talent acquisition")) {
    terms.push("Recruiter", "HR Coordinator", "Talent Acquisition Coordinator");
  }

  return uniqueSorted(terms);
}

export function extractLatestResumeContext(resumeText, config = {}) {
  const latestEntry = getLatestEmploymentEntry(resumeText);
  const latestRole = extractTitleFromEmploymentEntry(latestEntry);
  const latestEducation = extractLatestEducation(resumeText);
  const latestRoleFamilies = matchedFamiliesFromText(latestRole ?? latestEntry?.text ?? "", config);
  const latestEducationFamilies = matchedFamiliesFromText(latestEducation ?? "", config);

  return {
    latestRole,
    latestRoleText: latestEntry?.text ?? null,
    latestEducation,
    roleSearchTerms: uniqueSorted(latestRoleFamilies.flatMap((result) => result.family.searchTerms.slice(0, 3))),
    educationSearchTerms: inferEducationSearchTerms(latestEducation),
    matchedRoleFamilies: latestRoleFamilies.map((result) => result.family.id),
    matchedEducationFamilies: latestEducationFamilies.map((result) => result.family.id)
  };
}

// Hebrew + English aliases for academic fields, used to detect the candidate's
// education field and specialization regardless of the resume language.
const EDUCATION_FIELD_ALIASES = {
  "industrial engineering and management": ["industrial engineering and management", "הנדסת תעשייה וניהול", "הנדסת תעשיה וניהול"],
  "industrial engineering": ["industrial engineering", "הנדסת תעשייה", "הנדסת תעשיה"],
  "data science": ["data science", "data analytics", "מדעי הנתונים", "מדע הנתונים"],
  "information systems": ["information systems", "מערכות מידע"],
  "computer science": ["computer science", "מדעי המחשב"],
  "software engineering": ["software engineering", "הנדסת תוכנה"],
  "business administration": ["business administration", "מנהל עסקים", "מנהל עסקים"],
  "accounting": ["accounting", "חשבונאות"],
  "economics": ["economics", "כלכלה"]
};

const DEGREE_PATTERNS = [
  { re: /\bmba\b/iu, label: "MBA" },
  { re: /\b(m\.?sc|master of science)\b/iu, label: "M.Sc." },
  { re: /\b(m\.?a|master)\b/iu, label: "M.A." },
  { re: /\b(b\.?sc|bachelor of science)\b/iu, label: "B.Sc." },
  { re: /\b(b\.?a|bachelor)\b/iu, label: "B.A." },
  { re: /(תואר שני)/u, label: "תואר שני" },
  { re: /(תואר ראשון|הנדסאי)/u, label: "תואר ראשון" }
];

// Action cues that mark a real responsibility line inside the last role entry.
const RESPONSIBILITY_LINE_CUES = [
  "managed", "led", "coordinated", "built", "developed", "implemented",
  "analyzed", "improved", "tracked", "delivered", "designed", "created", "owned",
  "ניהול", "ניהלתי", "הובלתי", "ריכוז", "פיתוח", "הטמעה", "ניתוח", "אחריות"
];

// Builds a structured education profile: degree, primary field, all detected
// fields, specialization, the role directions the field supports, and whether
// the field genuinely backs deep software engineering.
export function extractEducationProfile(resumeText, config = {}) {
  const educationLine = extractLatestEducation(resumeText) || "";
  const haystack = normalizeText(`${educationLine} ${resumeText}`);
  const fieldMap = config.educationFieldMap ?? {};
  const matchedKeys = Object.entries(EDUCATION_FIELD_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => includesPhrase(haystack, alias)))
    .map(([key]) => key);

  const fields = uniqueSorted(matchedKeys.map((key) => fieldMap[key]?.field ?? key));
  const directions = uniqueSorted(matchedKeys.flatMap((key) => fieldMap[key]?.directions ?? []));
  const supportsEngineering = matchedKeys.some((key) => fieldMap[key]?.supportsEngineering);
  const specialization = matchedKeys.includes("data science") ? "Data Science" : null;
  const degree = DEGREE_PATTERNS.find((pattern) => pattern.re.test(educationLine) || pattern.re.test(resumeText))?.label ?? null;
  const primaryField = matchedKeys.length ? (fieldMap[matchedKeys[0]]?.field ?? matchedKeys[0]) : null;

  return {
    degree,
    field: primaryField,
    fields,
    specialization,
    directions,
    supportsEngineering,
    raw: educationLine.trim() || null
  };
}

// Builds a structured profile of the candidate's most recent role:
// title, tools used in that role, key responsibility lines, and duration.
export function extractLastRoleProfile(resumeText, config = {}) {
  const entry = getLatestEmploymentEntry(resumeText);
  const title = extractTitleFromEmploymentEntry(entry);
  const entryText = entry?.text ?? "";
  const normalized = normalizeText(entryText);
  const aliases = config.skillAliases ?? {};
  const tools = (config.toolKeywords ?? []).filter((tool) => {
    return [tool, ...(aliases[tool] ?? [])].some((candidate) => includesPhrase(normalized, candidate));
  });
  const responsibilities = entryText
    .split(/\r?\n/)
    .map(cleanResumeLine)
    .filter(Boolean)
    .filter((line) => line.length >= 8 && RESPONSIBILITY_LINE_CUES.some((cue) => includesPhrase(line, cue)))
    .slice(0, 4);

  return {
    title: title ?? null,
    tools: uniqueSorted(tools),
    responsibilities,
    years: entry ? Math.max(0, entry.end - entry.start) : null
  };
}

function isRelevantExperienceEntry(entry) {
  const normalized = normalizeText(entry.text);
  const relevantHits = RELEVANT_EXPERIENCE_TERMS.filter((term) => includesPhrase(normalized, term));
  const irrelevantHits = IRRELEVANT_EXPERIENCE_TERMS.filter((term) => includesPhrase(normalized, term));

  return relevantHits.length >= 2 && irrelevantHits.length === 0;
}

function sumNonOverlappingYearRanges(entries) {
  const ranges = entries
    .map((entry) => [entry.start, entry.end])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);

  if (!ranges.length) return null;

  const merged = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (!previous || range[0] > previous[1]) {
      merged.push([...range]);
      continue;
    }
    previous[1] = Math.max(previous[1], range[1]);
  }

  const years = merged.reduce((sum, [start, end]) => sum + (end - start), 0);
  return years > 0 ? years : null;
}

function inferRelevantYearsFromEmploymentRanges(text) {
  const relevantEntries = getEmploymentEntries(text).filter(isRelevantExperienceEntry);
  return sumNonOverlappingYearRanges(relevantEntries);
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

  const relevantRangeYears = inferRelevantYearsFromEmploymentRanges(text);
  if (relevantRangeYears != null) return relevantRangeYears;

  const rangeYears = inferYearsFromEmploymentRanges(text);
  if (rangeYears != null && !years.length) return rangeYears;

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

function signalMatchesResume(normalizedResume, signal, config) {
  const configuredTerms = [
    ...(config.coreSkills ?? []),
    ...(config.targetRoles ?? []),
    ...(config.domainKeywords ?? [])
  ];
  const configuredTerm = configuredTerms.find((term) => normalizeText(term) === normalizeText(signal));
  const aliases = configuredTerm ? config.skillAliases?.[configuredTerm] ?? [] : [];

  return [signal, ...aliases].some((candidate) => includesPhrase(normalizedResume, candidate));
}

function isStrongRoleSignal(signal) {
  return !BROAD_DIRECTION_SIGNALS.has(normalizeText(signal));
}

export function recommendRoles(resumeText, config, latestContext = null) {
  const normalized = normalizeText(resumeText);
  const latestText = normalizeText([
    latestContext?.latestRole,
    latestContext?.latestRoleText,
    latestContext?.latestEducation
  ].filter(Boolean).join(" "));

  return ROLE_FAMILIES
    .map((family) => {
      const matchedSignals = family.signals.filter((signal) => signalMatchesResume(normalized, signal, config));
      const latestSignals = family.signals.filter((signal) => signalMatchesResume(latestText, signal, config));
      const latestSearchHits = family.searchTerms.filter((term) => includesPhrase(latestText, term));
      const strongMatchedSignals = matchedSignals.filter(isStrongRoleSignal);
      const strongLatestSignals = latestSignals.filter(isStrongRoleSignal);
      const configuredHits = (config.coreSkills ?? []).filter((skill) => {
        return family.signals.some((signal) => normalizeText(signal) === normalizeText(skill))
          && signalMatchesResume(normalized, skill, config);
      });
      const hasStrongEvidence = latestSearchHits.length > 0
        || strongLatestSignals.length > 0
        || strongMatchedSignals.length >= 2;
      const latestContextBonus = (strongLatestSignals.length * 24) + (latestSearchHits.length * 25);
      const score = hasStrongEvidence
        ? Math.min(100, Math.round((strongMatchedSignals.length * 18) + (configuredHits.length * 4) + latestContextBonus))
        : 0;

      return {
        id: family.id,
        title: family.title,
        score,
        searchTerms: family.searchTerms,
        matchedSignals: uniqueSorted([...matchedSignals, ...latestSignals, ...latestSearchHits]),
        reasons: family.reasons
      };
    })
    .filter((role) => role.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Builds candidate-relative substance signals from the detected role families,
// so the matcher is not biased toward one fixed career direction (e.g. PMO).
// Positive = signals/titles of the families this CV matches.
// Negative = role titles of clearly different families this CV does not match.
export function buildDirectionSignals(roleRecommendations = []) {
  const recommendedIds = new Set(roleRecommendations.map((role) => role.id));
  const positive = new Set();
  const negative = new Set();

  for (const family of ROLE_FAMILIES) {
    if (!recommendedIds.has(family.id)) continue;
    for (const term of [...family.signals, ...family.searchTerms]) positive.add(term);
  }

  for (const family of ROLE_FAMILIES) {
    if (recommendedIds.has(family.id)) continue;
    for (const term of family.searchTerms) {
      if (!positive.has(term)) negative.add(term);
    }
  }

  return { positive: uniqueSorted([...positive]), negative: uniqueSorted([...negative]) };
}

// Classifies a job's text to the best-matching role family (generic taxonomy),
// so job direction is inferred the same data-driven way as the candidate's.
export function inferJobFamily(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  let bestId = null;
  let bestScore = 0;
  for (const family of ROLE_FAMILIES) {
    const score = [...family.signals, ...family.searchTerms]
      .filter((term) => includesPhrase(normalized, term)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = family.id;
    }
  }
  return bestScore >= 2 ? bestId : null;
}

export function buildDynamicSearchTerms(recommendations, config, latestContext = null) {
  const topScore = recommendations[0]?.score ?? 0;
  const selectedRecommendations = recommendations.filter((role) => {
    return role.score >= Math.max(50, topScore - 25);
  });
  const priorityTerms = selectedRecommendations.flatMap((role) => role.searchTerms.slice(0, 2));
  const remainingRoleTerms = selectedRecommendations.flatMap((role) => role.searchTerms.slice(2));
  const latestTerms = [
    latestContext?.latestRole,
    ...(latestContext?.roleSearchTerms ?? []),
    ...(latestContext?.educationSearchTerms ?? [])
  ].filter((term) => String(term ?? "").trim().length >= 3);
  const orderedTerms = [];

  const latestRoleFamily = bestFamilyFromText([
    latestContext?.latestRole,
    latestContext?.latestRoleText
  ].filter(Boolean).join(" "), config);
  const latestRoleFallbackTerms = latestContext?.latestRole
    ? [
      latestContext.latestRole,
      ...(latestRoleFamily?.searchTerms ?? [])
    ]
    : [];
  const educationFallbackTerms = latestContext?.latestEducation
    ? latestContext.educationSearchTerms ?? []
    : [];

  for (const term of [...latestTerms, ...priorityTerms, ...remainingRoleTerms, ...latestRoleFallbackTerms, ...educationFallbackTerms]) {
    const normalized = normalizeText(term);
    if (!normalized || orderedTerms.some((existing) => normalizeText(existing) === normalized)) {
      continue;
    }
    orderedTerms.push(term);
  }

  return orderedTerms.slice(0, 18);
}
