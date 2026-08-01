export type CatalogEntry = {
  id: string;
  name: string;
  owner: string;
  tags: string[];
};

const catalog: CatalogEntry[] = [];

export function registerCatalogEntry(
  name: string,
  owner: string,
  tags: string[] = [],
): CatalogEntry {
  const entry: CatalogEntry = {
    id: `CATALOG-${Date.now()}`,
    name,
    owner,
    tags,
  };
  catalog.push(entry);
  return entry;
}

export function listCatalogEntries(): CatalogEntry[] {
  return [...catalog];
}

export function clearCatalog(): void {
  catalog.length = 0;
}
