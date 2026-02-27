"use client";

import { useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type { TBankInstrumentLookupResponse } from "@/api-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/error-utils";
import { tbankApi } from "@/lib/api";

export function TBankInstrumentLookupCard() {
  const { t } = useTranslation();

  const [lookupTicker, setLookupTicker] = useState("");
  const [lookupClassCode, setLookupClassCode] = useState("");
  const [lookupResult, setLookupResult] = useState<TBankInstrumentLookupResponse | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [error, setError] = useState("");

  const parseErrorMessage = (err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  };

  const onLookupInstrument = async () => {
    if (!lookupTicker.trim()) {
      setError(t("tbankTest.errors.lookup"));
      return;
    }

    setError("");
    setLoadingLookup(true);
    setLookupResult(null);
    try {
      const result = (await tbankApi.meTbankInstrumentsLookupGet(
        lookupTicker.trim(),
        lookupClassCode.trim() || undefined
      )).data;
      setLookupResult(result);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.lookup")));
    } finally {
      setLoadingLookup(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tbankTest.lookup.title")}</CardTitle>
        <CardDescription>{t("tbankTest.lookup.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="tbank-lookup-ticker">{t("tbankTest.lookup.tickerLabel")}</Label>
          <Input
            id="tbank-lookup-ticker"
            type="text"
            value={lookupTicker}
            onChange={event => setLookupTicker(event.target.value.toUpperCase())}
            placeholder={t("tbankTest.lookup.tickerPlaceholder")}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tbank-lookup-class-code">{t("tbankTest.lookup.classCodeLabel")}</Label>
          <Input
            id="tbank-lookup-class-code"
            type="text"
            value={lookupClassCode}
            onChange={event => setLookupClassCode(event.target.value.toUpperCase())}
            placeholder={t("tbankTest.lookup.classCodePlaceholder")}
          />
        </div>

        <Button type="button" onClick={() => void onLookupInstrument()} disabled={loadingLookup || !lookupTicker.trim()}>
          {t("tbankTest.lookup.searchButton")}
        </Button>

        {loadingLookup ? <div className="text-sm text-muted-foreground">{t("tbankTest.lookup.loading")}</div> : null}

        {lookupResult ? (
          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t("tbankTest.lookup.resultCount", { count: (lookupResult.instruments ?? []).length })}
            </div>
            <div className="max-h-96 space-y-2 overflow-auto rounded-md border p-2">
              {(lookupResult.instruments ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("tbankTest.lookup.empty")}</div>
              ) : (
                (lookupResult.instruments ?? []).map(item => (
                  <div key={`${item.instrument_id}:${item.ticker}`} className="space-y-1 rounded border p-2 text-sm">
                    <div className="font-medium">{item.name || t("tbankTest.lookup.noName")}</div>
                    <div className="text-muted-foreground">
                      {item.ticker} {item.class_code ? `(${item.class_code})` : ""}
                    </div>
                    <div>
                      <span className="font-medium">{t("tbankTest.lookup.instrumentIdLabel")} </span>
                      {item.instrument_id}
                    </div>
                    <div className="text-muted-foreground">UID: {item.uid || "-"}</div>
                    <div className="text-muted-foreground">FIGI: {item.figi || "-"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
