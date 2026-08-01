import { create } from "zustand";
import type { ExtensionStateSnapshot, VerifyResult } from "../types/extension.types.js";

type UiStore = {
  state: ExtensionStateSnapshot | null;
  loading: boolean;
  error: string | null;
  setState: (state: ExtensionStateSnapshot | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  lastResult: VerifyResult | null;
  setLastResult: (result: VerifyResult | null) => void;
};

export const useExtensionStore = create<UiStore>((set) => ({
  state: null,
  loading: false,
  error: null,
  lastResult: null,
  setState: (state) => set({ state }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setLastResult: (lastResult) => set({ lastResult }),
}));

export async function sendMessage<T = unknown>(
  message: Record<string, unknown>,
): Promise<T & { ok: boolean; error?: string }> {
  return chrome.runtime.sendMessage(message) as Promise<T & { ok: boolean; error?: string }>;
}
