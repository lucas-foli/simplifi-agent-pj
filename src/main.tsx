import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeBranding } from "@/lib/branding";

initializeBranding();

createRoot(document.getElementById("root")!).render(<App />);
