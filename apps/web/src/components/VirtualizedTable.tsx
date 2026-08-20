import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TBody, THead, TR } from "@trustchain/ui";

const ROW_ESTIMATE = 48;

/**
 * Virtualizes large row sets. Small lists render a normal table for accessibility
 * and simpler layout.
 */
export function VirtualizedTable<T>({
  rows,
  header,
  renderRow,
  estimateSize = ROW_ESTIMATE,
  maxHeight = 480,
  getRowKey,
  empty,
  threshold = 40,
}: {
  rows: T[];
  header: ReactNode;
  renderRow: (row: T, index: number) => ReactNode;
  estimateSize?: number;
  maxHeight?: number;
  getRowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  threshold?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
  });

  if (rows.length === 0) {
    return <>{empty ?? <p className="text-sm text-[var(--tc-muted)]">No rows.</p>}</>;
  }

  if (rows.length < threshold) {
    return (
      <Table>
        <THead>
          <TR>{header}</TR>
        </THead>
        <TBody>
          {rows.map((row, index) => (
            <TR key={getRowKey(row, index)}>{renderRow(row, index)}</TR>
          ))}
        </TBody>
      </Table>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-md border border-[var(--tc-border)]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] bg-[var(--tc-surface-2)] px-3 py-2 text-sm font-medium text-[var(--tc-muted)]">
        {header}
      </div>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index]!;
            return (
              <div
                key={getRowKey(row, item.index)}
                className="absolute left-0 top-0 grid w-full grid-cols-[repeat(auto-fit,minmax(0,1fr))] items-center border-t border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
                style={{
                  height: `${item.size}px`,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {renderRow(row, item.index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
