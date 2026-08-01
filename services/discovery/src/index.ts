export {
  registerService,
  listRegisteredServices,
  clearRegistry,
  type RegisteredService,
} from "./registry/index.js";
export { buildTopology, defaultTopology, type TopologyNode } from "./topology/index.js";
export { mapDependencies, type Dependency } from "./dependencies/index.js";
export { checkServiceHealth, type ServiceHealth } from "./health/index.js";
