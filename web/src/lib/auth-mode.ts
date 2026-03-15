export type AuthMode = 'session' | 'keycloak';

export const LOCAL_STORAGE_AUTH_MODE = 'settings-auth-mode';

const DEFAULT_AUTH_MODE: AuthMode = parseAuthMode(
  process.env.NEXT_PUBLIC_AUTH_MODE_DEFAULT,
) ?? 'session';

function parseAuthMode(value: unknown): AuthMode | null {
  if (value === 'session' || value === 'keycloak') {
    return value;
  }
  return null;
}

export function getAuthMode(): AuthMode {
  if (typeof window === 'undefined') {
    return DEFAULT_AUTH_MODE;
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AUTH_MODE);
    return parseAuthMode(raw) ?? DEFAULT_AUTH_MODE;
  } catch {
    return DEFAULT_AUTH_MODE;
  }
}

export function setAuthMode(mode: AuthMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(LOCAL_STORAGE_AUTH_MODE, mode);
}

