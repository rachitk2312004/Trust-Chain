import { ModulePage, placeholderItems } from "../../components/ModulePage";

export function EventsPage() {
  return (
    <ModulePage
      module={{
        id: "events",
        title: "Events",
        description: "In-memory event bus publish, consume, replay, and retention stubs.",
        metrics: [
          { label: "Published (1h)", value: "1,842" },
          { label: "Consumers", value: "6" },
          { label: "Replay Queue", value: "0" },
          { label: "Retention Policy", value: "7d / 10k" },
        ],
        items: placeholderItems("Event type", 4),
      }}
    />
  );
}

export const eventsModule = { id: "events", title: "Events" };
