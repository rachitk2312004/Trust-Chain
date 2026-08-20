import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  SearchBar,
  SearchFilters,
  SearchResultCard,
  SearchResultsTable,
  emptySearchFilters,
  useSearch,
  useSearchSuggestions,
  type SearchFiltersState,
} from "../features/search";

export function SearchPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin, isOrgMember } = usePermissions();
  const canSearch = isOrgAdmin || isSuperAdmin || isOrgMember;

  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [draftFilters, setDraftFilters] = useState<SearchFiltersState>(emptySearchFilters);
  const [appliedFilters, setAppliedFilters] = useState<SearchFiltersState>(emptySearchFilters);
  const [view, setView] = useState<"table" | "cards">("table");

  const queryFilters = useMemo(
    () => ({
      q: appliedQ || undefined,
      entityTypes: appliedFilters.entityTypes || undefined,
      status: appliedFilters.status || undefined,
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined,
      sort: appliedFilters.sort,
      limit: 25,
      offset: 0,
    }),
    [appliedQ, appliedFilters],
  );

  const search = useSearch(organizationId, queryFilters, Boolean(canSearch && organizationId));
  const suggestions = useSearchSuggestions(
    organizationId,
    draftQ,
    Boolean(canSearch && organizationId && draftQ.length >= 2),
  );

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Search" />
        <FormHint>Select an organization to search.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canSearch) {
    return (
      <AppShellLayout>
        <PageHeader title="Search" />
        <FormHint>Organization membership is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Search"
        description="Keyword, exact, and fuzzy search across indexed TrustChain entities."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            {(isOrgAdmin || isSuperAdmin) && (
              <Link to="/search/admin" className="text-[var(--tc-accent)] hover:underline">
                Search admin
              </Link>
            )}
            <button
              type="button"
              className="text-[var(--tc-accent)] hover:underline"
              onClick={() => setView((v) => (v === "table" ? "cards" : "table"))}
            >
              {view === "table" ? "Card view" : "Table view"}
            </button>
          </div>
        }
      />

      <div className="mb-6 space-y-4">
        <SearchBar
          value={draftQ}
          onChange={setDraftQ}
          onSubmit={() => {
            setAppliedQ(draftQ);
            setAppliedFilters(draftFilters);
          }}
        />
        {suggestions.data?.suggestions?.length ? (
          <div className="flex flex-wrap gap-2 text-sm">
            {suggestions.data.suggestions.map((s) => (
              <button
                key={`${s.entityType}:${s.entityId}`}
                type="button"
                className="rounded border border-[var(--tc-border)] px-2 py-1 text-[var(--tc-muted)] hover:text-[var(--tc-fg)]"
                onClick={() => {
                  setDraftQ(s.text);
                  setAppliedQ(s.text);
                }}
              >
                {s.text}
              </button>
            ))}
          </div>
        ) : null}
        <SearchFilters
          value={draftFilters}
          onChange={setDraftFilters}
          onApply={() => {
            setAppliedQ(draftQ);
            setAppliedFilters(draftFilters);
          }}
        />
      </div>

      {search.isError ? <FormError>{getApiErrorMessage(search.error)}</FormError> : null}
      {search.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Searching…</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[var(--tc-muted)]">
            {search.data?.total ?? 0} result{(search.data?.total ?? 0) === 1 ? "" : "s"}
          </p>
          {view === "table" ? (
            <SearchResultsTable results={search.data?.results ?? []} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(search.data?.results ?? []).map((row) => (
                <SearchResultCard key={`${row.entityType}:${row.entityId}`} result={row} />
              ))}
            </div>
          )}
        </div>
      )}
    </AppShellLayout>
  );
}
