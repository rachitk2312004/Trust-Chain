/**
 * HTTP client to FastAPI internal execution API.
 * Express never imports workers/engines — only this client.
 */
import { AppError } from "../../../lib/errors.js";

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

/** In-memory client for unit tests / offline fallback (no model execution). */
export class MemoryAiExecutionClient implements AiExecutionClient {
  private readonly tasks = new Map<string, ExecutionStatusResult & { payload?: unknown }>();

  async submit(input: ExecutionSubmitInput): Promise<ExecutionSubmitResult> {
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

  /** Test helper — mark task completed with a result envelope. */
  complete(taskId: string, result: Record<string, unknown>): void {
    const row = this.tasks.get(taskId);
    if (!row) return;
    this.tasks.set(taskId, {
      ...row,
      status: "completed",
      result: { ...result, advisoryOnly: true },
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
          modelId: "AI-MODEL-STUB0001",
          modelVersion: "MODEL-VERSION-STUB0001",
          capability: "ocr",
          provider: "stub",
          healthStatus: "healthy",
          fallback: ["primary", "secondary", "stub"],
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
        this.complete(id, { text: "memory-execution-stub", capability: row.queue });
        processed += 1;
      }
    }
    return { processed };
  }
}

let client: AiExecutionClient | null = null;

export function getAiExecutionClient(): AiExecutionClient {
  if (client) return client;
  if (process.env.AI_SERVICE_URL?.trim()) {
    client = new HttpAiExecutionClient();
  } else {
    client = new MemoryAiExecutionClient();
  }
  return client;
}

export function setAiExecutionClientForTests(next: AiExecutionClient | null): void {
  client = next;
}

export function executionMode(): "gateway" | "memory" {
  return process.env.AI_SERVICE_URL?.trim() ? "gateway" : "memory";
}
