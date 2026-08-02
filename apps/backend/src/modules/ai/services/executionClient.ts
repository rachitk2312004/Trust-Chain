/**
 * HTTP client to FastAPI internal execution API.
 * Express never imports workers/engines — only this client.
 */
import { AppError } from "../../../lib/errors.js";
import {
  allowMemoryExecutionClient,
  isAiProductionMode,
  requireGatewayOrThrow,
} from "../utils/aiRuntime.js";

export type ExecutionSubmitInput = {
  capability: string;
  payload: Record<string, unknown>;
  organizationId?: string;
  documentId?: string;
  legacyJobPublicCode?: string;
  taskId?: string;
  maxAttempts?: number;
  timeoutMs?: number;
};

export type ExecutionSubmitResult = {
  taskId: string;
  queue: string;
  status: string;
  legacyJobPublicCode?: string | null;
  advisoryOnly: boolean;
};

export type ExecutionStatusResult = {
  taskId: string;
  status: string;
  queue?: string;
  attempt?: string;
  legacyJobPublicCode?: string | null;
  error?: string;
  result?: unknown;
  advisoryOnly?: boolean;
};

export type ExecutionHealthResult = {
  status: string;
  queues?: unknown;
  adapters?: unknown;
  execution?: unknown;
  leases?: unknown;
  advisoryOnly?: boolean;
};

export type ExecutionModelsResult = {
  models: Array<{
    modelId: string;
    modelVersion: string;
    capability: string;
    provider: string;
    healthStatus: string;
    fallback: string[];
    advisoryOnly?: boolean;
  }>;
  advisoryOnly?: boolean;
};

export interface AiExecutionClient {
  submit(input: ExecutionSubmitInput): Promise<ExecutionSubmitResult>;
  status(taskId: string): Promise<ExecutionStatusResult>;
  health(): Promise<ExecutionHealthResult>;
  models(): Promise<ExecutionModelsResult>;
  drain(capabilities?: string[]): Promise<{ processed: number; health?: unknown }>;
}

function baseUrl(): string | null {
  const url = process.env.AI_SERVICE_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function authHeaders(): Record<string, string> {
  const token = process.env.AI_SERVICE_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const root = baseUrl();
  if (!root) {
    throw new AppError(503, "AI_SERVICE_UNAVAILABLE", "AI_SERVICE_URL is not configured");
  }
  if (isAiProductionMode() && !process.env.AI_SERVICE_TOKEN?.trim()) {
    throw new AppError(503, "AI_SERVICE_UNAVAILABLE", "AI_SERVICE_TOKEN is required in production");
  }
  const response = await fetch(`${root}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AppError(502, "AI_EXECUTION_ERROR", `AI execution call failed: ${response.status}`, {
      path,
      body: text.slice(0, 500),
    });
  }
  return (await response.json()) as T;
}

export class HttpAiExecutionClient implements AiExecutionClient {
  async submit(input: ExecutionSubmitInput): Promise<ExecutionSubmitResult> {
    return requestJson("/internal/execution/submit", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async status(taskId: string): Promise<ExecutionStatusResult> {
    return requestJson(`/internal/execution/tasks/${encodeURIComponent(taskId)}`);
  }

  async health(): Promise<ExecutionHealthResult> {
    return requestJson("/internal/execution/health");
  }

  async models(): Promise<ExecutionModelsResult> {
    return requestJson("/internal/execution/models");
  }

  async drain(capabilities?: string[]): Promise<{ processed: number; health?: unknown }> {
    return requestJson("/internal/execution/drain", {
      method: "POST",
      body: JSON.stringify({ capabilities, maxRounds: 50 }),
    });
  }
}

/**
 * Memory client — CI / unit tests / local only.
 * Forbidden when AI production mode is active.
 */
export class MemoryAiExecutionClient implements AiExecutionClient {
  private readonly tasks = new Map<string, ExecutionStatusResult & { payload?: unknown }>();

  async submit(input: ExecutionSubmitInput): Promise<ExecutionSubmitResult> {
    if (isAiProductionMode()) {
      throw new AppError(
        503,
        "AI_MEMORY_CLIENT_FORBIDDEN",
        "Memory AI execution client is forbidden in production",
      );
    }
    const taskId = input.taskId ?? `AI-TASK-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
    this.tasks.set(taskId, {
      taskId,
      status: "pending",
      queue: input.capability,
      legacyJobPublicCode: input.legacyJobPublicCode,
      advisoryOnly: true,
      payload: input.payload,
    });
    return {
      taskId,
      queue: input.capability,
      status: "pending",
      legacyJobPublicCode: input.legacyJobPublicCode,
      advisoryOnly: true,
    };
  }

  async status(taskId: string): Promise<ExecutionStatusResult> {
    const row = this.tasks.get(taskId);
    if (!row) return { taskId, status: "unknown", advisoryOnly: true };
    return row;
  }

  complete(taskId: string, result: Record<string, unknown>): void {
    const row = this.tasks.get(taskId);
    if (!row) return;
    this.tasks.set(taskId, {
      ...row,
      status: "completed",
      result: {
        advisoryOnly: true,
        modelId: "AI-MODEL-MEMORY01",
        modelVersion: "MODEL-VERSION-MEMORY01",
        executionTimeMs: 1,
        lineageId: "LINEAGE-MEMORY01",
        confidence: 0.7,
        ...result,
      },
    });
  }

  async health(): Promise<ExecutionHealthResult> {
    return {
      status: "ok",
      queues: { ok: true, backend: "MemoryAiExecutionClient" },
      adapters: {},
      leases: {},
      advisoryOnly: true,
    };
  }

  async models(): Promise<ExecutionModelsResult> {
    return {
      models: [
        {
          modelId: "AI-MODEL-MEMORY01",
          modelVersion: "MODEL-VERSION-MEMORY01",
          capability: "ocr",
          provider: "local",
          healthStatus: "healthy",
          fallback: ["primary", "secondary"],
          advisoryOnly: true,
        },
      ],
      advisoryOnly: true,
    };
  }

  async drain(capabilities?: string[]): Promise<{ processed: number }> {
    void capabilities;
    let processed = 0;
    for (const [id, row] of this.tasks) {
      if (row.status === "pending") {
        const capability = row.queue ?? "ocr";
        this.complete(id, {
          text: typeof (row.payload as { text?: string })?.text === "string"
            ? (row.payload as { text: string }).text
            : `gateway-memory:${capability}`,
          capability,
          chunks: ["chunk-0"],
          embeddings: [[0.1, 0.2, 0.3]],
          label: "other",
          riskScore: 0.1,
          signalsJson: {},
        });
        processed += 1;
      }
    }
    return { processed };
  }
}

let client: AiExecutionClient | null = null;

export function getAiExecutionClient(): AiExecutionClient {
  if (client) return client;
  requireGatewayOrThrow();
  if (process.env.AI_SERVICE_URL?.trim()) {
    client = new HttpAiExecutionClient();
  } else if (allowMemoryExecutionClient()) {
    client = new MemoryAiExecutionClient();
  } else {
    throw new AppError(503, "AI_SERVICE_UNAVAILABLE", "AI_SERVICE_URL is required");
  }
  return client;
}

export function setAiExecutionClientForTests(next: AiExecutionClient | null): void {
  client = next;
}

export function executionMode(): "gateway" | "memory" {
  return process.env.AI_SERVICE_URL?.trim() ? "gateway" : "memory";
}
