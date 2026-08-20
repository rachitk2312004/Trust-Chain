import { apiClient } from "./http";
import type {
  AuthSessionPayload,
  LoginResponse,
  MeResponse,
  PublicUser,
  SessionRow,
} from "../types/api";

export type RegisterInput = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export type LoginInput = {
  email: string;
  password: string;
  deviceName?: string;
  fingerprint?: string;
};

export type ResetPasswordInput = {
  token: string;
  password: string;
};

export type MfaVerifyInput = {
  mfaToken: string;
  code: string;
  deviceName?: string;
  fingerprint?: string;
};

export const authApi = {
  register(input: RegisterInput) {
    return apiClient.post<{ user: PublicUser }>("/auth/register", input);
  },
  login(input: LoginInput) {
    return apiClient.post<LoginResponse>("/auth/login", input);
  },
  verifyMfa(input: MfaVerifyInput) {
    return apiClient.post<AuthSessionPayload>("/auth/mfa/verify", input);
  },
  refresh(refreshToken: string) {
    return apiClient.post<AuthSessionPayload>("/auth/refresh", { refreshToken });
  },
  logout() {
    return apiClient.post<{ ok: boolean }>("/auth/logout");
  },
  forgotPassword(email: string) {
    return apiClient.post<{ ok: boolean }>("/auth/password/forgot", { email });
  },
  resetPassword(input: ResetPasswordInput) {
    return apiClient.post<{ user: PublicUser }>("/auth/password/reset", input);
  },
  listSessions() {
    return apiClient.get<{ sessions: SessionRow[] }>("/auth/sessions");
  },
  revokeSession(sessionId: string) {
    return apiClient.delete<{ ok: boolean }>(`/auth/sessions/${sessionId}`);
  },
  me() {
    return apiClient.get<MeResponse>("/me");
  },
};
