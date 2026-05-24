import path from "node:path";
import { readJson } from "../io.mjs";
import { loadFileJobs } from "./file.mjs";
import { loadHimalayasJobs } from "./himalayas.mjs";
import { loadJsonApiJobs } from "./json-api.mjs";
import { loadRemotiveJobs } from "./remotive.mjs";
import { buildSearchPageLinks } from "./search-pages.mjs";

export function resolveLocal(filePath, rootDir) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

export async function loadJobsFromSources({ rootDir, sourcesPath, searchTerms = [] }) {
  const config = await readJson(resolveLocal(sourcesPath, rootDir));
  const sources = (config.sources ?? []).map((source) => {
    if (!searchTerms.length || source.useProfileSearchTerms === false) {
      return source;
    }

    if (["remotive", "himalayas", "searchPage"].includes(source.type)) {
      return { ...source, searchTerms };
    }

    return source;
  });
  const enabledSources = sources.filter((source) => source.enabled);
  const disabledSources = sources.filter((source) => !source.enabled);
  const jobs = [];
  const notices = [];
  const sourceLinks = [];

  for (const source of enabledSources) {
    try {
      if (source.type === "file") {
        jobs.push(...await loadFileJobs(source, rootDir, resolveLocal));
      } else if (source.type === "jsonApi") {
        jobs.push(...await loadJsonApiJobs(source));
      } else if (source.type === "remotive") {
        jobs.push(...await loadRemotiveJobs(source));
      } else if (source.type === "himalayas") {
        jobs.push(...await loadHimalayasJobs(source));
      } else if (source.type === "searchPage") {
        sourceLinks.push(...buildSearchPageLinks(source));
      } else {
        notices.push(`${source.id}: unsupported source type "${source.type}"`);
      }
    } catch (error) {
      notices.push(`${source.id}: ${error.message}`);
    }
  }

  for (const source of disabledSources) {
    if (source.status || source.reason) {
      notices.push(`${source.id}: disabled (${source.status ?? "not_configured"}) - ${source.reason ?? ""}`.trim());
    }
  }

  return {
    jobs: dedupeJobs(jobs),
    notices,
    sourceLinks,
    enabledSources,
    disabledSources
  };
}

function dedupeJobs(jobs) {
  const seen = new Set();
  const result = [];

  for (const job of jobs) {
    const key = [
      job.applyUrl,
      job.company,
      job.title,
      job.postedAt
    ].join("|").toLowerCase();

    if (seen.has(key)) continue;
    seen.add(key);
    result.push(job);
  }

  return result;
}
