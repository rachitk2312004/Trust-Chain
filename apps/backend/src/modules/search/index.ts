export { searchRouter } from "./search.router.js";
export {
  search,
  suggestions,
  reindex,
  getStatus,
} from "./search.service.js";
export {
  indexDocument,
  indexCertificate,
  indexSignature,
  indexUser,
  indexOrganization,
  indexAuditEvent,
  buildIndexDocuments,
  filterIndexDocuments,
} from "./search.indexer.js";
export {
  scoreDocument,
  rankSearchResults,
  paginateResults,
  buildSuggestions,
  editDistance,
  scoreExactMatch,
  scoreKeywordMatch,
  scoreFuzzyMatch,
} from "./search.scoring.js";
