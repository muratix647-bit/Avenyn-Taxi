// Tab-local only: never persist a customer's address searches on the device.
const entries = new Map<string, { expires: number; places: any[] }>();
const keyOf = (q: string) => q.trim().toLocaleLowerCase("sv").replace(/\s+/g, " ");
export function cachedAddresses(q: string): any[] | undefined {
  const key = keyOf(q), item = entries.get(key);
  if (!item) return undefined;
  if (item.expires <= Date.now()) { entries.delete(key); return undefined; }
  return item.places;
}
export function rememberAddresses(q: string, places: any[]) {
  if (!places.length) return;
  entries.set(keyOf(q), { expires: Date.now() + 5 * 60_000, places });
  if (entries.size > 80) entries.delete(entries.keys().next().value!);
}
export function matchingCachedAddresses(q: string): any[] {
  const query = keyOf(q);
  if (query.length < 2) return [];
  const seen = new Set<string>(), hits: any[] = [];
  for (const item of entries.values()) {
    if (item.expires <= Date.now()) continue;
    for (const p of item.places) {
      const id = p.id || p.label;
      if (!seen.has(id) && keyOf(p.primary || p.label).startsWith(query)) {
        seen.add(id); hits.push(p);
      }
    }
  }
  return hits.slice(0, 10);
}
