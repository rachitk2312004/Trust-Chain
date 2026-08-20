import { z } from "zod";
import { SearchDefaults, SearchEntityTypeList } from "@trustchain/config";

const entityTypeSchema = z.enum(SearchEntityTypeList as [string, ...string[]]);

export const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(SearchDefaults.maxQueryLength)
    .optional()
    .transform((v) => (v && v.length >= SearchDefaults.minQueryLength ? v : undefined)),
  organizationId: z.string().uuid().optional(),
  entityTypes: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      const list = v
        .split(",")
        .map((s) => s.trim())
        .filter((t) => (SearchEntityTypeList as readonly string[]).includes(t));
      return list.length ? list : undefined;
    }),
  status: z.string().trim().min(1).max(64).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sort: z.enum(["relevance", "created_at_desc", "created_at_asc", "title_asc"]).default("relevance"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SearchDefaults.maxLimit)
    .default(SearchDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const suggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(SearchDefaults.maxQueryLength),
  organizationId: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SearchDefaults.suggestionLimit)
    .default(SearchDefaults.suggestionLimit),
});

export const reindexBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  entityTypes: z.array(entityTypeSchema).min(1).max(SearchEntityTypeList.length).optional(),
});

export const statusQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});
