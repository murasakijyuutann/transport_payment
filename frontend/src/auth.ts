import type { AuthResult } from './types';

const TOKEN_KEY = 'token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(result: AuthResult): void {
  localStorage.setItem(TOKEN_KEY, result.token);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function requireAuth(): string {
  const token = getToken();
  if (!token) {
    location.href = '/index.html';
    throw new Error('Unauthorized');
  }
  return token;
}

export function logout(): void {
  clearSession();
  location.href = '/index.html';
}
