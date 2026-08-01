import { BlockchainTxStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import type { ContractTransactionResponse, TransactionReceipt } from "ethers";
import { AppError } from "../../lib/errors.js";
import { getConfirmationsRequired } from "./chainConfig.js";
import { getRelayerWallet } from "./chainProvider.js";

export type CreateTxInput = {
  networkId: string;
  organizationId?: string;
  documentId?: string;
  documentVersionId?: string;
  operation: string;
  toAddress: string;
};

export async function createPendingTransaction(input: CreateTxInput) {
  const wallet = await getRelayerWallet();
  return prisma.blockchainTransaction.create({
    data: {
      networkId: input.networkId,
      organizationId: input.organizationId,
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      operation: input.operation,
      fromAddress: wallet.address,
      toAddress: input.toAddress,
      status: BlockchainTxStatuses.pending,
    },
  });
}

export async function markTransactionSubmitted(
  txId: string,
  response: ContractTransactionResponse,
) {
  return prisma.blockchainTransaction.update({
    where: { id: txId },
    data: {
      txHash: response.hash,
      nonce: response.nonce,
      status: BlockchainTxStatuses.submitted,
      submittedAt: new Date(),
      gasLimit: response.gasLimit ? BigInt(response.gasLimit.toString()) : null,
      maxFeePerGas: response.maxFeePerGas ? BigInt(response.maxFeePerGas.toString()) : null,
    },
  });
}

export async function markTransactionFailed(txId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return prisma.blockchainTransaction.update({
    where: { id: txId },
    data: {
      status: BlockchainTxStatuses.failed,
      error: message.slice(0, 2000),
    },
  });
}

export type ConfirmedBlockMeta = {
  blockNumber: bigint;
  blockHash: string;
  transactionIndex: number;
  confirmationCount: number;
  gasUsed?: bigint;
};

export async function waitForTransactionConfirmation(
  txId: string,
  response: ContractTransactionResponse,
): Promise<{ receipt: TransactionReceipt; meta: ConfirmedBlockMeta }> {
  await prisma.blockchainTransaction.update({
    where: { id: txId },
    data: { status: BlockchainTxStatuses.confirming },
  });

  const confirmations = getConfirmationsRequired();
  const receipt = await response.wait(confirmations);
  if (!receipt || receipt.status !== 1) {
    await markTransactionFailed(txId, new Error("Transaction reverted or missing receipt"));
    throw new AppError(502, "CHAIN_TX_FAILED", "On-chain transaction failed");
  }

  const currentBlock = await response.provider!.getBlockNumber();
  const confirmationCount = Math.max(0, currentBlock - Number(receipt.blockNumber) + 1);

  const meta: ConfirmedBlockMeta = {
    blockNumber: BigInt(receipt.blockNumber),
    blockHash: receipt.blockHash,
    transactionIndex: receipt.index,
    confirmationCount,
    gasUsed: receipt.gasUsed ? BigInt(receipt.gasUsed.toString()) : undefined,
  };

  await prisma.blockchainTransaction.update({
    where: { id: txId },
    data: {
      status: BlockchainTxStatuses.confirmed,
      blockNumber: meta.blockNumber,
      blockHash: meta.blockHash,
      transactionIndex: meta.transactionIndex,
      confirmationCount: meta.confirmationCount,
      gasUsed: meta.gasUsed,
      confirmedAt: new Date(),
      error: null,
    },
  });

  return { receipt, meta };
}

export async function submitAndConfirm(input: {
  txId: string;
  send: () => Promise<ContractTransactionResponse>;
}): Promise<{ receipt: TransactionReceipt; meta: ConfirmedBlockMeta; txHash: string }> {
  try {
    const response = await input.send();
    await markTransactionSubmitted(input.txId, response);
    const { receipt, meta } = await waitForTransactionConfirmation(input.txId, response);
    return { receipt, meta, txHash: response.hash };
  } catch (error) {
    await markTransactionFailed(input.txId, error);
    if (error instanceof AppError) throw error;
    throw new AppError(502, "CHAIN_TX_FAILED", "Failed to submit or confirm transaction", {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}
