import { ApiConstants } from "@trustchain/config";
import { Router } from "express";

export const healthRouter = Router();

healthRouter.get(ApiConstants.healthPath, (_req, res) => {
  res.status(200).json({ status: "ok" });
});
