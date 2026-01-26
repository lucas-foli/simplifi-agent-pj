import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { branding } from "@/config/branding";
import { initializeBranding } from "@/lib/branding";
import { loadTenantBranding } from "@/lib/tenant";

const rootElement = document.getElementById("root");

const bootstrap = async () => {
  try {
    const tenantBranding = await loadTenantBranding();
    if (tenantBranding) {
      Object.assign(branding, tenantBranding);
    }
  } catch (error) {
    console.warn("Tenant bootstrap failed:", error);
  }

  initializeBranding(branding);
  if (rootElement) {
    createRoot(rootElement).render(<App />);
  }
};

void bootstrap();
