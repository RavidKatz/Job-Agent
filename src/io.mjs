import fs from "node:fs/promises";
import path from "node:path";

export async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

export async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

export async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function writeCsv(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `\uFEFF${toCsv(rows)}`, "utf8");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows) {
  const headers = [
    "Company",
    "Role",
    "Category",
    "Fit %",
    "Priority",
    "Status",
    "Source",
    "Location",
    "Work Model",
    "Main Fit",
    "Main Gap",
    "Recommended Action",
    "Notes",
    "Apply Link",
    "Posted At",
    "Confidence",
    "Requirement Coverage",
    "Experience Fit",
    "Warnings",
    "Must-have Fit",
    "Role Substance Fit",
    "Career Direction Fit",
    "Market Competitiveness"
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push([
      row.company,
      row.position,
      row.category,
      `${row.matchPercent}%`,
      row.priority,
      row.status,
      row.source || row.appliedVia,
      row.location,
      row.workModel,
      row.mainFit,
      row.mainGap,
      row.recommendedAction,
      row.notes,
      row.applyUrl,
      row.postedAt,
      row.fitAnalysis?.confidence,
      row.fitAnalysis?.requirementCoverage,
      row.fitAnalysis?.experienceFit,
      row.warnings,
      row.matchBreakdown?.mustHaveFit,
      row.matchBreakdown?.roleSubstanceFit,
      row.matchBreakdown?.careerDirectionFit,
      row.matchBreakdown?.marketCompetitiveness
    ].map(escapeCsv).join(","));
  }
  return `${lines.join("\n")}\n`;
}
