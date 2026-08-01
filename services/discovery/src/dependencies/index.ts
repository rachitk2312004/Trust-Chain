export type Dependency = {
  from: string;
  to: string;
  kind: "sync" | "async";
};

export function mapDependencies(pairs: [string, string, "sync" | "async"][]): Dependency[] {
  return pairs.map(([from, to, kind]) => ({ from, to, kind }));
}
