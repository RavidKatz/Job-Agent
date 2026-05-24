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
  const normalizedHaystack = ` ${normalizeText(haystack)} `;
  const normalizedPhrase = ` ${normalizeText(phrase)} `;
  return normalizedPhrase.trim().length > 0 && normalizedHaystack.includes(normalizedPhrase);
}

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
