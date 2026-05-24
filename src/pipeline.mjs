import { loadJobsFromSources, resolveLocal } from "./connectors/index.mjs";
import { readJson, readText, writeCsv, writeJson } from "./io.mjs";
import { rankJobs } from "./matcher.mjs";
import { buildResumeProfile } from "./profile.mjs";

export async function loadConfig(rootDir, configPath) {
  return readJson(resolveLocal(configPath, rootDir));
}

export async function loadResumeFromFile(rootDir, resumePath) {
  return readText(resolveLocal(resumePath, rootDir));
}

export async function loadJobs(rootDir, { jobsPath = "", sourcesPath = "config/sources.json" } = {}) {
  if (jobsPath) {
    return { jobs: await readJson(resolveLocal(jobsPath, rootDir)), notices: [] };
  }
  return loadJobsFromSources({ rootDir, sourcesPath });
}

export function analyzeJobs({ resumeText, jobs, config, sourceNotices = [] }) {
  const resumeProfile = buildResumeProfile(resumeText, config);
  const ranked = rankJobs(jobs, resumeProfile, config);
  const matches = ranked.filter((job) => job.matchPercent >= config.minimumScore);

  return {
    generatedAt: new Date().toISOString(),
    minimumScore: config.minimumScore,
    jobsScanned: jobs.length,
    resumeTerms: resumeProfile.matchedConfiguredTerms,
    sourceNotices,
    matches
  };
}

export async function writeAnalysis(rootDir, analysis, { outJson, outCsv }) {
  await writeJson(resolveLocal(outJson, rootDir), analysis);
  await writeCsv(resolveLocal(outCsv, rootDir), analysis.matches);
}
