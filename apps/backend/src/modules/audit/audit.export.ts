import { AuditDefaults, AuditExportFormats } from "@trustchain/config";
import type { AuditEventRecord } from "./audit.timeline.js";

export type AuditExportFormat = (typeof AuditExportFormats)[keyof typeof AuditExportFormats];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportEventsToJson(events: AuditEventRecord[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: events.length,
      events,
    },
    null,
    2,
  );
}

export function exportEventsToCsv(events: AuditEventRecord[]): string {
  const headers = [
    "id",
    "createdAt",
    "correlationId",
    "requestId",
    "source",
    "action",
    "actorUserId",
    "actorIp",
    "organizationId",
    "resourceType",
    "resourceId",
    "success",
    "integrityHash",
    "previousHash",
    "meta",
  ];
  const lines = [headers.join(",")];
  for (const event of events) {
    lines.push(
      [
        event.id,
        event.createdAt,
        event.correlationId,
        event.requestId ?? "",
        event.source,
        event.action,
        event.actorUserId ?? "",
        event.actorIp ?? "",
        event.organizationId ?? "",
        event.resourceType ?? "",
        event.resourceId ?? "",
        String(event.success),
        event.integrityHash,
        event.previousHash ?? "",
        JSON.stringify(event.meta ?? null),
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }
  return lines.join("\n");
}

export function generateAuditExport(
  events: AuditEventRecord[],
  format: AuditExportFormat,
): { content: string; rowCount: number; contentType: string } {
  const capped = events.slice(0, AuditDefaults.maxExportRows);
  if (format === AuditExportFormats.csv) {
    return {
      content: exportEventsToCsv(capped),
      rowCount: capped.length,
      contentType: "text/csv",
    };
  }
  return {
    content: exportEventsToJson(capped),
    rowCount: capped.length,
    contentType: "application/json",
  };
}
