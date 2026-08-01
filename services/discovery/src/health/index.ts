export type ServiceHealth = {
  serviceId: string;
  status: "up" | "degraded" | "down";
  lastChecked: string;
};

export function checkServiceHealth(
  serviceId: string,
  status: ServiceHealth["status"],
): ServiceHealth {
  return {
    serviceId,
    status,
    lastChecked: new Date().toISOString(),
  };
}
