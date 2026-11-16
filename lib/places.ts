export const GOTHENBURG_CENTRAL_ID = "se-gbg-gothenburg-central-station";

export const GOTHENBURG_CENTRAL = {
  id: GOTHENBURG_CENTRAL_ID,
  label: "Göteborg Centralstation, Drottningtorget 5, 411 03 Göteborg",
  primary: "Göteborg Centralstation",
  secondary: "Drottningtorget 5, 411 03 Göteborg",
  lat: 57.7089,
  lng: 11.9733,
  kind: "address",
  placeType: "transport",
} as const;

const normalize = (value: string) => value
  .toLocaleLowerCase("sv")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const CENTRAL_ALIASES = [
  "Göteborg Centralstation",
  "Göteborg C",
  "Göteborg Central",
  "Centralstationen Göteborg",
  "Centralstationen",
  "Centralst",
];

export function isGothenburgCentralSearch(value: string) {
  const query = normalize(value);
  if (query.length < 2) return false;
  return CENTRAL_ALIASES.some((alias) => {
    const normalizedAlias = normalize(alias);
    return normalizedAlias.startsWith(query) || normalizedAlias.includes(` ${query}`) || query.startsWith(normalizedAlias);
  });
}
