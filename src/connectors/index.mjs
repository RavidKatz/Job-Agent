import path from "node:path";
import { readJson } from "../io.mjs";
import { loadFileJobs } from "./file.mjs";
import { loadJsonApiJobs } from "./json-api.mjs";

export function resolveLocal(filePath, rootDir) {
  return path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
}

export async function loadJobsFromSources({ rootDir, sourcesPath }) {
  const config = await readJson(resolveLocal(sourcesPath, rootDir));
  const sources = config.sources ?? [];
  const enabledSources = sources.filter((source) => source.enabled);
  const disabledSources = sources.filter((source) => !source.enabled);
  const jobs = [];
  const notices = [];

  for (const source of enabledSources) {
    try {
      if (source.type === "file") {
        jobs.push(...await loadFileJobs(source, rootDir, resolveLocal));
      } else if (source.type === "jsonApi") {
        jobs.push(...await loadJsonApiJobs(source));
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

  return { jobs, notices, enabledSources, disabledSources };
}
