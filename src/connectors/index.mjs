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

// Per-source aggregate timeout. This caps the TOTAL time a single source may
// take (across all of its internal requests), on top of the existing
// per-request timeouts inside http.mjs / html.mjs. With parallel loading, the
// whole scan is bounded by this value instead of the sum of all sources.
const DEFAULT_SOURCE_TIMEOUT_MS = 22000;

// Races a promise against a timeout so a slow/hanging source cannot block the
// scan. Rejects with a clear error on timeout; always clears the timer.
export function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Returns the job-fetching function for a fetchable source type, or null for
// types that do not fetch (searchPage) or are unsupported.
function getSourceLoader(source, rootDir) {
  switch (source.type) {
    case "file": return () => loadFileJobs(source, rootDir, resolveLocal);
    case "jsonApi": return () => loadJsonApiJobs(source);
    case "remotive": return () => loadRemotiveJobs(source);
    case "himalayas": return () => loadHimalayasJobs(source);
    case "hiremetech": return () => loadHireMeTechJobs(source);
    case "alljobs": return () => loadAllJobs(source);
    case "drushim": return () => loadDrushim(source);
    default: return null;
  }
}

export async function loadJobsFromSources({ rootDir, sourcesPath, searchTerms = [], sourceIds = [] }) {
  const config = await readJson(resolveLocal(sourcesPath, rootDir));
  const selectedSourceIds = new Set((sourceIds ?? []).filter(Boolean));
  const sources = (config.sources ?? []).map((source) => {
    if (source.useProfileSearchTerms === false) {
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

  if (!searchTerms.length) {
    notices.push("We could not confidently detect your target roles. Please add a target role or improve your CV text.");
  }

  // Build sourceLinks synchronously and collect the fetch tasks. Links are
  // added here (not inside the timed fetch) so direct/search links remain
  // available even when a source later times out or fails.
  const fetchTasks = [];
  for (const source of enabledSources) {
    if (source.type === "searchPage") {
      sourceLinks.push(...buildSearchPageLinks(source));
      continue;
    }

    sourceLinks.push(...buildDirectSourceLinks(source));

    const loader = getSourceLoader(source, rootDir);
    if (!loader) {
      notices.push(`${source.id}: unsupported source type "${source.type}"`);
      continue;
    }

    const timeoutMs = Number(source.sourceTimeoutMs) > 0
      ? Number(source.sourceTimeoutMs)
      : DEFAULT_SOURCE_TIMEOUT_MS;
    // Start the loader eagerly so all sources run in parallel.
    fetchTasks.push({ source, promise: withTimeout(loader(), timeoutMs) });
  }

  // Run every source in parallel; one slow/failing source never blocks others.
  const settled = await Promise.allSettled(fetchTasks.map((task) => task.promise));
  settled.forEach((result, index) => {
    const { source } = fetchTasks[index];
    if (result.status === "fulfilled") {
      jobs.push(...normalizeJobs(result.value, source));
    } else {
      notices.push(`${source.id}: ${result.reason?.message ?? result.reason}`);
    }
  });

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
