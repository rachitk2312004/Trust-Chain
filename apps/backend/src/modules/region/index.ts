export { regionRouter } from "./region.router.js";
export {
  listRegions,
  createRegion,
  patchRegion,
  getRouting,
  triggerFailover,
  getResidency,
  selectRegion,
  enforceResidency,
  selectFailoverTarget,
  validateReplicationTargets,
  evaluateReplicationHealth,
  buildResidencyReport,
} from "./region.service.js";
