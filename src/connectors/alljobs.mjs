import { normalizeTerms } from "./http.mjs";
import { absolutizeUrl, decodeHtml, fetchHtml, uniqueBy } from "./html.mjs";
import { normalizeJob } from "./job-model.mjs";

function buildUrl(template, term) {
  return template.replaceAll("{queryEncoded}", encodeURIComponent(term)).replaceAll("{query}", term);
}

function parseAllJobsPage(html, pageUrl, source) {
  const jobs = [];
  const titlePattern = /<div class="job-content-top-title[^"]*"[\s\S]*?<a[^>]+href="([^"]+)"[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<div class="T14">([\s\S]*?)<\/div>/gi;
  const matches = [...html.matchAll(titlePattern)];

  for (let index = 0; index < matches.length; index += 1) {
    const titleMatch = matches[index];
    const nextMatch = matches[index + 1];
    const blockStart = Math.max(0, titleMatch.index - 1200);
    const blockEnd = nextMatch?.index ?? Math.min(html.length, titleMatch.index + 9000);
    const block = html.slice(blockStart, blockEnd);

    const locationMatch = block.match(/<div class="job-content-top-location">([\s\S]*?)(?=<div class="\s*job-content-top-type|<div id="job-content-top-acord|<div class="job-content-top-acord)/i);
    const typeMatch = block.match(/<div class="\s*job-content-top-type">([\s\S]*?)<\/div>/i);
    const descriptionMatch = block.match(/<div class="job-content-top-desc[^"]*">([\s\S]*?)(?=<div class="job-content-top-desc"|<div class="H5"|<div id="job-content-bottom)/i);
    const idMatch = titleMatch[1].match(/JobID=(\d+)/i);

    jobs.push(normalizeJob({
      id: idMatch?.[1] ?? titleMatch[1],
      company: decodeHtml(titleMatch[3]),
      title: decodeHtml(titleMatch[2]),
      location: decodeHtml(locationMatch?.[1]),
      workMode: decodeHtml(typeMatch?.[1]),
      source: source.name ?? "AllJobs",
      applyUrl: absolutizeUrl(titleMatch[1], pageUrl),
      description: decodeHtml([
        descriptionMatch?.[1],
        locationMatch?.[1],
        typeMatch?.[1]
      ].filter(Boolean).join(" ")),
      tags: ["Israel", "AllJobs"]
    }, source));
  }

  return jobs;
}

export async function loadAllJobs(source) {
  const terms = normalizeTerms(source.searchTerms ?? ["PMO"]);
  const maxQueries = source.maxQueries ?? 3;
  const template = source.urlTemplate ?? "https://www.alljobs.co.il/SearchResultsGuest.aspx?keyWord={queryEncoded}";
  const jobs = [];
  const failures = [];

  for (const term of terms.slice(0, maxQueries)) {
    const url = buildUrl(template, term);
    try {
      const html = await fetchHtml(url, source.id);
      jobs.push(...parseAllJobsPage(html, url, source));
    } catch (error) {
      failures.push(`${term}: ${error.message}`);
    }
  }

  const uniqueJobs = uniqueBy(jobs, (job) => job.applyUrl || `${job.company}|${job.title}`);
  if (!uniqueJobs.length && failures.length) {
    throw new Error(failures.slice(0, 3).join(" | "));
  }

  return uniqueJobs;
}
