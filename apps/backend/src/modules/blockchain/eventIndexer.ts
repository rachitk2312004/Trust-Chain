import { prisma, type Prisma } from "@trustchain/database";
import type { Log, EventLog } from "ethers";

export async function upsertBlockchainEvent(input: {
  networkId: string;
  contractAddress: string;
  eventName: string;
  log: Log | EventLog;
  payload?: Prisma.InputJsonValue;
}) {
  const txHash = input.log.transactionHash;
  const logIndex = input.log.index;
  const blockNumber = BigInt(input.log.blockNumber);

  return prisma.blockchainEvent.upsert({
    where: {
      networkId_txHash_logIndex: {
        networkId: input.networkId,
        txHash,
        logIndex,
      },
    },
    create: {
      networkId: input.networkId,
      contractAddress: input.contractAddress.toLowerCase(),
      eventName: input.eventName,
      blockNumber,
      logIndex,
      txHash,
      payload: input.payload ?? undefined,
    },
    update: {
      payload: input.payload ?? undefined,
      processedAt: new Date(),
    },
  });
}

export async function indexReceiptEvents(input: {
  networkId: string;
  contractAddress: string;
  receiptLogs: Array<{
    eventName: string;
    log: Log | EventLog;
    payload?: Prisma.InputJsonValue;
  }>;
}): Promise<number> {
  let count = 0;
  for (const item of input.receiptLogs) {
    await upsertBlockchainEvent({
      networkId: input.networkId,
      contractAddress: input.contractAddress,
      eventName: item.eventName,
      log: item.log,
      payload: item.payload,
    });
    count += 1;
  }
  return count;
}
