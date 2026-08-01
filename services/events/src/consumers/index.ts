import type { DomainEvent } from "../publishers/index.js";
import { listPublishedEvents } from "../publishers/index.js";

export type ConsumerHandler = (event: DomainEvent) => void;

export function consumeEvents(type: string, handler: ConsumerHandler): number {
  const matching = listPublishedEvents().filter((event) => event.type === type);
  matching.forEach(handler);
  return matching.length;
}
