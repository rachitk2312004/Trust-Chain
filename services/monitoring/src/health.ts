export type HealthComponent = {
  name: string;
  status: "up" | "degraded" | "down";
  latencyMs?: number;
};

export type HealthSnapshot = {
  generatedAt: string;
  overall: "healthy" | "degraded" | "unhealthy";
  components: HealthComponent[];
};

export function buildHealthSnapshot(
  components: HealthComponent[] = [
    { name: "api", status: "up", latencyMs: 42 },
    { name: "database", status: "up", latencyMs: 18 },
    { name: "storage", status: "degraded", latencyMs: 210 },
  ],
): HealthSnapshot {
  const hasDown = components.some((component) => component.status === "down");
  const hasDegraded = components.some((component) => component.status === "degraded");

  return {
    generatedAt: new Date().toISOString(),
    overall: hasDown ? "unhealthy" : hasDegraded ? "degraded" : "healthy",
    components,
  };
}
