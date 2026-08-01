export {
  classifyResource,
  type ClassificationLabel,
  type ClassifiedResource,
} from "./classification/index.js";
export { appendLineageStep, type LineageStep } from "./lineage/index.js";
export { defineDataRetention, type DataRetentionPolicy } from "./retention/index.js";
export {
  registerCatalogEntry,
  listCatalogEntries,
  clearCatalog,
  type CatalogEntry,
} from "./catalog/index.js";
