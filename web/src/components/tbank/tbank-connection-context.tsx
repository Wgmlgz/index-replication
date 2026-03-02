"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type { TBankConnectionStatusResponse } from "@/api-client";
import { tbankApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";

export type TBankEnvironment = "sandbox" | "production";

type ConnectParams = {
  token: string;
  environment: TBankEnvironment;
  defaultAccountID?: string;
};

type TBankConnectionContextValue = {
  status: TBankConnectionStatusResponse | null;
  loadingStatus: boolean;
  working: boolean;
  error: string;
  availableAccounts: NonNullable<TBankConnectionStatusResponse["accounts"]>;
  connected: boolean;
  refreshStatus: () => Promise<void>;
  connect: (params: ConnectParams) => Promise<void>;
  disconnect: () => Promise<void>;
  saveDefaultAccount: (accountID: string) => Promise<void>;
  clearError: () => void;
};

const TBankConnectionContext = createContext<TBankConnectionContextValue | null>(null);

type TBankConnectionProviderProps = {
  children: ReactNode;
};

const TBANK_STATUS_CACHE_KEY = "index-replication-tbank-status-v1";

function readCachedTBankStatus(): TBankConnectionStatusResponse | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(TBANK_STATUS_CACHE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as TBankConnectionStatusResponse | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedTBankStatus(status: TBankConnectionStatusResponse | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!status || !status.connected) {
    window.localStorage.removeItem(TBANK_STATUS_CACHE_KEY);
    return;
  }

  window.localStorage.setItem(TBANK_STATUS_CACHE_KEY, JSON.stringify(status));
}

export function TBankConnectionProvider({ children }: TBankConnectionProviderProps) {
  const { t } = useTranslation();
  const cachedStatus = useMemo(() => readCachedTBankStatus(), []);
  const [status, setStatus] = useState<TBankConnectionStatusResponse | null>(cachedStatus);
  const [loadingStatus, setLoadingStatus] = useState(!cachedStatus);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const loadStatus = useCallback(async (background = false) => {
    setError("");
    if (!background) {
      setLoadingStatus(true);
    }
    try {
      const nextStatus = (await tbankApi.meTbankGet()).data;
      setStatus(nextStatus);
      writeCachedTBankStatus(nextStatus);
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === axios.HttpStatusCode.Unauthorized
      ) {
        setStatus(null);
        writeCachedTBankStatus(null);
      }
      setError(parseErrorMessage(err, t("tbankTest.errors.status")));
    } finally {
      if (!background) {
        setLoadingStatus(false);
      }
    }
  }, [parseErrorMessage, t]);

  const refreshStatus = useCallback(async () => {
    await loadStatus(false);
  }, [loadStatus]);

  useEffect(() => {
    void loadStatus(Boolean(cachedStatus));
  }, [cachedStatus, loadStatus]);

  const connect = async ({ token, environment, defaultAccountID }: ConnectParams) => {
    setError("");
    setWorking(true);
    try {
      const nextStatus = (await tbankApi.meTbankConnectPost({
        token,
        environment,
        default_account_id: defaultAccountID || undefined,
      })).data;
      setStatus(nextStatus);
      writeCachedTBankStatus(nextStatus);
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === axios.HttpStatusCode.Unauthorized
      ) {
        setStatus(null);
        writeCachedTBankStatus(null);
      }
      setError(parseErrorMessage(err, t("tbankTest.errors.connect")));
      throw err;
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    setError("");
    setWorking(true);
    try {
      await tbankApi.meTbankDisconnectPost();
      setStatus(null);
      writeCachedTBankStatus(null);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.disconnect")));
      throw err;
    } finally {
      setWorking(false);
    }
  };

  const saveDefaultAccount = async (accountID: string) => {
    if (!accountID.trim()) {
      setError(t("tbankTest.errors.defaultAccount"));
      return;
    }

    setError("");
    setWorking(true);
    try {
      const nextStatus = (await tbankApi.meTbankDefaultAccountPost({ account_id: accountID.trim() })).data;
      setStatus(nextStatus);
      writeCachedTBankStatus(nextStatus);
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === axios.HttpStatusCode.Unauthorized
      ) {
        setStatus(null);
        writeCachedTBankStatus(null);
      }
      setError(parseErrorMessage(err, t("tbankTest.errors.defaultAccount")));
      throw err;
    } finally {
      setWorking(false);
    }
  };

  const value: TBankConnectionContextValue = {
    status,
    loadingStatus,
    working,
    error,
    availableAccounts: status?.accounts ?? [],
    connected: Boolean(status?.connected),
    refreshStatus,
    connect,
    disconnect,
    saveDefaultAccount,
    clearError: () => setError(""),
  };

  return (
    <TBankConnectionContext.Provider value={value}>{children}</TBankConnectionContext.Provider>
  );
}

export function useTBankConnectionContext() {
  const context = useContext(TBankConnectionContext);
  if (!context) {
    throw new Error("useTBankConnectionContext must be used within TBankConnectionProvider");
  }
  return context;
}
