/** Shared cross-app TypeScript types (API DTOs, domain unions). */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
