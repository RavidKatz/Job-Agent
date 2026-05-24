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
    "Position",
    "Estimated Match (%)",
    "Status",
    "Applied Via",
    "Apply Link",
    "Location",
    "Posted At",
    "Notes",
    "Warnings"
  ];

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push([
      row.company,
      row.position,
      `${row.matchPercent}%`,
      row.status,
      row.appliedVia,
      row.applyUrl,
      row.location,
      row.postedAt,
      row.notes,
      row.warnings
    ].map(escapeCsv).join(","));
  }
  return `${lines.join("\n")}\n`;
}
