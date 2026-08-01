import { listPublishedEvents } from "../publishers/index.js";

export function replayEvents(fromIndex = 0): ReturnType<typeof listPublishedEvents> {
  return listPublishedEvents().slice(fromIndex);
}
