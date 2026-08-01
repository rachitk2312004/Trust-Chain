import { ApiConstants } from "@trustchain/config";
import { Router } from "express";
import { authRouter } from "../modules/auth/auth.router.js";
import { healthRouter } from "../modules/health/health.router.js";
import { meRouter } from "../modules/me/me.router.js";
import {
  organizationsRouter,
  invitationsRouter,
} from "../modules/organizations/organizations.router.js";

export const v1Router = Router();

v1Router.use(healthRouter);
v1Router.use("/auth", authRouter);
v1Router.use("/me", meRouter);
v1Router.use("/organizations", organizationsRouter);
v1Router.use("/invitations", invitationsRouter);

v1Router.get("/", (_req, res) => {
  res.status(200).json({
    name: "TrustChain API",
    version: "v1",
    prefix: ApiConstants.prefix,
  });
});
