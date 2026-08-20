import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../services/authApi";
import { applyAuthSession, handleLoginSuccess } from "../../lib/authSession";
import { completeAuthNavigation } from "../../lib/postAuthNavigation";
import { meQueryOptions } from "./meQuery";
import { useSessionStore } from "../../lib/sessionStore";
import type { LoginResponse } from "../../types/api";

export function useLogin() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      deviceName?: string;
    }) => {
      const { data } = await authApi.login(input);
      return data;
    },
    onSuccess: (data: LoginResponse) => {
      const next = handleLoginSuccess(data);
      if (next === "mfa") {
        navigate("/mfa", { replace: true });
      }
      // Non-MFA: PublicOnly renders AuthHomeRedirect once the session token is set.
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => {
      const { data } = await authApi.register(input);
      return data;
    },
    onSuccess: (_data, variables) => {
      navigate("/login", {
        replace: true,
        state: {
          registered: true,
          email: variables.email,
          firstName: variables.firstName,
        },
      });
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        // Still clear local session if server logout fails (expired token, etc.)
      }
    },
    onSettled: () => {
      useSessionStore.getState().clearSession();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await authApi.forgotPassword(email);
      return data;
    },
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: { token: string; password: string }) => {
      const { data } = await authApi.resetPassword(input);
      return data;
    },
    onSuccess: () => {
      navigate("/login", { replace: true, state: { passwordReset: true } });
    },
  });
}

export function useVerifyMfa() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: { code: string; deviceName?: string }) => {
      const mfaToken = useSessionStore.getState().mfaToken;
      if (!mfaToken) {
        throw new Error("MFA challenge expired. Sign in again.");
      }
      const { data } = await authApi.verifyMfa({ mfaToken, code: input.code, deviceName: input.deviceName });
      return data;
    },
    onSuccess: async (data) => {
      applyAuthSession(data);
      await completeAuthNavigation(navigate);
    },
  });
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: async () => {
      const refreshToken = useSessionStore.getState().refreshToken;
      if (!refreshToken) throw new Error("No refresh token");
      const { data } = await authApi.refresh(refreshToken);
      applyAuthSession(data);
      return data;
    },
  });
}

export function useCurrentUser(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    ...meQueryOptions(),
    enabled: enabled && Boolean(accessToken),
  });
}

export function useSessions(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data } = await authApi.listSessions();
      return data.sessions;
    },
    enabled: enabled && Boolean(accessToken),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sessionId: string) => {
      await authApi.revokeSession(sessionId);
      return sessionId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
  });
}
