import { BlockchainRetryJobStatuses } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";

export type EnqueueRetryInput = {
  networkId: string;
  organizationId?: string;
  operation: string;
  referenceType: string;
  referenceId: string;
  payload?: Prisma.InputJsonValue;
  maxAttempts?: number;
  delayMs?: number;
};

export interface BlockchainJobQueue {
  enqueue(input: EnqueueRetryInput): Promise<{ id: string }>;
  claimDue(limit: number): Promise<
    Array<{
      id: string;
      networkId: string;
      organizationId: string | null;
      operation: string;
      referenceType: string;
      referenceId: string;
      payload: Prisma.JsonValue;
      attempts: number;
      maxAttempts: number;
    }>
  >;
  complete(id: string): Promise<void>;
  fail(id: string, error: string, retry: boolean): Promise<void>;
}

function backoffMs(attempts: number): number {
  const base = 30_000;
  return Math.min(base * 2 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}

/** Postgres-backed queue (Redis optional later; never permanent in Redis). */
export class PostgresBlockchainJobQueue implements BlockchainJobQueue {
  async enqueue(input: EnqueueRetryInput): Promise<{ id: string }> {
    const job = await prisma.blockchainRetryJob.create({
      data: {
        networkId: input.networkId,
        organizationId: input.organizationId,
        operation: input.operation,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        payload: input.payload ?? undefined,
        status: BlockchainRetryJobStatuses.queued,
        maxAttempts: input.maxAttempts ?? 8,
        nextRunAt: new Date(Date.now() + (input.delayMs ?? 0)),
      },
    });
    return { id: job.id };
  }

  async claimDue(limit: number) {
    const now = new Date();
    const due = await prisma.blockchainRetryJob.findMany({
      where: {
        status: BlockchainRetryJobStatuses.queued,
        nextRunAt: { lte: now },
      },
      orderBy: { nextRunAt: "asc" },
      take: limit,
    });

    const claimed = [];
    for (const job of due) {
      const updated = await prisma.blockchainRetryJob.updateMany({
        where: { id: job.id, status: BlockchainRetryJobStatuses.queued },
        data: {
          status: BlockchainRetryJobStatuses.running,
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });
      if (updated.count === 1) {
        const fresh = await prisma.blockchainRetryJob.findUniqueOrThrow({
          where: { id: job.id },
        });
        claimed.push({
          id: fresh.id,
          networkId: fresh.networkId,
          organizationId: fresh.organizationId,
          operation: fresh.operation,
          referenceType: fresh.referenceType,
          referenceId: fresh.referenceId,
          payload: fresh.payload,
          attempts: fresh.attempts,
          maxAttempts: fresh.maxAttempts,
        });
      }
    }
    return claimed;
  }

  async complete(id: string): Promise<void> {
    await prisma.blockchainRetryJob.update({
      where: { id },
      data: {
        status: BlockchainRetryJobStatuses.succeeded,
        lockedAt: null,
        lastError: null,
      },
    });
  }

  async fail(id: string, error: string, retry: boolean): Promise<void> {
    const job = await prisma.blockchainRetryJob.findUniqueOrThrow({ where: { id } });
    if (!retry || job.attempts >= job.maxAttempts) {
      await prisma.blockchainRetryJob.update({
        where: { id },
        data: {
          status: BlockchainRetryJobStatuses.dead,
          lastError: error.slice(0, 2000),
          lockedAt: null,
        },
      });
      return;
    }

    await prisma.blockchainRetryJob.update({
      where: { id },
      data: {
        status: BlockchainRetryJobStatuses.queued,
        lastError: error.slice(0, 2000),
        lockedAt: null,
        nextRunAt: new Date(Date.now() + backoffMs(job.attempts)),
      },
    });
  }
}

export const blockchainJobQueue: BlockchainJobQueue = new PostgresBlockchainJobQueue();
