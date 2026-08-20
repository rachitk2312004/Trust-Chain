import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  sortable?: boolean;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  empty,
  onSort,
  sortKey,
  sortDir,
  className,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  empty?: ReactNode;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  className?: string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-tc-border bg-tc-surface shadow-soft", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-tc-border bg-tc-surface-2/70">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-tc-muted",
                    col.className,
                  )}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-tc-fg"
                      onClick={() => onSort(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : null}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.id ?? String(idx)}
                className="border-b border-tc-border/70 transition-colors last:border-0 hover:bg-tc-surface-2/50"
              >
                {columns.map((col) => (
                  <td key={col.key} className={cn("px-4 py-3.5 text-tc-fg", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-tc-muted">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="tc-focus cursor-pointer rounded-lg border border-tc-border px-3 py-1.5 hover:bg-tc-surface-2 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="tc-focus cursor-pointer rounded-lg border border-tc-border px-3 py-1.5 hover:bg-tc-surface-2 disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
