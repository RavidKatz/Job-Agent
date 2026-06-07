import { assessJobQuality } from "./connectors/job-model.mjs";
import { loadJobsFromSources, resolveLocal } from "./connectors/index.mjs";
import { readJson, readText, writeCsv, writeJson } from "./io.mjs";
import { rankJobs } from "./matcher.mjs";
import { buildResumeProfile, toPublicResumeProfile } from "./profile.mjs";
import { inferJobFamily } from "./role-recommender.mjs";
import { normalizeText, tokenize } from "./text.mjs";

// ---------------------------------------------------------------------------
// Soft relevance gate (Phase 5A)
//
// After scoring, this gate prevents obviously off-target jobs from appearing
// in nearMatches. It does NOT touch jobs that already passed the threshold.
// If there is no signal to gate on (no target role, no search terms, no profile
// direction), everything passes — the gate only activates when there is a clear
// candidate direction to compare against.
// ---------------------------------------------------------------------------

// Maps role-family IDs (from inferJobFamily) to direction IDs.
// Kept local to pipeline.mjs to avoid coupling; mirrors FAMILY_TO_DIRECTION in job-fit.mjs.
const FAMILY_DIRECTION_MAP = {
  "ai-solutions":           "ai-ops",
  "project-coordination":   "pmo",
  "data-business-analysis": "data-bi",
  "implementation-erp":     "implementation",
  "digital-projects":       "product-ops",
  "operations":             "operations",
  "product-operations":     "product-ops",
  "software-development":   "engineering",
  "finance-accounting":     "finance",
  "hr-recruiting":          "hr-recruiting",
  "sales-customer-service": "sales",
  "marketing-content":      "marketing",
  "logistics-supply-chain": "logistics",
  "administration-office":  "admin",
  "design":                 "design",
  "legal":                  "legal"
};

// Tokens that are too generic to serve as relevance signals on their own
// (e.g. "manager" matches both "Marketing Manager" and "Project Manager").
const BROAD_GATE_TOKENS = new Set([
  "manager", "coordinator", "specialist", "analyst", "officer", "director",
  "lead", "head", "senior", "junior", "associate", "assistant", "intern",
  "staff", "team", "role", "professional", "expert"
]);

// Build the gate state: candidate direction set + key token set.
export function buildGateState(resumeProfile) {
  // 1. Build the candidate's allowed directions.
  const candidateDirections = new Set(resumeProfile.education?.directions ?? []);
  for (const rec of (resumeProfile.roleRecommendations ?? []).slice(0, 5)) {
    const dir = FAMILY_DIRECTION_MAP[rec.id];
    if (dir) candidateDirections.add(dir);
  }
  // If a target role is given, also infer its direction.
  if (resumeProfile.targetRoleInput) {
    const fam = inferJobFamily(resumeProfile.targetRoleInput);
    const dir = FAMILY_DIRECTION_MAP[fam ?? ""];
    if (dir) candidateDirections.add(dir);
  }

  // 2. Build the key token set from targetRoleInput + top search terms.
  const sourceTerms = [
    resumeProfile.targetRoleInput,
    ...(resumeProfile.dynamicSearchTerms ?? []).slice(0, 8)
  ].filter(Boolean);

  const tokenSet = new Set(
    sourceTerms
      .flatMap((term) => tokenize(normalizeText(term)))
      .filter((t) => t.length > 3 && !BROAD_GATE_TOKENS.has(t))
  );

  return { candidateDirections, tokenSet };
}

// Returns true if the scored job is plausibly on-target for this candidate.
// Uses already-computed matcher fields — no additional API or scoring calls.
export function isJobOnTarget(scoredJob, gateState) {
  const { candidateDirections, tokenSet } = gateState;

  // No signal → gate is inactive, let everything through.
  if (candidateDirections.size === 0 && tokenSet.size === 0) return true;

  // 1. Direction match: use the direction the matcher already computed.
  const jobDir = scoredJob.matchBreakdown?.jobDirection;
  if (jobDir && jobDir !== "general" && candidateDirections.has(jobDir)) return true;

  // 2. Title token overlap with the candidate's key terms.
  if (tokenSet.size > 0) {
    const titleTokens = tokenize(normalizeText(scoredJob.position ?? ""));
    if (titleTokens.some((t) => tokenSet.has(t))) return true;
  }

  return false;
}

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

function buildDiagnostics({ ranked, jobsScanned, threshold, resumeProfile, jobsWithQuality, sourceNotices, belowThreshold, offTargetHidden = 0 }) {
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
    topFailureReasons: aggregateFailureReasons(belowThreshold),
    offTargetHidden
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

  // Apply the soft relevance gate to jobs below the threshold.
  // Jobs that already passed the threshold are never touched.
  const gateState = buildGateState(resumeProfile);
  const relevantBelowThreshold = belowThreshold.filter((job) => isJobOnTarget(job, gateState));
  const offTargetHidden = belowThreshold.length - relevantBelowThreshold.length;

  // When nothing passes, surface the closest relevant jobs below the threshold
  // so the user gets an honest result instead of an empty dead end. Kept
  // separate from real matches and never counted as passing.
  const nearMatches = matches.length
    ? []
    : relevantBelowThreshold
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
    belowThreshold,
    offTargetHidden
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
