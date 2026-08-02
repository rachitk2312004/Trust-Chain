import { getAiExecutionClient, executionMode } from "./executionClient.js";
import { AI_ADVISORY_DISCLAIMER } from "../utils/guards.js";

export async function getAiGatewayHealth() {
  const client = getAiExecutionClient();
  let remote: Awaited<ReturnType<typeof client.health>>;
  try {
    remote = await client.health();
  } catch {
    remote = {
      status: "unavailable",
      queues: null,
      adapters: null,
      leases: null,
      advisoryOnly: true,
    };
  }

  return {
    status: remote.status ?? "unknown",
    mode: executionMode(),
    queueStatus: remote.queues ?? null,
    workerStatus: remote.execution ?? null,
    adapterStatus: remote.adapters ?? null,
    leaseStatus: remote.leases ?? null,
    executionMetrics: {
      mode: executionMode(),
      advisoryOnly: true,
    },
    advisoryOnly: true,
    disclaimer: AI_ADVISORY_DISCLAIMER,
  };
}

export async function listAiModels() {
  const client = getAiExecutionClient();
  try {
    const remote = await client.models();
    return {
      models: remote.models,
      advisoryOnly: true,
      disclaimer: AI_ADVISORY_DISCLAIMER,
    };
  } catch {
    return {
      models: [
        {
          modelId: "AI-MODEL-STUB0001",
          modelVersion: "MODEL-VERSION-STUB0001",
          capability: "ocr",
          provider: "stub",
          healthStatus: "degraded",
          fallback: ["primary", "secondary", "stub"],
        },
      ],
      advisoryOnly: true,
      disclaimer: AI_ADVISORY_DISCLAIMER,
    };
  }
}
