import { includesPhrase, normalizeText, uniqueSorted } from "./text.mjs";

const ROLE_FAMILIES = [
  {
    id: "ai-project-management",
    title: "ניהול פרויקטי בינה מלאכותית",
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
      "שילוב בין ניהול פרויקטים, תהליכים ואוטומציה",
      "מתאים לפרופיל שמחבר בין צורך עסקי לביצוע טכנולוגי"
    ]
  },
  {
    id: "pmo",
    title: "ניהול תהליכים ו־PMO",
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
      "מתאים לניסיון במעקב, תיאום, דוחות וניהול תהליכים",
      "מתאים לעבודה מול ממשקים רבים בארגון"
    ]
  },
  {
    id: "business-applications",
    title: "יישום וניהול מערכות עסקיות",
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
      "מתאים לפרופיל שמבין גם תהליך עסקי וגם מערכת",
      "מתאים לתפקידי יישום, אפיון והטמעה"
    ]
  },
  {
    id: "digital-projects",
    title: "ניהול פרויקטים דיגיטליים",
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
      "מתאים לפרופיל עם חיבור בין שירות, מוצר, מערכות ותפעול",
      "מתאים לפרויקטים דיגיטליים חוצי ארגון"
    ]
  },
  {
    id: "operations",
    title: "תפעול ושיפור תהליכים",
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
      "מתאים לפרופיל אנליטי עם חשיבה תהליכית",
      "מתאים לתפקידי שיפור, בקרה ותפעול"
    ]
  },
  {
    id: "product-operations",
    title: "תפעול מוצר",
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
      "מתאים לפרופיל שמחבר בין משתמשים, דאטה ותהליכי מוצר",
      "מתאים לסביבה טכנולוגית שאינה דורשת להיות מפתח"
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
  if (yearsExperience == null) return "לא זוהתה רמת ניסיון מדויקת";
  if (yearsExperience < 2) return "תחילת קריירה";
  if (yearsExperience < 5) return "ביניים";
  if (yearsExperience < 9) return "מנוסה";
  return "בכיר";
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
