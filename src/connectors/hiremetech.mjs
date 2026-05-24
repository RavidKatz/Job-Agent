import { fetchJson, normalizeTerms, stripHtml } from "./http.mjs";

function formatLocation(location) {
  if (!location || typeof location !== "object") return "Israel";

  return [
    location.city,
    location.country,
    location.is_remote ? "Remote" : "",
    location.is_hybrid ? "Hybrid" : ""
  ].filter(Boolean).join(", ") || "Israel";
}

function formatWorkMode(location) {
  if (!location || typeof location !== "object") return "";
  if (location.is_remote) return "Remote";
  if (location.is_hybrid) return "Hybrid";
  return "On-site";
}

function buildJobUrl(job) {
  return job.job_url || `https://hiremetech.com/job/${job.id}`;
}

export async function loadHireMeTechJobs(source) {
  const terms = normalizeTerms(source.searchTerms ?? ["project manager"]);
  const maxQueries = source.maxQueries ?? 4;
  const limit = source.limit ?? 20;
  const jobs = [];

  for (const term of terms.slice(0, maxQueries)) {
    const url = new URL("https://hiremetech.com/api/jobs/search");
    url.searchParams.set("israeli", "true");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("page", "1");
    url.searchParams.set("sort_by", "posted_date");
    url.searchParams.set("sort_order", "desc");
    url.searchParams.set("country", source.country ?? "Israel");
    url.searchParams.set("title", term);

    const payload = await fetchJson(url, source.id);
    for (const job of payload.jobs ?? []) {
      jobs.push({
        company: job.company_name || job.company?.name || "",
        title: job.title ?? "",
        location: formatLocation(job.location),
        workMode: formatWorkMode(job.location),
        source: source.name ?? "HireMeTech",
        applyUrl: buildJobUrl(job),
        postedAt: job.posted_date || job.reposted_at || job.first_seen_at || "",
        description: stripHtml([
          job.description,
          job.requirements,
          job.experience,
          job.job_level,
          job.employment_type,
          job.department,
          job.general_category,
          job.ai_category
        ].join(" ")),
        tags: [
          ...(job.skills ?? []),
          ...(job.skills_required ?? []),
          ...(job.tech_stack ?? []),
          ...(job.extracted_skills ?? []),
          job.job_level,
          job.employment_type,
          job.department,
          job.general_category,
          job.ai_category
        ].filter(Boolean)
      });
    }
  }

  return jobs;
}
