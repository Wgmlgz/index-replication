"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import { tbankClient, type TBankConnectionStatusResponse } from "@/lib/tbank-client";
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
  availableAccounts: TBankConnectionStatusResponse["accounts"];
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

export function TBankConnectionProvider({ children }: TBankConnectionProviderProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TBankConnectionStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
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

  const refreshStatus = useCallback(async () => {
    setError("");
    setLoadingStatus(true);
    try {
      const nextStatus = await tbankClient.getStatus();
      setStatus(nextStatus);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.status")));
    } finally {
      setLoadingStatus(false);
    }
  }, [parseErrorMessage, t]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const connect = async ({ token, environment, defaultAccountID }: ConnectParams) => {
    setError("");
    setWorking(true);
    try {
      const nextStatus = await tbankClient.connect({
        token,
        environment,
        default_account_id: defaultAccountID || undefined,
      });
      setStatus(nextStatus);
    } catch (err) {
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
      await tbankClient.disconnect();
      await refreshStatus();
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
      const nextStatus = await tbankClient.setDefaultAccount({ account_id: accountID.trim() });
      setStatus(nextStatus);
    } catch (err) {
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
