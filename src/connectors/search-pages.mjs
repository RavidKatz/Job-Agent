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
  const directLinks = buildDirectSourceLinks(source);

  const searchLinks = terms.slice(0, maxQueries).map((term) => ({
    sourceId: source.id,
    sourceName: source.name ?? source.id,
    label: `${source.name ?? source.id}: ${term}`,
    query: term,
    url: buildUrl(source.urlTemplate, term)
  }));

  return [...directLinks, ...searchLinks];
}

export function buildDirectSourceLinks(source) {
  return (source.directLinks ?? []).map((link) => ({
    sourceId: source.id,
    sourceName: source.name ?? source.id,
    label: link.label ?? `${source.name ?? source.id}: curated search`,
    query: link.query ?? "",
    url: link.url
  })).filter((link) => link.url);
}
