const SOURCE_LABELS = {
  "manual-sample": "mock",
  file: "manual",
  csv: "csv",
  manual: "manual",
  mock: "mock",
  hiremetech: "hiremetech",
  "drushim-search": "drushim",
  drushim: "drushim",
  "alljobs-search": "alljobs",
  alljobs: "alljobs",
  "linkedin-search": "linkedin",
  linkedin: "linkedin"
};

function readPath(value, pathExpression) {
  if (!pathExpression) return undefined;
  return String(pathExpression)
    .split(".")
    .reduce((current, key) => {
      if (current == null) return undefined;
      return current[key];
    }, value);
}

function readMappedValue(raw, mapping) {
  if (Array.isArray(mapping)) {
    return mapping
      .map((item) => readPath(raw, item))
      .filter((item) => item != null && String(item).trim() !== "")
      .join("\n");
  }
  return readPath(raw, mapping);
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function cleanArray(value) {
  if (value == null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function inferSourceLabel(source = {}) {
  const id = String(source.id ?? "").toLowerCase();
  const type = String(source.type ?? "").toLowerCase();
  const name = String(source.name ?? "").toLowerCase();
  const path = String(source.path ?? "").toLowerCase();

  if (SOURCE_LABELS[id]) return SOURCE_LABELS[id];
  if (SOURCE_LABELS[type]) return SOURCE_LABELS[type];
  if (path.endsWith(".csv")) return "csv";
  if (name.includes("linkedin")) return "linkedin";
  if (name.includes("alljobs")) return "alljobs";
  if (name.includes("drushim")) return "drushim";
  if (name.includes("hiremetech")) return "hiremetech";
  if (name.includes("mock") || name.includes("sample")) return "mock";
  return type || id || "manual";
}

// ---------------------------------------------------------------------------
// Job data quality layer
//
// Before a job reaches the matching engine, it gets a quality assessment so the
// app can tell whether the data is real, complete, and trustworthy. This does
// not change the match score; it adds an explainable quality signal and lets
// the pipeline drop only jobs that are genuinely unusable.
// ---------------------------------------------------------------------------

// Source reliability tiers. Structured APIs and curated/file sources are more
// trustworthy than scraped HTML or generic search pages.
const SOURCE_RELIABILITY = {
  manual: "high",
  file: "high",
  csv: "high",
  jsonapi: "high",
  remotive: "high",
  himalayas: "high",
  hiremetech: "high",
  alljobs: "medium",
  mock: "medium",
  drushim: "low",
  linkedin: "low",
  searchpage: "low"
};

// Maximum quality score we are willing to assign per reliability tier.
const RELIABILITY_CAP = { high: 100, medium: 80, low: 55 };

// A description shorter than this is treated as too weak to trust fully.
const MIN_DESCRIPTION_LENGTH = 120;

function inferSourceReliability(job, source = {}) {
  const keys = [job.sourceLabel, job.sourceType, source.type, source.id]
    .map((value) => String(value ?? "").toLowerCase());
  for (const key of keys) {
    if (SOURCE_RELIABILITY[key]) return SOURCE_RELIABILITY[key];
  }
  return "medium";
}

// Detects company values that are clearly parsing garbage rather than a name:
// pure numbers, hex ids, distance values, or URLs.
function isSuspiciousCompany(company) {
  if (!company) return false; // a missing company is handled separately
  const text = String(company).trim();
  if (text.length < 2) return true;
  if (/^\d+$/.test(text)) return true; // pure number
  if (/^[a-f0-9]{8,}$/i.test(text)) return true; // hex/id garbage
  if (/^\d+(\.\d+)?\s*(km|ק"?מ|מטר|meters?|miles?)\b/i.test(text)) return true; // distance value
  if (/^https?:|^\//i.test(text)) return true; // URL used as a company name
  return false;
}

// Detects an apply URL that points to a search results page rather than a
// specific job posting (a "search shortcut").
function isSearchShortcutUrl(url) {
  if (!url) return false;
  const text = String(url).toLowerCase();
  const looksLikeSearch = /\/search\/|searchresults|\/results\b|[?&](q|query|keyword|keywords)=/.test(text);
  const looksLikeSpecificJob = /jobid=\d+|\/job\/\d+|\/jobs\/\d+|\/position\/\d+|\/o\/\d+/.test(text);
  return looksLikeSearch && !looksLikeSpecificJob;
}

// Returns a consistent quality object for any job. Never throws on missing
// fields; missing data simply lowers the score and adds a warning.
export function assessJobQuality(job = {}, source = {}) {
  const missingFields = [];
  const qualityWarnings = [];
  let score = 100;

  const reliability = inferSourceReliability(job, source);
  const hasTitle = Boolean(job.title);
  const hasCompany = Boolean(job.company);
  const hasDescription = Boolean(job.description);
  const hasApplyUrl = Boolean(job.applyUrl);
  const descriptionLength = job.description ? String(job.description).trim().length : 0;

  if (!hasTitle) {
    score -= 40;
    missingFields.push("title");
    qualityWarnings.push("חסר שם משרה");
  }
  if (!hasCompany) {
    score -= 15;
    missingFields.push("company");
    qualityWarnings.push("חסר שם חברה");
  }
  if (!hasDescription) {
    score -= 25;
    missingFields.push("description");
    qualityWarnings.push("חסר תיאור משרה");
  } else if (descriptionLength < MIN_DESCRIPTION_LENGTH) {
    score -= 15;
    qualityWarnings.push("תיאור המשרה קצר מאוד");
  }
  if (!hasApplyUrl) {
    score -= 15;
    missingFields.push("applyUrl");
    qualityWarnings.push("אין קישור הגשה ישיר");
  }

  if (isSuspiciousCompany(job.company)) {
    score -= 20;
    qualityWarnings.push("שם החברה נראה לא תקין");
  }

  const isSearchShortcut = isSearchShortcutUrl(job.applyUrl);
  if (isSearchShortcut) {
    qualityWarnings.push("הקישור מפנה לעמוד חיפוש ולא למשרה ספציפית");
    score = Math.min(score, 35); // a search shortcut is not a normal job match
  }

  // Cap by source reliability so weakly parsed sources never look fully trusted.
  score = Math.min(score, RELIABILITY_CAP[reliability] ?? 80);

  // A job is unusable for matching only if it has no title, or nothing to match
  // on (no description and no company), or it is a shortcut with no description.
  const unusable = !hasTitle || (!hasDescription && !hasCompany) || (isSearchShortcut && !hasDescription);

  return {
    dataQualityScore: Math.max(0, Math.min(100, Math.round(score))),
    sourceReliability: reliability,
    missingFields,
    qualityWarnings,
    isSearchShortcut,
    isRealJob: !unusable
  };
}

export function normalizeJob(raw = {}, source = {}, fieldMap = {}) {
  const get = (targetField, fallbackFields) => {
    if (fieldMap[targetField]) {
      return readMappedValue(raw, fieldMap[targetField]);
    }

    for (const fallback of fallbackFields) {
      const value = readPath(raw, fallback);
      if (value != null && String(value).trim() !== "") return value;
    }
    return null;
  };

  const sourceLabel = inferSourceLabel(source);
  const sourceId = cleanText(source.id) ?? sourceLabel;
  const sourceName = cleanText(source.name) ?? sourceId;

  const job = {
    id: cleanText(get("id", ["id", "jobId", "uuid"])) ?? null,
    company: cleanText(get("company", ["company", "companyName", "company_name", "employer", "organization.name"])),
    title: cleanText(get("title", ["title", "position", "name", "jobTitle"])),
    location: cleanText(get("location", ["location", "city", "workplace", "address", "candidate_required_location"])),
    workMode: cleanText(get("workMode", ["workMode", "remote", "workplaceType"])),
    source: sourceName,
    sourceId,
    sourceName,
    sourceLabel,
    sourceType: cleanText(source.type) ?? "manual",
    applyUrl: cleanText(get("applyUrl", ["applyUrl", "url", "link", "applicationUrl", "applicationLink", "redirect_url"])),
    postedAt: cleanText(get("postedAt", ["postedAt", "publishedAt", "createdAt", "date", "publication_date", "pubDate"])),
    description: cleanText(get("description", ["description", "body", "requirements", "summary", "excerpt"])),
    tags: cleanArray(raw.tags ?? raw.keywords ?? raw.skills ?? raw.categories),
    raw
  };

  // Attach the data quality assessment before the job reaches matching.
  job.quality = assessJobQuality(job, source);
  return job;
}

export function normalizeJobs(jobs = [], source = {}) {
  return (Array.isArray(jobs) ? jobs : []).map((job) => normalizeJob(job, source, source.fieldMap));
}

export function getArrayByPath(payload, arrayPath) {
  if (!arrayPath) return Array.isArray(payload) ? payload : [];
  const value = readPath(payload, arrayPath);
  return Array.isArray(value) ? value : [];
}
