import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  checkoutBodySchema,
  confirmPaymentBodySchema,
  entitlementsQuerySchema,
  holderVerifyBodySchema,
} from "./billing.schemas.js";
import * as service from "./billing.service.js";

export const billingRouter = Router();

billingRouter.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    res.status(200).json(service.listPublicPlans());
  }),
);

billingRouter.get(
  "/entitlements",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(entitlementsQuerySchema, req.query);
    const data = await service.getBillingOverview(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

billingRouter.post(
  "/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(checkoutBodySchema, req.body);
    const data = await service.createCheckout(req.user.id, body);
    res.status(201).json(data);
  }),
);

billingRouter.post(
  "/confirm",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(confirmPaymentBodySchema, req.body);
    const data = await service.confirmCheckoutPayment(req.user.id, body);
    res.status(200).json(data);
  }),
);

billingRouter.post(
  "/verify-certificate",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(holderVerifyBodySchema, req.body);
    const data = await service.verifyCertificateForHolder(
      req.user.id,
      body.publicId,
      req.roleBindings,
    );
    res.status(200).json(data);
  }),
);
