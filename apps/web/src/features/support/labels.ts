export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  open: "Needs reply",
  answered: "Answered",
  closed: "Closed",
};

export const BUG_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  fixed: "Fixed",
  wont_fix: "Won't fix",
};

export const BUG_STATUSES = ["open", "acknowledged", "in_progress", "fixed", "wont_fix"] as const;

export function personLabel(person?: { firstName: string | null; lastName: string | null; email: string } | null) {
  if (!person) return "Unknown";
  const name = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return name || person.email;
}

export function formatSupportTime(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}
