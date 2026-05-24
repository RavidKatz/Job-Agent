import { getArrayByPath, normalizeJob } from "./normalize.mjs";

function interpolateEnv(value) {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name) => process.env[name] ?? "");
}

function interpolateObject(value) {
  if (Array.isArray(value)) return value.map(interpolateObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, interpolateObject(item)]));
  }
  return interpolateEnv(value);
}

export async function loadJsonApiJobs(source) {
  const url = interpolateEnv(source.url);
  const headers = interpolateObject(source.headers ?? {});
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`API source "${source.id}" failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  const rows = getArrayByPath(payload, source.arrayPath);
  return rows.map((row) => normalizeJob(row, source, source.fieldMap));
}
