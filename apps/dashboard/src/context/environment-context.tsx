import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api } from "../lib/api-client";
import { useAuth } from "./auth-context";
import type { Environment } from "../lib/types";

const SELECTED_ENV_KEY = "ff_selected_env";
const PROJECT_ID = import.meta.env.VITE_DEFAULT_PROJECT_ID || "";

interface EnvironmentContextValue {
  environments: Environment[];
  selectedEnvironment: Environment | null;
  selectEnvironment: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEnvironments = useCallback(async () => {
    if (!PROJECT_ID || !user) return;
    setLoading(true);
    try {
      const envs = await api.listEnvironments(PROJECT_ID);
      setEnvironments(envs);

      const savedId = localStorage.getItem(SELECTED_ENV_KEY);
      const match = envs.find((e) => e.id === savedId) || envs[0] || null;
      setSelectedEnvironment(match);
      if (match) localStorage.setItem(SELECTED_ENV_KEY, match.id);
    } catch {
      // Handled by API client (401 redirect)
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const selectEnvironment = useCallback(
    (id: string) => {
      const env = environments.find((e) => e.id === id) || null;
      setSelectedEnvironment(env);
      if (env) localStorage.setItem(SELECTED_ENV_KEY, env.id);
    },
    [environments]
  );

  return (
    <EnvironmentContext.Provider
      value={{ environments, selectedEnvironment, selectEnvironment, loading, refresh: fetchEnvironments }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironments() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) throw new Error("useEnvironments must be used within EnvironmentProvider");
  return ctx;
}
