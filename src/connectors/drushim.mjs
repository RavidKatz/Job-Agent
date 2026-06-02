import { normalizeTerms } from "./http.mjs";
import { absolutizeUrl, decodeHtml, fetchHtml, uniqueBy } from "./html.mjs";
import { normalizeJob } from "./job-model.mjs";

const TITLE_HINTS = [
  "מנהל",
  "מנהלת",
  "פרויקט",
  "פרויקטים",
  "מערכות מידע",
  "מיישם",
  "BI",
  "Data",
  "Customer Success",
  "Product",
  "PMO"
];

function buildUrl(template, term) {
  return template.replaceAll("{queryEncoded}", encodeURIComponent(term)).replaceAll("{query}", term);
}

function decodeEmbeddedText(value) {
  return decodeHtml(String(value ?? "")
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/"));
}

function parseQuotedStrings(html) {
  return [...html.matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((match) => decodeEmbeddedText(match[1]))
    .filter(Boolean);
}

function looksLikeJobTitle(value) {
  const text = String(value ?? "").trim();
  if (text.length < 8 || text.length > 140) return false;
  if (/^https?:/i.test(text) || text.startsWith("/")) return false;
  if (/\.(png|jpg|jpeg|svg|webp)$/i.test(text)) return false;
  if (/[{};<>]|display:|visibility:|transform:|width:|height:/i.test(text)) return false;
  if (/organization-structure|mobile-|menu-|דרושים IL|לפניכם משרות|קטגוריית/i.test(text)) return false;
  if (/^[a-z0-9_-]+$/i.test(text)) return false;

  const hasHebrew = /[\u0590-\u05ff]/.test(text);
  const hasEnglishRole = /\b(Data Analyst|BI|Product|Customer Success|PMO)\b/i.test(text);
  if (!hasHebrew && !hasEnglishRole) return false;

  return TITLE_HINTS.some((hint) => text.toLowerCase().includes(hint.toLowerCase()));
}

function looksLikeCompany(value) {
  const text = String(value ?? "").trim();
  if (text.length < 2 || text.length > 80) return false;
  if (/^\d+$|^[a-f0-9]{8}$/i.test(text)) return false;
  if (/^\d{4}-\d{2}-\d{2}T|\\u003C|<br|•/.test(text)) return false;
  if (looksLikeJobTitle(text)) return false;
  if (/^https?:|^\/|דרושים|משרות|קטגוריה|איזור|תחום|לפני|משרה מלאה|היברידי|ללא נסיון/i.test(text)) return false;
  return true;
}

function parseDrushimPage(html, pageUrl, source) {
  const values = parseQuotedStrings(html);
  const jobs = [];
  const titleIndexes = [];

  values.forEach((value, index) => {
    if (looksLikeJobTitle(value)) titleIndexes.push(index);
  });

  for (const index of titleIndexes) {
    const title = values[index];
    const nextValues = values.slice(index + 1, index + 18);
    const previousValues = values.slice(Math.max(0, index - 10), index).reverse();
    const company = nextValues.find(looksLikeCompany) ?? previousValues.find(looksLikeCompany) ?? "";
    const location = nextValues.find((value) => {
      return String(value).length <= 45 && /תל אביב|פתח תקווה|רמת גן|חיפה|כפר סבא|ראשון|ירושלים|רחובות|בני ברק|רעננה|הרצליה|ישראל/i.test(value);
    }) ?? "";
    const id = previousValues.find((value) => /^\d{7,9}$/.test(value)) ?? nextValues.find((value) => /^\d{7,9}$/.test(value)) ?? `${source.id}-${index}`;

    jobs.push(normalizeJob({
      id,
      company,
      title,
      location,
      workMode: nextValues.find((value) => /היברידי|משרה מלאה|עבודה מהבית|משמרות/i.test(value)) ?? "",
      source: source.name ?? "Drushim",
      applyUrl: absolutizeUrl(pageUrl, "https://www.drushim.co.il"),
      description: [
        title,
        company,
        location,
        ...nextValues.slice(0, 8)
      ].filter(Boolean).join(" "),
      tags: ["Israel", "Drushim"]
    }, source));
  }

  return uniqueBy(jobs, (job) => `${job.title}|${job.company}|${job.location}`).slice(0, source.limit ?? 25);
}

export async function loadDrushim(source) {
  const terms = normalizeTerms(source.searchTerms ?? ["PMO"]);
  const maxQueries = source.maxQueries ?? 2;
  const template = source.urlTemplate ?? "https://www.drushim.co.il/jobs/search/{queryEncoded}/";
  const urls = [
    ...(source.directLinks ?? []).map((link) => link.url).filter(Boolean),
    ...terms.slice(0, maxQueries).map((term) => buildUrl(template, term))
  ];
  const jobs = [];
  const failures = [];

  for (const url of urls) {
    try {
      const html = await fetchHtml(url, source.id);
      jobs.push(...parseDrushimPage(html, url, source));
    } catch (error) {
      failures.push(`${url}: ${error.message}`);
    }
  }

  const uniqueJobs = uniqueBy(jobs, (job) => `${job.title}|${job.company}|${job.location}`);
  if (!uniqueJobs.length && failures.length) {
    throw new Error(failures.slice(0, 2).join(" | "));
  }

  return uniqueJobs;
}
