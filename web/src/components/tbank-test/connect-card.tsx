"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useTBankConnectionContext,
  type TBankEnvironment,
} from "@/components/tbank-test/tbank-connection-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TBankConnectCard() {
  const { t } = useTranslation();
  const {
    status,
    loadingStatus,
    working,
    error,
    availableAccounts,
    connect,
    disconnect,
    saveDefaultAccount,
    refreshStatus,
    clearError,
  } = useTBankConnectionContext();

  const [connectToken, setConnectToken] = useState("");
  const [environment, setEnvironment] = useState<TBankEnvironment>("sandbox");
  const [defaultAccountID, setDefaultAccountID] = useState("");

  useEffect(() => {
    const nextEnvironment: TBankEnvironment =
      status?.environment === "production" ? "production" : "sandbox";
    setEnvironment(nextEnvironment);
    setDefaultAccountID(status?.default_account_id || "");
  }, [status?.environment, status?.default_account_id]);

  const onConnect = async () => {
    if (!connectToken.trim()) return;
    try {
      await connect({ token: connectToken, environment, defaultAccountID });
      setConnectToken("");
    } catch {
      // handled in context error state
    }
  };

  const onDisconnect = async () => {
    try {
      await disconnect();
      setDefaultAccountID("");
    } catch {
      // handled in context error state
    }
  };

  const onSaveDefaultAccount = async () => {
    try {
      await saveDefaultAccount(defaultAccountID);
    } catch {
      // handled in context error state
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tbankTest.connect.title")}</CardTitle>
        <CardDescription>{t("tbankTest.connect.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loadingStatus ? <div className="text-sm text-muted-foreground">{t("tbankTest.loading")}</div> : null}

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div>
            <span className="font-medium">{t("tbankTest.connect.statusLabel")} </span>
            {status?.connected ? t("tbankTest.connect.connected") : t("tbankTest.connect.notConnected")}
          </div>
          {status?.token_masked ? (
            <div className="text-muted-foreground">
              {t("tbankTest.connect.maskedToken", { token: status.token_masked })}
            </div>
          ) : null}
          {status?.default_account_id ? (
            <div className="text-muted-foreground">
              {t("tbankTest.connect.defaultAccountValue", { accountID: status.default_account_id })}
            </div>
          ) : null}
          {status?.connection_error ? <div className="text-red-600">{status.connection_error}</div> : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tbank-env">{t("tbankTest.connect.environmentLabel")}</Label>
          <select
            id="tbank-env"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={environment}
            onChange={event => setEnvironment(event.target.value as TBankEnvironment)}
          >
            <option value="sandbox">{t("tbankTest.connect.environmentSandbox")}</option>
            <option value="production">{t("tbankTest.connect.environmentProduction")}</option>
          </select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tbank-token">{t("tbankTest.connect.tokenLabel")}</Label>
          <Input
            id="tbank-token"
            type="password"
            value={connectToken}
            onChange={event => {
              setConnectToken(event.target.value);
              if (error) clearError();
            }}
            placeholder={t("tbankTest.connect.tokenPlaceholder")}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tbank-default-account">{t("tbankTest.connect.defaultAccountLabel")}</Label>
          <select
            id="tbank-default-account"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={defaultAccountID}
            onChange={event => {
              setDefaultAccountID(event.target.value);
              if (error) clearError();
            }}
          >
            <option value="">{t("tbankTest.connect.defaultAccountAuto")}</option>
            {availableAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onConnect} disabled={working || !connectToken.trim()}>
            {t("tbankTest.connect.connectButton")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDefaultAccount}
            disabled={working || !status?.connected || !defaultAccountID.trim()}
          >
            {t("tbankTest.connect.saveDefaultButton")}
          </Button>
          <Button type="button" variant="outline" onClick={onDisconnect} disabled={working || !status?.connected}>
            {t("tbankTest.connect.disconnectButton")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void refreshStatus()} disabled={working}>
            {t("tbankTest.connect.refreshButton")}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">{t("tbankTest.connect.accountsTitle")}</div>
          <div className="max-h-56 space-y-2 overflow-auto rounded-md border p-2">
            {availableAccounts.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.connect.accountsEmpty")}</div>
            ) : (
              availableAccounts.map(account => (
                <div key={account.id} className="space-y-1 rounded border p-2 text-sm">
                  <div className="font-medium">{account.id}</div>
                  <div className="text-muted-foreground">{account.name || t("tbankTest.connect.accountNoName")}</div>
                  <div className="text-muted-foreground">
                    {t("tbankTest.connect.accountTypeLabel", { value: account.type || "-" })}
                  </div>
                  <div className="text-muted-foreground">
                    {t("tbankTest.connect.accountStatusLabel", { value: account.status || "-" })}
                  </div>
                  <div className="text-muted-foreground">
                    {t("tbankTest.connect.accountAccessLabel", { value: account.access_level || "-" })}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setDefaultAccountID(account.id)}>
                      {t("tbankTest.connect.useAsDefaultButton")}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
