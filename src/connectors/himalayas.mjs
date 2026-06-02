import { fetchJson, normalizeTerms, stripHtml } from "./http.mjs";
import { normalizeJob } from "./job-model.mjs";

function readJobs(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function formatLocation(job) {
  const restrictions = Array.isArray(job.locationRestrictions)
    ? job.locationRestrictions.join(", ")
    : "";
  return restrictions || job.location || "Remote";
}

export async function loadHimalayasJobs(source) {
  const terms = normalizeTerms(source.searchTerms ?? ["project manager"]);
  const maxQueries = source.maxQueries ?? 2;
  const jobs = [];

  for (const term of terms.slice(0, maxQueries)) {
    const url = new URL("https://himalayas.app/jobs/api/search");
    url.searchParams.set("q", term);
    url.searchParams.set("sort", "recent");
    url.searchParams.set("page", "1");

    const payload = await fetchJson(url, source.id);
    for (const job of readJobs(payload)) {
      jobs.push(normalizeJob({
        id: job.id,
        company: job.companyName ?? "",
        title: job.title ?? "",
        location: formatLocation(job),
        workMode: "Remote",
        source: source.name ?? "Himalayas",
        applyUrl: job.applicationLink || job.url || "",
        postedAt: job.pubDate ?? "",
        description: stripHtml([job.excerpt, job.description].join(" ")),
        tags: [
          job.employmentType,
          ...(Array.isArray(job.category) ? job.category : []),
          ...(Array.isArray(job.parentCategories) ? job.parentCategories : [])
        ].filter(Boolean)
      }, source));
    }
  }

  return jobs;
}
