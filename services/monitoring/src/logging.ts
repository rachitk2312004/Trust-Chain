export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, string>;
};

const buffer: LogEntry[] = [];

export function log(level: LogLevel, message: string, context?: Record<string, string>): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
  buffer.push(entry);
  return entry;
}

export function getRecentLogs(limit = 50): LogEntry[] {
  return buffer.slice(-limit);
}

export function clearLogs(): void {
  buffer.length = 0;
}
