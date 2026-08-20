import { ApiConstants } from "@trustchain/config";

export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${ApiConstants.prefix}${normalized}`;
}
