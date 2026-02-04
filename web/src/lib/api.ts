'use client'

import {
  AuditLogsApi,
  AuthApi,
  Configuration,
  UsersApi,
  RecognitionApi,
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
    adapter: async (c) => {
      console.log(c);
      const res = await axiosTauriApiAdapter(c);
      console.log('rrr', res);
      return res;
    }
  })
  : axios.create()
  ;

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
      let cookieMap: { [key: string]: string } = {};

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
// Determine the base URL based on environment
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const localStorageBase = localStorage.getItem(LOCAL_STORAGE_BASE_URL)
    if (localStorageBase && localStorageBase.length > 3) {
      if (localStorageBase[0] == '"') return JSON.parse(localStorageBase)
      return localStorageBase
    }
    // Client-side: use current host in production, localhost in development
    if (process.env.NODE_ENV === 'production') {
      return window.location.origin;
    } else {
      // return 'http://192.168.31.243:8080';
      return 'http://localhost:8080';
    }
  } else {
    // Server-side: use environment variable or default to localhost
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  }
};

export const getApiUrl = () => {
  return getBaseUrl() + '/api'
}

const config = new Configuration({
  basePath: getApiUrl(),
  baseOptions: { withCredentials: true, "credentials": "include" },
});

export const auditLogsApi = new AuditLogsApi(config, config.basePath, axiosClient);
export const authApi = new AuthApi(config, config.basePath, axiosClient);
export const usersApi = new UsersApi(config, config.basePath, axiosClient);
export const recognitionApi = new RecognitionApi(config, config.basePath, axiosClient);
