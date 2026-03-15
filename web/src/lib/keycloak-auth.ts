import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

type KeycloakConfig = {
  baseURL: string;
  realm: string;
  clientID: string;
  silentRedirectURI?: string;
};

const LEGACY_TOKEN_STORAGE_KEY = 'keycloak-tokens';
const LEGACY_PENDING_STORAGE_KEY = 'keycloak-pending-auth';

let userManager: UserManager | null = null;
let silentRenewEnabled = false;

const normalizeURL = (value: string) => value.trim().replace(/\/+$/, '');

const resolveBaseURL = (value: string): string => {
  const normalized = normalizeURL(value);
  if (
    typeof window !== 'undefined'
    && normalized.startsWith('/')
    && !normalized.startsWith('//')
  ) {
    return `${window.location.origin}${normalized}`;
  }
  return normalized;
};

const resolveOptionalURL = (value: string | undefined): string | undefined => {
  if (!value || typeof window === 'undefined') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return new URL(trimmed, window.location.origin).toString();
};

const getConfig = (): KeycloakConfig => ({
  baseURL: resolveBaseURL(
    process.env.NEXT_PUBLIC_KEYCLOAK_BASE_URL || 'http://localhost:18081/auth',
  ),
  realm: (process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'index-replication').trim(),
  clientID: (process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'web').trim(),
  silentRedirectURI: resolveOptionalURL(
    process.env.NEXT_PUBLIC_KEYCLOAK_SILENT_REDIRECT_URI,
  ),
});

const getAuthority = (): string => {
  const cfg = getConfig();
  return `${cfg.baseURL}/realms/${encodeURIComponent(cfg.realm)}`;
};

const getUserManager = (): UserManager | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  if (userManager) {
    return userManager;
  }

  const cfg = getConfig();
  silentRenewEnabled = Boolean(cfg.silentRedirectURI);

  userManager = new UserManager({
    authority: getAuthority(),
    client_id: cfg.clientID,
    redirect_uri: `${window.location.origin}/login`,
    post_logout_redirect_uri: `${window.location.origin}/login`,
    response_type: 'code',
    scope: 'openid profile email',
    loadUserInfo: false,
    monitorSession: false,
    automaticSilentRenew: silentRenewEnabled,
    silent_redirect_uri: cfg.silentRedirectURI,
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });

  return userManager;
};

export const isKeycloakAuthConfigured = (): boolean => {
  const cfg = getConfig();
  return Boolean(cfg.baseURL && cfg.realm && cfg.clientID);
};

export const clearKeycloakTokens = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(LEGACY_PENDING_STORAGE_KEY);

  const manager = getUserManager();
  if (!manager) {
    return;
  }

  void manager.removeUser().catch(() => {});
};

export const beginKeycloakLogin = async (
  nextPath: string | null,
): Promise<void> => {
  if (typeof window === 'undefined') {
    return;
  }
  const manager = getUserManager();
  if (!manager || !isKeycloakAuthConfigured()) {
    throw new Error('Keycloak auth is not configured');
  }

  const redirectURL = new URL('/login', window.location.origin);
  if (nextPath) {
    redirectURL.searchParams.set('next', nextPath);
  }

  await manager.clearStaleState();
  await manager.signinRedirect({
    redirect_uri: redirectURL.toString(),
  });
};

export const consumeKeycloakLoginCallback = async (
  params: URLSearchParams,
): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false;
  }

  const callbackError = params.get('error');
  if (callbackError) {
    throw new Error(params.get('error_description') || callbackError);
  }

  if (!params.get('code') || !params.get('state')) {
    return false;
  }

  const manager = getUserManager();
  if (!manager) {
    return false;
  }

  await manager.signinCallback(window.location.href);
  return true;
};

export const getValidKeycloakIDToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') {
    return null;
  }

  const manager = getUserManager();
  if (!manager) {
    return null;
  }

  let user = await manager.getUser();
  if (!user) {
    return null;
  }

  if (user.expired) {
    if (!silentRenewEnabled) {
      await manager.removeUser();
      return null;
    }
    try {
      user = await manager.signinSilent();
    } catch {
      await manager.removeUser();
      return null;
    }
  }

  if (!user) {
    return null;
  }

  return user.id_token || null;
};
