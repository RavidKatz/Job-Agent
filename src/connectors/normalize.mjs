function readPath(value, pathExpression) {
  if (!pathExpression) return undefined;
  return String(pathExpression)
    .split(".")
    .reduce((current, key) => {
      if (current == null) return undefined;
      return current[key];
    }, value);
}

function readMappedValue(raw, mapping) {
  if (Array.isArray(mapping)) {
    return mapping
      .map((item) => readPath(raw, item))
      .filter((item) => item != null && String(item).trim() !== "")
      .join("\n");
  }
  return readPath(raw, mapping);
}

export function normalizeJob(raw, source, fieldMap = {}) {
  const get = (targetField, fallbackFields) => {
    if (fieldMap[targetField]) {
      return readMappedValue(raw, fieldMap[targetField]);
    }

    for (const fallback of fallbackFields) {
      const value = readPath(raw, fallback);
      if (value != null && String(value).trim() !== "") return value;
    }
    return "";
  };

  return {
    company: get("company", ["company", "companyName", "employer", "organization.name"]),
    title: get("title", ["title", "position", "name", "jobTitle"]),
    location: get("location", ["location", "city", "workplace", "address"]),
    workMode: get("workMode", ["workMode", "remote", "workplaceType"]),
    source: source.name ?? source.id,
    applyUrl: get("applyUrl", ["applyUrl", "url", "link", "applicationUrl"]),
    postedAt: get("postedAt", ["postedAt", "publishedAt", "createdAt", "date"]),
    description: get("description", ["description", "body", "requirements", "summary"]),
    tags: raw.tags ?? raw.keywords ?? []
  };
}

export function getArrayByPath(payload, arrayPath) {
  if (!arrayPath) return Array.isArray(payload) ? payload : [];
  const value = readPath(payload, arrayPath);
  return Array.isArray(value) ? value : [];
}
