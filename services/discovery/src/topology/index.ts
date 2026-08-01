export type TopologyNode = {
  id: string;
  type: "service" | "database" | "queue";
  connections: string[];
};

export function buildTopology(nodes: TopologyNode[]): TopologyNode[] {
  return nodes;
}

export function defaultTopology(): TopologyNode[] {
  return [
    { id: "api", type: "service", connections: ["database", "queue"] },
    { id: "database", type: "database", connections: [] },
    { id: "queue", type: "queue", connections: [] },
  ];
}
