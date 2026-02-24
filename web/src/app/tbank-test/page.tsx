"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import { tbankClient, type TBankConnectionStatusResponse, type TBankTestBuyResponse } from "@/lib/tbank-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TBankSetupInstructions } from "@/components/tbank-test/setup-instructions";

type Environment = "sandbox" | "production";

export default function TBankTestPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TBankConnectionStatusResponse | null>(null);
  const [buyResult, setBuyResult] = useState<TBankTestBuyResponse | null>(null);
  const [error, setError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [working, setWorking] = useState(false);
  const [connectToken, setConnectToken] = useState("");
  const [environment, setEnvironment] = useState<Environment>("sandbox");
  const [defaultAccountID, setDefaultAccountID] = useState("");
  const [instrumentID, setInstrumentID] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderAccountID, setOrderAccountID] = useState("");

  const availableAccounts = status?.accounts ?? [];

  const resolvedAccountID = useMemo(() => {
    return orderAccountID || defaultAccountID || status?.default_account_id || "";
  }, [defaultAccountID, orderAccountID, status?.default_account_id]);

  const parseErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = err.response?.data?.error;
      if (typeof apiError === "string" && apiError.length > 0) {
        return apiError;
      }
    }
    return fallback;
  };

  const loadStatus = async () => {
    setError("");
    setLoadingStatus(true);
    try {
      const nextStatus = await tbankClient.getStatus();
      const nextEnvironment: Environment =
        nextStatus.environment === "production" ? "production" : "sandbox";
      setStatus(nextStatus);
      setEnvironment(nextEnvironment);
      setDefaultAccountID(nextStatus.default_account_id || "");
      if (!orderAccountID && nextStatus.default_account_id) {
        setOrderAccountID(nextStatus.default_account_id);
      }
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.status")));
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const onConnect = async () => {
    setError("");
    setWorking(true);
    setBuyResult(null);
    try {
      const nextStatus = await tbankClient.connect({
        token: connectToken,
        environment,
        default_account_id: defaultAccountID || undefined,
      });
      setStatus(nextStatus);
      setDefaultAccountID(nextStatus.default_account_id || "");
      setOrderAccountID(nextStatus.default_account_id || "");
      setConnectToken("");
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.connect")));
    } finally {
      setWorking(false);
    }
  };

  const onDisconnect = async () => {
    setError("");
    setWorking(true);
    setBuyResult(null);
    try {
      await tbankClient.disconnect();
      await loadStatus();
      setDefaultAccountID("");
      setOrderAccountID("");
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.disconnect")));
    } finally {
      setWorking(false);
    }
  };

  const onTestBuy = async () => {
    setError("");
    setWorking(true);
    setBuyResult(null);
    try {
      const result = await tbankClient.testBuy({
        account_id: resolvedAccountID || undefined,
        instrument_id: instrumentID,
        quantity: orderQuantity,
      });
      setBuyResult(result);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.buy")));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("tbankTest.title")}</h1>
        <p className="text-muted-foreground">{t("tbankTest.description")}</p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <TBankSetupInstructions />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("tbankTest.connect.title")}</CardTitle>
            <CardDescription>{t("tbankTest.connect.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              {status?.connection_error ? (
                <div className="text-red-600">{status.connection_error}</div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tbank-env">{t("tbankTest.connect.environmentLabel")}</Label>
              <select
                id="tbank-env"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={environment}
                onChange={event => setEnvironment(event.target.value as Environment)}
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
                onChange={event => setConnectToken(event.target.value)}
                placeholder={t("tbankTest.connect.tokenPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tbank-default-account">{t("tbankTest.connect.defaultAccountLabel")}</Label>
              <Input
                id="tbank-default-account"
                type="text"
                value={defaultAccountID}
                onChange={event => setDefaultAccountID(event.target.value)}
                placeholder={t("tbankTest.connect.defaultAccountPlaceholder")}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onConnect} disabled={working || !connectToken.trim()}>
                {t("tbankTest.connect.connectButton")}
              </Button>
              <Button type="button" variant="outline" onClick={onDisconnect} disabled={working || !status?.connected}>
                {t("tbankTest.connect.disconnectButton")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void loadStatus()} disabled={working}>
                {t("tbankTest.connect.refreshButton")}
              </Button>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">{t("tbankTest.connect.accountsTitle")}</div>
              <div className="max-h-48 space-y-2 overflow-auto rounded-md border p-2">
                {availableAccounts.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{t("tbankTest.connect.accountsEmpty")}</div>
                ) : (
                  availableAccounts.map(account => (
                    <div key={account.id} className="rounded border p-2 text-sm">
                      <div><span className="font-medium">{account.id}</span></div>
                      <div className="text-muted-foreground">{account.name || t("tbankTest.connect.accountNoName")}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("tbankTest.buy.title")}</CardTitle>
            <CardDescription>{t("tbankTest.buy.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="tbank-instrument">{t("tbankTest.buy.instrumentLabel")}</Label>
              <Input
                id="tbank-instrument"
                type="text"
                value={instrumentID}
                onChange={event => setInstrumentID(event.target.value)}
                placeholder={t("tbankTest.buy.instrumentPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tbank-account">{t("tbankTest.buy.accountLabel")}</Label>
              <Input
                id="tbank-account"
                type="text"
                value={orderAccountID}
                onChange={event => setOrderAccountID(event.target.value)}
                placeholder={t("tbankTest.buy.accountPlaceholder")}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tbank-qty">{t("tbankTest.buy.quantityLabel")}</Label>
              <Input
                id="tbank-qty"
                type="number"
                min={1}
                value={orderQuantity}
                onChange={event => setOrderQuantity(Math.max(1, Number(event.target.value) || 1))}
              />
            </div>

            <Button
              type="button"
              onClick={onTestBuy}
              disabled={working || !status?.connected || !instrumentID.trim()}
              className="w-full"
            >
              {t("tbankTest.buy.submitButton")}
            </Button>

            {buyResult ? (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <div><span className="font-medium">{t("tbankTest.buy.resultOrderId")} </span>{buyResult.order_id || "-"}</div>
                <div><span className="font-medium">{t("tbankTest.buy.resultStatus")} </span>{buyResult.execution_report_status || "-"}</div>
                <pre className="bg-muted overflow-auto rounded p-2 text-xs">{JSON.stringify(buyResult.response || buyResult, null, 2)}</pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
