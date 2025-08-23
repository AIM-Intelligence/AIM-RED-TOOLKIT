import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

console.log("[Main] Starting React application...");

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("[Main] Root element not found!");
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Root element not found. Please check index.html</div>';
} else {
  console.log("[Main] Root element found, creating React root...");
  
  try {
    const root = createRoot(rootElement);
    console.log("[Main] React root created, rendering app...");
    
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
    
    console.log("[Main] App render initiated successfully");
  } catch (error) {
    console.error("[Main] Failed to render app:", error);
    rootElement.innerHTML = `<div style="color: red; padding: 20px;">Failed to initialize React: ${error}</div>`;
  }
}
