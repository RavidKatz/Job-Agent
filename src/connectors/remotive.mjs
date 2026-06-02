import { fetchJson, normalizeTerms, stripHtml } from "./http.mjs";
import { normalizeJob } from "./job-model.mjs";

export async function loadRemotiveJobs(source) {
  const terms = normalizeTerms(source.searchTerms ?? ["project manager"]);
  const maxQueries = source.maxQueries ?? 2;
  const limit = source.limit ?? 20;
  const jobs = [];

  for (const term of terms.slice(0, maxQueries)) {
    const url = new URL("https://remotive.com/api/remote-jobs");
    url.searchParams.set("search", term);
    url.searchParams.set("limit", String(limit));

    const payload = await fetchJson(url, source.id);
    for (const job of payload.jobs ?? []) {
      jobs.push(normalizeJob({
        id: job.id,
        company: job.company_name ?? "",
        title: job.title ?? "",
        location: job.candidate_required_location ?? "Remote",
        workMode: "Remote",
        source: source.name ?? "Remotive",
        applyUrl: job.url ?? "",
        postedAt: job.publication_date ?? "",
        description: stripHtml([job.category, job.job_type, job.description].join(" ")),
        tags: [job.category, job.job_type].filter(Boolean)
      }, source));
    }
  }

  return jobs;
}
