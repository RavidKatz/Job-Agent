import { loadJobsFromSources, resolveLocal } from "./connectors/index.mjs";
import { readJson, readText, writeCsv, writeJson } from "./io.mjs";
import { rankJobs } from "./matcher.mjs";
import { buildResumeProfile, toPublicResumeProfile } from "./profile.mjs";

export async function loadConfig(rootDir, configPath) {
  return readJson(resolveLocal(configPath, rootDir));
}

export async function loadResumeFromFile(rootDir, resumePath) {
  return readText(resolveLocal(resumePath, rootDir));
}

export async function loadJobs(rootDir, { jobsPath = "", sourcesPath = "config/sources.json", searchTerms = [] } = {}) {
  if (jobsPath) {
    return { jobs: await readJson(resolveLocal(jobsPath, rootDir)), notices: [], sourceLinks: [] };
  }
  return loadJobsFromSources({ rootDir, sourcesPath, searchTerms });
}

export function analyzeJobs({ resumeText, jobs, config, sourceNotices = [], sourceLinks = [] }) {
  const resumeProfile = buildResumeProfile(resumeText, config);
  return analyzeJobsWithProfile({ resumeProfile, jobs, config, sourceNotices, sourceLinks });
}

export function analyzeJobsWithProfile({ resumeProfile, jobs, config, sourceNotices = [], sourceLinks = [] }) {
  const effectiveConfig = {
    ...config,
    targetRoles: [
      ...(config.targetRoles ?? []),
      ...(resumeProfile.dynamicSearchTerms ?? [])
    ]
  };
  const ranked = rankJobs(jobs, resumeProfile, effectiveConfig);
  const matches = ranked.filter((job) => job.matchPercent >= effectiveConfig.minimumScore);

  return {
    generatedAt: new Date().toISOString(),
    minimumScore: effectiveConfig.minimumScore,
    jobsScanned: jobs.length,
    resumeTerms: resumeProfile.matchedConfiguredTerms,
    resumeProfile: toPublicResumeProfile(resumeProfile),
    sourceNotices,
    sourceLinks,
    matches
  };
}

export async function writeAnalysis(rootDir, analysis, { outJson, outCsv }) {
  await writeJson(resolveLocal(outJson, rootDir), analysis);
  await writeCsv(resolveLocal(outCsv, rootDir), analysis.matches);
}
