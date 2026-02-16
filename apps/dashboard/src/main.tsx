import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./context/auth-context";
import { EnvironmentProvider } from "./context/environment-context";
import { App } from "./app";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <EnvironmentProvider>
          <App />
        </EnvironmentProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
