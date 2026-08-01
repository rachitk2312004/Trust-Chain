import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SidePanel } from "./SidePanel";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
