export type AuthEventType = "session-expired" | "forced-logout" | "unauthorized";

export type AuthEvent = {
  type: AuthEventType;
  message?: string;
};

type Listener = (event: AuthEvent) => void;

const listeners = new Set<Listener>();

export function subscribeAuthEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitAuthEvent(event: AuthEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}
