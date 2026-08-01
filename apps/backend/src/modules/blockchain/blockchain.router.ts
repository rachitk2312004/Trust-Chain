import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import * as blockchain from "./blockchain.service.js";
import {
  anchorBodySchema,
  orgDocumentParamsSchema,
  orgIdParamsSchema,
  orgRetryParamsSchema,
  orgTxParamsSchema,
  revokeBodySchema,
} from "./blockchain.schemas.js";

function requireUser(req: { user?: { id: string } }): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

/** Top-level blockchain routes (networks, job processor). */
export const blockchainRouter = Router();

blockchainRouter.use(requireAuth);

blockchainRouter.get(
  "/networks",
  asyncHandler(async (_req, res) => {
    const networks = await blockchain.listBlockchainNetworks();
    res.status(200).json({ networks });
  }),
);

blockchainRouter.get(
  "/networks/current",
  asyncHandler(async (_req, res) => {
    const network = await blockchain.getCurrentBlockchainNetwork();
    res.status(200).json({ network });
  }),
);

blockchainRouter.post(
  "/jobs/process",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const result = await blockchain.processBlockchainJobs(userId);
    res.status(200).json(result);
  }),
);

/** Mounted under /organizations/:id */
export const organizationBlockchainRouter = Router({ mergeParams: true });

organizationBlockchainRouter.get(
  "/blockchain",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const status = await blockchain.getOrganizationChainStatus(userId, orgId);
    res.status(200).json(status);
  }),
);

organizationBlockchainRouter.post(
  "/blockchain/register",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const result = await blockchain.registerOrganizationOnChain(userId, orgId);
    res.status(result.alreadyRegistered ? 200 : 201).json(result);
  }),
);

organizationBlockchainRouter.get(
  "/blockchain/transactions",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const transactions = await blockchain.listOrganizationChainTransactions(userId, orgId);
    res.status(200).json({ transactions });
  }),
);

organizationBlockchainRouter.get(
  "/blockchain/transactions/:txId",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, txId } = parseParams(orgTxParamsSchema, req.params);
    const transaction = await blockchain.getOrganizationChainTransaction(userId, orgId, txId);
    res.status(200).json({ transaction });
  }),
);

organizationBlockchainRouter.get(
  "/blockchain/events",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId } = parseParams(orgIdParamsSchema, req.params);
    const events = await blockchain.listOrganizationChainEvents(userId, orgId);
    res.status(200).json({ events });
  }),
);

organizationBlockchainRouter.post(
  "/blockchain/retries/:jobId/run",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, jobId } = parseParams(orgRetryParamsSchema, req.params);
    const job = await blockchain.runRetryJob(userId, orgId, jobId);
    res.status(200).json({ job });
  }),
);

organizationBlockchainRouter.post(
  "/documents/:documentId/anchor",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(anchorBodySchema, req.body ?? {});
    const result = await blockchain.anchorDocumentOnChain(userId, orgId, documentId, body);
    res.status(201).json(result);
  }),
);

organizationBlockchainRouter.get(
  "/documents/:documentId/anchors",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const anchors = await blockchain.listDocumentAnchors(userId, orgId, documentId);
    res.status(200).json({ anchors });
  }),
);

organizationBlockchainRouter.post(
  "/documents/:documentId/revoke-on-chain",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const body = parseBody(revokeBodySchema, req.body ?? {});
    const result = await blockchain.revokeDocumentOnChain(userId, orgId, documentId, body);
    res.status(200).json(result);
  }),
);

organizationBlockchainRouter.get(
  "/documents/:documentId/chain-status",
  asyncHandler(async (req, res) => {
    const userId = requireUser(req);
    const { id: orgId, documentId } = parseParams(orgDocumentParamsSchema, req.params);
    const status = await blockchain.getDocumentChainStatus(userId, orgId, documentId);
    res.status(200).json(status);
  }),
);
