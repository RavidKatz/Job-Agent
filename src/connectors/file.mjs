import { readJson } from "../io.mjs";
import { normalizeJob } from "./normalize.mjs";

export async function loadFileJobs(source, rootDir, resolveLocal) {
  const filePath = resolveLocal(source.path, rootDir);
  const jobs = await readJson(filePath);
  if (!Array.isArray(jobs)) {
    throw new Error(`File source "${source.id}" must contain a JSON array.`);
  }
  return jobs.map((job) => normalizeJob(job, source, source.fieldMap));
}
