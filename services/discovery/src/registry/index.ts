export type RegisteredService = {
  id: string;
  name: string;
  version: string;
  endpoint: string;
};

const registry: RegisteredService[] = [];

export function registerService(
  name: string,
  version: string,
  endpoint: string,
): RegisteredService {
  const service: RegisteredService = {
    id: `SVC-${Date.now()}`,
    name,
    version,
    endpoint,
  };
  registry.push(service);
  return service;
}

export function listRegisteredServices(): RegisteredService[] {
  return [...registry];
}

export function clearRegistry(): void {
  registry.length = 0;
}
