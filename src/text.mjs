const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "you",
  "your",
  "role",
  "will",
  "are",
  "our",
  "של",
  "על",
  "עם",
  "או",
  "את",
  "זה",
  "זו",
  "לפי",
  "יש",
  "גם"
]);

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/[^\p{L}\p{N}#+./\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

export function includesPhrase(haystack, phrase) {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  // Match on word boundaries so a term still matches when it is adjacent to
  // punctuation kept by normalizeText (e.g. "javascript." or "sql,"). Any
  // non-letter/non-digit counts as a boundary, while terms that legitimately
  // contain "." "#" "+" "/" "-" (node.js, c#, ci/cd) are matched literally.
  const escaped = normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "u");
  return pattern.test(normalizedHaystack);
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
