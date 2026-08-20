import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingScreen } from "./ui";
import { completeAuthNavigation } from "../lib/postAuthNavigation";

/** Resolves role-aware home route before any workspace page renders. */
export function AuthHomeRedirect() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void completeAuthNavigation(navigate);
  }, [navigate]);

  return <LoadingScreen label="Signing you in…" className="min-h-screen" />;
}
