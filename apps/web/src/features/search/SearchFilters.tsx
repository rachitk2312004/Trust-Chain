import { Button, Input, Label } from "@trustchain/ui";

export type SearchFiltersState = {
  entityTypes: string;
  status: string;
  from: string;
  to: string;
  sort: string;
};

export const emptySearchFilters: SearchFiltersState = {
  entityTypes: "",
  status: "",
  from: "",
  to: "",
  sort: "relevance",
};

export function SearchFilters({
  value,
  onChange,
  onApply,
}: {
  value: SearchFiltersState;
  onChange: (next: SearchFiltersState) => void;
  onApply: () => void;
}) {
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <div>
        <Label htmlFor="entityTypes">Entity types</Label>
        <Input
          id="entityTypes"
          value={value.entityTypes}
          onChange={(e) => onChange({ ...value, entityTypes: e.target.value })}
          placeholder="document,certificate"
        />
      </div>
      <div>
        <Label htmlFor="status">Status</Label>
        <Input
          id="status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
          placeholder="active"
        />
      </div>
      <div>
        <Label htmlFor="from">From</Label>
        <Input
          id="from"
          type="datetime-local"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="datetime-local"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="sort">Sort</Label>
        <select
          id="sort"
          className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
          value={value.sort}
          onChange={(e) => onChange({ ...value, sort: e.target.value })}
        >
          <option value="relevance">Relevance</option>
          <option value="created_at_desc">Newest</option>
          <option value="created_at_asc">Oldest</option>
          <option value="title_asc">Title A–Z</option>
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit">Apply filters</Button>
      </div>
    </form>
  );
}
