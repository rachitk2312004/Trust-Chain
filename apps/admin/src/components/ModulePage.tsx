import type { ReactNode } from "react";

export type AdminModule = {
  id: string;
  title: string;
  description: string;
  metrics: { label: string; value: string }[];
  items?: string[];
};

export function ModulePage({ module }: { module: AdminModule }) {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">{module.title}</h2>
        <p className="mt-1 text-sm text-slate-600">{module.description}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {module.metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">{metric.label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{metric.value}</p>
          </div>
        ))}
      </div>

      {module.items && module.items.length > 0 && (
        <ul className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {module.items.map((item) => (
            <li
              key={item}
              className="border-b border-slate-100 py-2 text-sm text-slate-700 last:border-0"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScoreCard({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{pct}%</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function placeholderItems(prefix: string, count = 3): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix} item ${index + 1} (stub)`);
}

export type ModuleComponent = () => ReactNode;
