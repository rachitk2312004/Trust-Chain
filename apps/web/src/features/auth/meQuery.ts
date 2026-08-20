import { queryOptions } from "@tanstack/react-query";
import { authApi } from "../../services/authApi";
import { applySessionRoles } from "../../lib/sessionRoles";
import { useSessionStore } from "../../lib/sessionStore";

export const meQueryKey = ["me"] as const;

export function meQueryOptions() {
  return queryOptions({
    queryKey: meQueryKey,
    queryFn: async () => {
      const { data } = await authApi.me();
      useSessionStore.getState().setUser(data.user);
      applySessionRoles(data.roles ?? []);
      return data;
    },
    staleTime: 10 * 60_000,
  });
}
