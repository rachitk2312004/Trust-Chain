export type DomainEvent = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  publishedAt: string;
};

const bus: DomainEvent[] = [];

export function publishEvent(type: string, payload: Record<string, unknown>): DomainEvent {
  const event: DomainEvent = {
    id: `EVT-${Date.now()}-${bus.length}`,
    type,
    payload,
    publishedAt: new Date().toISOString(),
  };
  bus.push(event);
  return event;
}

export function listPublishedEvents(): DomainEvent[] {
  return [...bus];
}

export function clearEventBus(): void {
  bus.length = 0;
}
