"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import { tbankClient, type TBankTestBuyResponse } from "@/lib/tbank-client";
import { useTBankConnectionContext } from "@/components/tbank-test/tbank-connection-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/error-utils";

export function TBankBuyCard() {
  const { t } = useTranslation();
  const { status, availableAccounts, connected } = useTBankConnectionContext();

  const [instrumentID, setInstrumentID] = useState("");
  const [orderAccountID, setOrderAccountID] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [buyResult, setBuyResult] = useState<TBankTestBuyResponse | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const resolvedAccountID = useMemo(() => {
    return orderAccountID || status?.default_account_id || "";
  }, [orderAccountID, status?.default_account_id]);

  useEffect(() => {
    if (connected) return;
    setBuyResult(null);
    setError("");
  }, [connected]);

  const parseErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
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
    <Card>
      <CardHeader>
        <CardTitle>{t("tbankTest.buy.title")}</CardTitle>
        <CardDescription>{t("tbankTest.buy.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Alert>
          <AlertTitle>{t("tbankTest.buy.mappingTitle")}</AlertTitle>
          <AlertDescription>{t("tbankTest.buy.mappingHint")}</AlertDescription>
        </Alert>

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
          <select
            id="tbank-account"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={orderAccountID}
            onChange={event => setOrderAccountID(event.target.value)}
          >
            <option value="">{t("tbankTest.buy.accountDefaultOption")}</option>
            {availableAccounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.id}
              </option>
            ))}
          </select>
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
          onClick={() => void onTestBuy()}
          disabled={working || !connected || !instrumentID.trim()}
          className="w-full"
        >
          {t("tbankTest.buy.submitButton")}
        </Button>

        {buyResult ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <div>
              <span className="font-medium">{t("tbankTest.buy.resultOrderId")} </span>
              {buyResult.order_id || "-"}
            </div>
            <div>
              <span className="font-medium">{t("tbankTest.buy.resultStatus")} </span>
              {buyResult.execution_report_status || "-"}
            </div>
            <pre className="bg-muted overflow-auto rounded p-2 text-xs">
              {JSON.stringify(buyResult.response || buyResult, null, 2)}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
