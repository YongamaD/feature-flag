import { getToken, clearToken } from "./auth";
import type {
  Flag,
  FlagState,
  Environment,
  EnvironmentWithKey,
  AuditLogEntry,
  PaginatedResponse,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  login(email: string, password: string) {
    return request<{ token: string; expiresIn: number }>(
      "/v1/admin/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
  },

  register(email: string, password: string, role: string) {
    return request<{ id: string; email: string; role: string; createdAt: string }>(
      "/v1/admin/auth/register",
      { method: "POST", body: JSON.stringify({ email, password, role }) }
    );
  },

  // Flags
  listFlags(environmentId: string) {
    return request<Flag[]>(`/v1/admin/flags?environmentId=${environmentId}`);
  },

  getFlag(key: string, environmentId: string) {
    return request<Flag>(`/v1/admin/flags/${key}?environmentId=${environmentId}`);
  },

  createFlag(data: { key: string; description?: string; environmentId: string; initialState: FlagState }) {
    return request<Flag>("/v1/admin/flags", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateFlag(key: string, environmentId: string, stateJson: FlagState) {
    return request<Flag>(`/v1/admin/flags/${key}`, {
      method: "PUT",
      body: JSON.stringify({ environmentId, stateJson }),
    });
  },

  archiveFlag(key: string, environmentId: string) {
    return request<Flag>(`/v1/admin/flags/${key}/archive`, {
      method: "PATCH",
      body: JSON.stringify({ environmentId }),
    });
  },

  unarchiveFlag(key: string, environmentId: string) {
    return request<Flag>(`/v1/admin/flags/${key}/unarchive`, {
      method: "PATCH",
      body: JSON.stringify({ environmentId }),
    });
  },

  publishFlag(key: string, environmentId: string) {
    return request<{ key: string; version: number; publishedAt: string }>(
      `/v1/admin/flags/${key}/publish`,
      { method: "POST", body: JSON.stringify({ environmentId }) }
    );
  },

  rollbackFlag(key: string, version: number, environmentId: string) {
    return request<{ key: string; rolledBackToVersion: number; newVersion: number }>(
      `/v1/admin/flags/${key}/rollback/${version}`,
      { method: "POST", body: JSON.stringify({ environmentId }) }
    );
  },

  // Environments
  listEnvironments(projectId: string) {
    return request<Environment[]>(`/v1/admin/environments?projectId=${projectId}`);
  },

  createEnvironment(name: string, projectId: string) {
    return request<EnvironmentWithKey>("/v1/admin/environments", {
      method: "POST",
      body: JSON.stringify({ name, projectId }),
    });
  },

  // Audit
  getAuditLog(environmentId: string, page = 1, limit = 50) {
    return request<PaginatedResponse<AuditLogEntry>>(
      `/v1/admin/audit?environmentId=${environmentId}&page=${page}&limit=${limit}`
    );
  },
};
