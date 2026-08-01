const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export function Popup() {
  return (
    <main
      style={{
        width: 280,
        padding: 16,
        fontFamily: "Segoe UI, system-ui, sans-serif",
        color: "#0f172a",
      }}
    >
      <h1 style={{ margin: "0 0 8px", fontSize: 20 }}>TrustChain</h1>
      <p style={{ margin: "0 0 8px", color: "#475569", fontSize: 13 }}>
        Trust every document. Verify in seconds.
      </p>
      <p style={{ margin: 0, color: "#94a3b8", fontSize: 11 }}>API: {apiUrl}</p>
    </main>
  );
}
