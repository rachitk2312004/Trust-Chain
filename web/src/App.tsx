const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">TrustChain</h1>
      <p className="max-w-md text-center text-slate-600">
        Trust every document. Verify in seconds.
      </p>
      <p className="text-xs text-slate-400">API: {apiUrl}</p>
    </main>
  );
}
