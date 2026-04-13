'use client'

import {
  AuditLogsApi,
  AuthApi,
  ChannelsApi,
  Configuration,
  MoexApi,
  PortfolioApi,
  SettingsApi,
  TbankApi,
  UsersApi,
} from "@/api-client";
import axios, { AxiosHeaders } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axiosTauriApiAdapter from '@/lib/axios-tauri-proxy';
import { getValidKeycloakIDToken, renewKeycloakIDToken } from '@/lib/keycloak-auth';

export const isTauri = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'isTauri' in window && !!window.isTauri
};

export const axiosClient = isTauri()
  ? axios.create({
    adapter: async (c) => {
      console.log(c);
      const res = await axiosTauriApiAdapter(c) as AxiosResponse;
      console.log('rrr', res);
      return res;
    },
  })
  : axios.create();

export const LOCAL_STORAGE_BASE_URL = 'settings-api-url'
const DEFAULT_DEV_API_BASE_URL = 'http://localhost:18080';

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const isStorybookRuntime = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const path = window.location.pathname;
  if (path.endsWith('/iframe.html')) {
    return true;
  }

  if (path.endsWith('/index.html') && window.location.search.includes('path=/story/')) {
    return true;
  }

  return false;
};

const readLocalStorageBaseUrl = () => {
  let localStorageBase: string | null = null;
  try {
    localStorageBase = localStorage.getItem(LOCAL_STORAGE_BASE_URL);
  } catch {
    return null;
  }
  if (!localStorageBase || localStorageBase.length <= 3) {
    return null;
  }
  if (localStorageBase[0] === '"') {
    try {
      const parsed = JSON.parse(localStorageBase) as unknown;
      return typeof parsed === 'string'
        ? normalizeBaseUrl(parsed)
        : normalizeBaseUrl(localStorageBase);
    } catch {
      return normalizeBaseUrl(localStorageBase);
    }
  }
  return normalizeBaseUrl(localStorageBase);
};

const getBaseUrl = () => {
  const envBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    ? normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL)
    : "";

  if (typeof window !== 'undefined') {
    const localStorageBase = readLocalStorageBaseUrl();
    if (localStorageBase) {
      return localStorageBase;
    }

    if (envBaseUrl.length > 3) {
      return envBaseUrl;
    }

    if (isStorybookRuntime()) {
      return DEFAULT_DEV_API_BASE_URL;
    }

    // In browser production, use same origin to keep scheme (https/http) in sync.
    if (process.env.NODE_ENV === 'production') {
      return "";
    }

    return DEFAULT_DEV_API_BASE_URL;
  }

  // Server-side fallback
  return envBaseUrl || DEFAULT_DEV_API_BASE_URL;
};

export const getApiUrl = () => {
  const baseUrl = getBaseUrl();
  return baseUrl ? `${baseUrl}/api` : '/api';
}

const setAuthorizationHeader = (
  config: InternalAxiosRequestConfig,
  token: string | null,
) => {
  const headers = AxiosHeaders.from(config.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }
  config.headers = headers;
};

const AUTH_RETRY_FLAG = '__keycloakAuthRetried';
type RetriableAuthConfig = InternalAxiosRequestConfig & {
  [AUTH_RETRY_FLAG]?: boolean;
};

axiosClient.defaults.baseURL = getApiUrl();
axiosClient.interceptors.request.use(async config => {
  config.baseURL = getApiUrl();
  const token = await getValidKeycloakIDToken();
  if (token) {
    setAuthorizationHeader(config, token);
    return config;
  }

  // Fallback: try a silent renew even when no local token was returned.
  const renewedToken = await renewKeycloakIDToken();
  setAuthorizationHeader(config, renewedToken);
  return config;
});

axiosClient.interceptors.response.use(
  response => response,
  async error => {
    const status =
      axios.isAxiosError(error)
        ? error.response?.status
        : (error as { response?: { status?: number } } | null | undefined)?.response?.status;
    const originalConfig = (
      axios.isAxiosError(error)
        ? error.config
        : (error as { config?: RetriableAuthConfig } | null | undefined)?.config
    ) as RetriableAuthConfig | undefined;
    if (
      status !== axios.HttpStatusCode.Unauthorized
      || !originalConfig
      || originalConfig[AUTH_RETRY_FLAG]
    ) {
      throw (error instanceof Error ? error : new Error('Unknown request error'));
    }

    const token = await renewKeycloakIDToken();
    if (!token) {
      throw (error instanceof Error ? error : new Error('Unknown request error'));
    }

    originalConfig[AUTH_RETRY_FLAG] = true;
    setAuthorizationHeader(originalConfig, token);
    return axiosClient.request(originalConfig);
  },
);

const config = new Configuration({
  basePath: getApiUrl(),
});

export const auditLogsApi = new AuditLogsApi(config, config.basePath, axiosClient);
export const authApi = new AuthApi(config, config.basePath, axiosClient);
export const channelsApi = new ChannelsApi(config, config.basePath, axiosClient);
export const settingsApi = new SettingsApi(config, config.basePath, axiosClient);
export const usersApi = new UsersApi(config, config.basePath, axiosClient);
export const moexApi = new MoexApi(config, config.basePath, axiosClient);
export const portfolioApi = new PortfolioApi(config, config.basePath, axiosClient);
export const tbankApi = new TbankApi(config, config.basePath, axiosClient);
