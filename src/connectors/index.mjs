import path from "node:path";
import { readJson } from "../io.mjs";
import { loadFileJobs } from "./file.mjs";
import { loadAllJobs } from "./alljobs.mjs";
import { loadDrushim } from "./drushim.mjs";
import { loadHireMeTechJobs } from "./hiremetech.mjs";
import { loadHimalayasJobs } from "./himalayas.mjs";
import { loadJsonApiJobs } from "./json-api.mjs";
import { loadRemotiveJobs } from "./remotive.mjs";
import { normalizeJobs } from "./job-model.mjs";
import { buildDirectSourceLinks, buildSearchPageLinks } from "./search-pages.mjs";

export function resolveLocal(filePath, rootDir) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

export async function loadJobsFromSources({ rootDir, sourcesPath, searchTerms = [], sourceIds = [] }) {
  const config = await readJson(resolveLocal(sourcesPath, rootDir));
  const selectedSourceIds = new Set((sourceIds ?? []).filter(Boolean));
  const sources = (config.sources ?? []).map((source) => {
    if (!searchTerms.length || source.useProfileSearchTerms === false) {
      return source;
    }

    if (["remotive", "himalayas", "hiremetech", "alljobs", "drushim", "searchPage"].includes(source.type)) {
      return { ...source, searchTerms };
    }

    return source;
  });
  const selectableSources = selectedSourceIds.size
    ? sources.filter((source) => selectedSourceIds.has(source.id))
    : sources;
  const enabledSources = selectableSources.filter((source) => source.enabled);
  const disabledSources = selectableSources.filter((source) => !source.enabled);
  const jobs = [];
  const notices = [];
  const sourceLinks = [];

  for (const source of enabledSources) {
    try {
      if (source.type !== "searchPage") {
        sourceLinks.push(...buildDirectSourceLinks(source));
      }

      if (source.type === "file") {
        jobs.push(...normalizeJobs(await loadFileJobs(source, rootDir, resolveLocal), source));
      } else if (source.type === "jsonApi") {
        jobs.push(...normalizeJobs(await loadJsonApiJobs(source), source));
      } else if (source.type === "remotive") {
        jobs.push(...normalizeJobs(await loadRemotiveJobs(source), source));
      } else if (source.type === "himalayas") {
        jobs.push(...normalizeJobs(await loadHimalayasJobs(source), source));
      } else if (source.type === "hiremetech") {
        jobs.push(...normalizeJobs(await loadHireMeTechJobs(source), source));
      } else if (source.type === "alljobs") {
        jobs.push(...normalizeJobs(await loadAllJobs(source), source));
      } else if (source.type === "drushim") {
        jobs.push(...normalizeJobs(await loadDrushim(source), source));
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

  // Drop only jobs that are genuinely unusable (no title, or nothing to match
  // on). Everything else is kept and downgraded via its quality assessment.
  const usableJobs = jobs.filter((job) => job.quality?.isRealJob !== false);
  const droppedCount = jobs.length - usableJobs.length;
  if (droppedCount > 0) {
    notices.push(`Filtered ${droppedCount} unusable or search-shortcut entries with no real job data.`);
  }

  return {
    jobs: dedupeJobs(usableJobs),
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
