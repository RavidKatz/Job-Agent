import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeJobsWithProfile, loadConfig, loadJobs, loadResumeFromFile, writeAnalysis } from "./src/pipeline.mjs";
import { buildResumeProfile } from "./src/profile.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const defaults = {
    resume: "data/resume.example.txt",
    jobs: "",
    sources: "config/sources.json",
    config: "config/search-profile.json",
    outJson: "outputs/matches.json",
    outCsv: "outputs/matches.csv"
  };

  const args = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (current === "--resume" && next) args.resume = next;
    if (current === "--jobs" && next) args.jobs = next;
    if (current === "--sources" && next) args.sources = next;
    if (current === "--config" && next) args.config = next;
    if (current === "--out-json" && next) args.outJson = next;
    if (current === "--out-csv" && next) args.outCsv = next;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const config = await loadConfig(rootDir, args.config);
const resumeText = await loadResumeFromFile(rootDir, args.resume);
const resumeProfile = buildResumeProfile(resumeText, config);
const sourceResult = await loadJobs(rootDir, {
  jobsPath: args.jobs,
  sourcesPath: args.sources,
  searchTerms: resumeProfile.dynamicSearchTerms
});
const analysis = analyzeJobsWithProfile({
  resumeProfile,
  jobs: sourceResult.jobs,
  config,
  sourceNotices: sourceResult.notices,
  sourceLinks: sourceResult.sourceLinks
});

await writeAnalysis(rootDir, analysis, { outJson: args.outJson, outCsv: args.outCsv });

console.log(`Resume terms: ${analysis.resumeTerms.join(", ") || "none"}`);
console.log(`Suggested roles: ${analysis.resumeProfile.roleRecommendations.map((role) => role.title).join(", ") || "none"}`);
console.log(`Jobs scanned: ${analysis.jobsScanned}`);
console.log(`Matches >= ${analysis.minimumScore}%: ${analysis.matches.length}`);
for (const notice of analysis.sourceNotices) {
  console.log(`Source notice: ${notice}`);
}
for (const link of analysis.sourceLinks) {
  console.log(`Source search: ${link.label} | ${link.url}`);
}
for (const match of analysis.matches) {
  console.log(`${match.matchPercent}% | ${match.company} | ${match.position} | ${match.applyUrl}`);
}
