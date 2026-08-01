import type { EnvironmentName } from "../../../shared/types.js";

export type EnvironmentConfig = {
  name: EnvironmentName;
  region: string;
  active: boolean;
};

export function listEnvironments(): EnvironmentConfig[] {
  return [
    { name: "development", region: "local", active: true },
    { name: "staging", region: "us-east-1", active: true },
    { name: "production", region: "us-east-1", active: true },
  ];
}

export function getEnvironment(name: EnvironmentName): EnvironmentConfig | undefined {
  return listEnvironments().find((env) => env.name === name);
}
