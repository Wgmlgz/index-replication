"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
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

const TBANK_STATUS_QUERY_KEY = ["auth", "tbank-status"];

export function TBankConnectionProvider({ children }: TBankConnectionProviderProps) {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();
  const { t } = useTranslation();
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

  const {
    data: statusData,
    isPending,
    error: statusQueryError,
    refetch,
  } = useQuery<TBankConnectionStatusResponse | null>({
    queryKey: TBANK_STATUS_QUERY_KEY,
    queryFn: async () => {
      try {
        return (await tbankApi.meTbankGet()).data;
      } catch (err) {
        if (
          axios.isAxiosError(err) &&
          err.response?.status === axios.HttpStatusCode.Unauthorized
        ) {
          return null;
        }
        throw err;
      }
    },
    retry: false,
    initialData: () =>
      queryClient.getQueryData<TBankConnectionStatusResponse | null>(
        TBANK_STATUS_QUERY_KEY,
      ),
    refetchOnMount: "always",
  });

  const refreshStatus = useCallback(async () => {
    setError("");
    const result = await refetch();
    if (result.error) {
      setError(parseErrorMessage(result.error, t("tbankTest.errors.status")));
    }
  }, [parseErrorMessage, refetch, t]);

  useEffect(() => {
    if (!statusQueryError) {
      return;
    }
    setError(parseErrorMessage(statusQueryError, t("tbankTest.errors.status")));
  }, [parseErrorMessage, statusQueryError, t]);

  const status = statusData ?? null;
  const loadingStatus =
    (isRestoring && statusData === undefined) || (isPending && statusData === undefined);

  const connect = async ({ token, environment, defaultAccountID }: ConnectParams) => {
    setError("");
    setWorking(true);
    try {
      const nextStatus = (await tbankApi.meTbankConnectPost({
        token,
        environment,
        default_account_id: defaultAccountID || undefined,
      })).data;
      queryClient.setQueryData(TBANK_STATUS_QUERY_KEY, nextStatus);
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === axios.HttpStatusCode.Unauthorized
      ) {
        queryClient.setQueryData(TBANK_STATUS_QUERY_KEY, null);
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
      queryClient.setQueryData(TBANK_STATUS_QUERY_KEY, null);
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
      queryClient.setQueryData(TBANK_STATUS_QUERY_KEY, nextStatus);
    } catch (err) {
      if (
        axios.isAxiosError(err) &&
        err.response?.status === axios.HttpStatusCode.Unauthorized
      ) {
        queryClient.setQueryData(TBANK_STATUS_QUERY_KEY, null);
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
