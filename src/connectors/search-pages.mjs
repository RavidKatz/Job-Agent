import { normalizeTerms } from "./http.mjs";

function buildUrl(template, term) {
  const encoded = encodeURIComponent(term);
  return template
    .replaceAll("{query}", term)
    .replaceAll("{queryEncoded}", encoded);
}

export function buildSearchPageLinks(source) {
  const terms = normalizeTerms(source.searchTerms ?? []);
  const maxQueries = source.maxQueries ?? 4;

  return terms.slice(0, maxQueries).map((term) => ({
    sourceId: source.id,
    sourceName: source.name ?? source.id,
    label: `${source.name ?? source.id}: ${term}`,
    query: term,
    url: buildUrl(source.urlTemplate, term)
  }));
}
