'use client'

import {
  AuditLogsApi,
  AuthApi,
  Configuration,
  MoexApi,
  SettingsApi,
  UsersApi,
} from "@/api-client";
import axios, { AxiosHeaders } from "axios";
import axiosTauriApiAdapter from '@/lib/axios-tauri-proxy';

export const isTauri = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return 'isTauri' in window && !!window.isTauri
};

export const axiosClient = isTauri()
  ? axios.create({
    withCredentials: true,
    adapter: async (c) => {
      console.log(c);
      const res = await axiosTauriApiAdapter(c);
      console.log('rrr', res);
      return res;
    },
  })
  : axios.create({ withCredentials: true });

if (isTauri()) {
  const COOKIE_KEY = 'authCookies';

  axiosClient.interceptors.request.use(config => {
    const cookieStr = localStorage.getItem(COOKIE_KEY);
    console.log('sus', cookieStr)
    if (cookieStr) {
      config.headers['Cookie'] = cookieStr;
    }
    return config;
  });

  axiosClient.interceptors.response.use(response => {
    // @ts-ignore
    const setCookies = ((response as any).rawHeaders).filter(([key, val]) => key === 'set-cookie').map(([key, val]) => val);
    // console.log('response', response)
    // console.log('setCookies', response.headers.toJSON())
    // console.log('raw', (response.headers as AxiosHeaders).toJSON())
    if (setCookies && setCookies.length > 0) {
      const cookieMap: { [key: string]: string } = {};

      // Load existing cookies
      const existingStr = localStorage.getItem(COOKIE_KEY);
      if (existingStr) {
        existingStr.split(';').forEach(part => {
          const trimmed = part.trim();
          if (trimmed) {
            const [name, value] = trimmed.split('=');
            if (name && value) {
              cookieMap[name.trim()] = value.trim();
            }
          }
        });
      }

      // Parse and add/overwrite new cookies (ignoring attributes like Expires for simplicity)
      setCookies.forEach((setCookieStr: string) => {
        const parts = setCookieStr.split(';');
        const nameValue = parts[0].trim();
        const [name, value] = nameValue.split('=');
        if (name && value) {
          cookieMap[name.trim()] = value.trim();
        }
      });

      // Save updated cookie string
      const newStr = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      localStorage.setItem(COOKIE_KEY, newStr);
    }
    return response;
  });
}

export const LOCAL_STORAGE_BASE_URL = 'settings-api-url'
const DEFAULT_DEV_API_BASE_URL = 'http://localhost:18080';

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, "");

const readLocalStorageBaseUrl = () => {
  const localStorageBase = localStorage.getItem(LOCAL_STORAGE_BASE_URL);
  if (!localStorageBase || localStorageBase.length <= 3) {
    return null;
  }
  if (localStorageBase[0] === '"') {
    try {
      return normalizeBaseUrl(JSON.parse(localStorageBase));
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

    // In browser production, use same origin to keep scheme (https/http) in sync.
    if (process.env.NODE_ENV === 'production') {
      return "";
    }

    if (envBaseUrl.length > 3) {
      return envBaseUrl;
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

const config = new Configuration({
  basePath: getApiUrl(),
  baseOptions: { withCredentials: true, "credentials": "include" },
});

export const auditLogsApi = new AuditLogsApi(config, config.basePath, axiosClient);
export const authApi = new AuthApi(config, config.basePath, axiosClient);
export const settingsApi = new SettingsApi(config, config.basePath, axiosClient);
export const usersApi = new UsersApi(config, config.basePath, axiosClient);
export const moexApi = new MoexApi(config, config.basePath, axiosClient);
