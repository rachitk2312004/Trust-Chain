import { useToast } from "@trustchain/ui";
import { useCallback, useMemo } from "react";
import { getApiErrorMessage } from "../lib/apiErrors";

export function useFeedback() {
  const toast = useToast();

  const success = useCallback(
    (title: string, description?: string) => {
      toast.push({ title, description, tone: "success" });
    },
    [toast],
  );

  const error = useCallback(
    (err: unknown, fallback = "Something went wrong") => {
      toast.push({
        title: fallback,
        description: getApiErrorMessage(err),
        tone: "danger",
      });
    },
    [toast],
  );

  const info = useCallback(
    (title: string, description?: string) => {
      toast.push({ title, description, tone: "info" });
    },
    [toast],
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      toast.push({ title, description, tone: "warning" });
    },
    [toast],
  );

  return useMemo(
    () => ({ success, error, info, warning, push: toast.push }),
    [success, error, info, warning, toast.push],
  );
}
