export { walletsRouter } from "./walletsync.router.js";
export {
  listWallets,
  linkWallet,
  verifyWallet,
  patchWallet,
  listHistory,
  syncWallets,
  generateOwnershipChallenge,
  verifyOwnershipProof,
  normalizeWalletAddress,
  detectLinkConflict,
  resolveLinkConflict,
  buildSyncPlan,
  executeSyncPlan,
} from "./walletsync.service.js";
