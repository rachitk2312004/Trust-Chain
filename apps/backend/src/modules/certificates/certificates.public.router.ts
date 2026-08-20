import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { parseParams } from "../../lib/validate.js";
import { verifyCertificateByPublicId } from "./certificates.public.js";

export const publicCertificateRouter = Router();

const publicIdParamsSchema = z.object({
  publicId: z.string().min(1).max(120),
});

publicCertificateRouter.get(
  "/certificates/verify/:publicId",
  asyncHandler(async (req, res) => {
    const params = parseParams(publicIdParamsSchema, req.params);
    const data = await verifyCertificateByPublicId(params.publicId);
    res.status(200).json(data);
  }),
);
