import { assessJobQuality } from "./connectors/job-model.mjs";
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

export async function loadJobs(rootDir, { jobsPath = "", sourcesPath = "config/sources.json", searchTerms = [], sourceIds = [] } = {}) {
  if (jobsPath) {
    return { jobs: await readJson(resolveLocal(jobsPath, rootDir)), notices: [], sourceLinks: [] };
  }
  return loadJobsFromSources({ rootDir, sourcesPath, searchTerms, sourceIds });
}

export function analyzeJobs({ resumeText, jobs, config, sourceNotices = [], sourceLinks = [] }) {
  const resumeProfile = buildResumeProfile(resumeText, config);
  return analyzeJobsWithProfile({ resumeProfile, jobs, config, sourceNotices, sourceLinks });
}

const NEAR_MATCH_LIMIT = 5;

// A short, honest reason why a job did not pass the threshold (in Hebrew).
function buildNearMatchReason(job, threshold) {
  const gap = Math.max(0, threshold - job.matchPercent);
  const detail = job.mainGap
    || job.fitAnalysis?.whatsMissing
    || (job.warnings ? String(job.warnings).split(" | ")[0] : "")
    || "";
  return `נמוך ב-${gap} נק' מהסף שנבחר. ${detail}`.trim();
}

// Tallies the most common blocking reasons across jobs that did not pass.
function aggregateFailureReasons(jobs) {
  const counts = new Map();
  for (const job of jobs) {
    const reasons = String(job.warnings ?? "")
      .split(" | ")
      .map((reason) => reason.trim())
      .filter(Boolean);
    for (const reason of reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

// Collects source-level notices and low-quality warnings worth surfacing.
function collectSourceWarnings(jobs, sourceNotices) {
  const warnings = new Set(sourceNotices ?? []);
  for (const job of jobs) {
    const quality = job?.quality;
    if (quality && (quality.dataQualityScore < 60 || quality.isSearchShortcut)) {
      for (const warning of quality.qualityWarnings ?? []) warnings.add(warning);
    }
  }
  return [...warnings].slice(0, 8);
}

function buildDiagnostics({ ranked, jobsScanned, threshold, resumeProfile, jobsWithQuality, sourceNotices, belowThreshold }) {
  const scores = ranked.map((job) => job.matchPercent);
  const highestScore = scores.length ? Math.max(...scores) : 0;
  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : 0;

  return {
    jobsScanned,
    jobsScored: ranked.length,
    threshold,
    highestScore,
    averageScore,
    detectedProfile: {
      latestRole: resumeProfile.lastRole?.title ?? resumeProfile.latestRole ?? null,
      educationField: resumeProfile.education?.field ?? null,
      seniority: resumeProfile.seniority ?? null,
      yearsExperience: resumeProfile.yearsExperience ?? null,
      topDirection: resumeProfile.roleRecommendations?.[0]?.title ?? null
    },
    searchTerms: resumeProfile.dynamicSearchTerms ?? [],
    sourceWarnings: collectSourceWarnings(jobsWithQuality, sourceNotices),
    topFailureReasons: aggregateFailureReasons(belowThreshold)
  };
}

export function analyzeJobsWithProfile({ resumeProfile, jobs, config, sourceNotices = [], sourceLinks = [] }) {
  const effectiveConfig = {
    ...config,
    targetRoles: [
      ...(config.targetRoles ?? []),
      ...(resumeProfile.dynamicSearchTerms ?? [])
    ]
  };
  // Ensure every job carries a quality assessment, including jobs uploaded
  // directly (which bypass the source-loading normalization).
  const jobsWithQuality = jobs.map((job) => job?.quality ? job : { ...job, quality: assessJobQuality(job ?? {}, {}) });

  // Score every scanned job. The threshold only filters the final shortlist;
  // scoring never stops, so we can still surface near matches and diagnostics.
  const ranked = rankJobs(jobsWithQuality, resumeProfile, effectiveConfig);
  const threshold = effectiveConfig.minimumScore;
  const matches = ranked.filter((job) => job.matchPercent >= threshold);
  const belowThreshold = ranked.filter((job) => job.matchPercent < threshold);

  // When nothing passes, surface the closest jobs below the threshold so the
  // user gets an honest result instead of an empty dead end. Kept separate from
  // real matches and never counted as passing.
  const nearMatches = matches.length
    ? []
    : belowThreshold
        .filter((job) => job.quality?.isRealJob !== false)
        .slice(0, NEAR_MATCH_LIMIT)
        .map((job) => ({
          ...job,
          reason: buildNearMatchReason(job, threshold)
        }));

  const diagnostics = buildDiagnostics({
    ranked,
    jobsScanned: jobs.length,
    threshold,
    resumeProfile,
    jobsWithQuality,
    sourceNotices,
    belowThreshold
  });

  return {
    generatedAt: new Date().toISOString(),
    minimumScore: threshold,
    jobsScanned: jobs.length,
    resumeTerms: resumeProfile.matchedConfiguredTerms,
    resumeProfile: toPublicResumeProfile(resumeProfile),
    sourceNotices,
    sourceLinks,
    matches,
    nearMatches,
    diagnostics
  };
}

export async function writeAnalysis(rootDir, analysis, { outJson, outCsv }) {
  await writeJson(resolveLocal(outJson, rootDir), analysis);
  await writeCsv(resolveLocal(outCsv, rootDir), analysis.matches);
}
