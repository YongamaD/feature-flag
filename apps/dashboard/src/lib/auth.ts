import type { AuthUser } from "./types";

const TOKEN_KEY = "ff_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function parseJwt(token: string): AuthUser | null {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return decoded as AuthUser;
  } catch {
    return null;
  }
}

export function isExpired(user: AuthUser): boolean {
  return Date.now() >= user.exp * 1000;
}
