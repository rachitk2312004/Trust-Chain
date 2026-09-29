export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLastSeen(lastSeenAt?: string | null, online?: boolean): string {
  if (online) return "Online now";
  if (!lastSeenAt) return "Last online unknown";
  const at = Date.parse(lastSeenAt);
  if (!Number.isFinite(at)) return "Last online unknown";
  const delta = Date.now() - at;
  if (delta < 60_000) return "Last online just now";
  if (delta < 60 * 60_000) {
    const minutes = Math.max(1, Math.round(delta / 60_000));
    return `Last online ${minutes}m ago`;
  }
  if (delta < 24 * 60 * 60_000) {
    const hours = Math.max(1, Math.round(delta / (60 * 60_000)));
    return `Last online ${hours}h ago`;
  }
  return `Last online ${formatMessageTime(lastSeenAt)}`;
}
