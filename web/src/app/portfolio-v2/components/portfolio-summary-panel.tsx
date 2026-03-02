"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type {
  PortfolioActionResponse,
  PortfolioSummaryResponse,
} from "@/api-client";
import type { NormalizedPortfolioProfile } from "@/app/portfolio-v2/use-portfolio-v2";
import { portfolioApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SANDBOX_TOP_UP_UNITS,
  formatNumber,
  formatPercent,
} from "@/app/portfolio-v2/components/portfolio-formatting";

type PortfolioSummaryPanelProps = {
  portfolioID: number | null;
  profile: NormalizedPortfolioProfile | null;
};

export function PortfolioSummaryPanel({
  portfolioID,
  profile,
}: PortfolioSummaryPanelProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] =
    useState<PortfolioActionResponse | null>(null);

  const [sandboxCurrency, setSandboxCurrency] = useState("RUB");
  const [sandboxUnits, setSandboxUnits] = useState(
    DEFAULT_SANDBOX_TOP_UP_UNITS,
  );
  const [virtualCurrency, setVirtualCurrency] = useState("RUB");
  const [virtualAmount, setVirtualAmount] = useState(10000);
  const [virtualTicker, setVirtualTicker] = useState("");
  const [virtualInstrumentID, setVirtualInstrumentID] = useState("");
  const [virtualQuantity, setVirtualQuantity] = useState(1);
  const [virtualPrice, setVirtualPrice] = useState(100);
  const [virtualCommission, setVirtualCommission] = useState(0);

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const actions = useMemo(
    () => profile?.capabilities?.actions ?? [],
    [profile?.capabilities?.actions],
  );

  const loadSummary = useCallback(
    async (targetPortfolioID: number) => {
      setError("");
      setLoadingSummary(true);
      setActionResult(null);
      try {
        const nextSummary = (
          await portfolioApi.mePortfoliosIdSummaryGet(targetPortfolioID)
        ).data;
        setSummary(nextSummary);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolioV2.errors.summary")));
      } finally {
        setLoadingSummary(false);
      }
    },
    [parseErrorMessage, t],
  );

  useEffect(() => {
    if (!portfolioID) {
      setSummary(null);
      setError("");
      setActionResult(null);
      return;
    }

    void loadSummary(portfolioID);
  }, [loadSummary, portfolioID]);

  const runAction = async (
    actionID: string,
    payload?: Record<string, unknown>,
  ) => {
    if (!portfolioID) {
      return;
    }

    setError("");
    setWorking(true);
    try {
      const response = (
        await portfolioApi.mePortfoliosIdActionsActionPost(
          portfolioID,
          actionID,
          {
            payload: payload ?? {},
          },
        )
      ).data;
      setActionResult(response);
      await loadSummary(portfolioID);
    } catch (err) {
      setError(parseErrorMessage(err, t("portfolioV2.errors.action")));
    } finally {
      setWorking(false);
    }
  };

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("portfolioV2.overview.summaryTitle")}</CardTitle>
          <CardDescription>
            {t("portfolioV2.overview.summaryDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("portfolioV2.card.selectPrompt")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t("portfolioV2.overview.summaryTitle")}</CardTitle>
        <CardDescription>
          {t("portfolioV2.overview.summaryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {actionResult ? (
          <div className="rounded-md border bg-muted/40 p-3">
            {t("portfolioV2.card.actionResult", {
              action: actionResult.action || "-",
            })}
          </div>
        ) : null}

        <div className="space-y-2 rounded-md border p-3">
          <div className="font-medium">
            {t("portfolioV2.overview.quickActionsTitle")}
          </div>
          <div>
            <span className="font-medium">
              {t("portfolioV2.card.profileName")}{" "}
            </span>
            {profile?.name || "-"}
          </div>
          <div>
            <span className="font-medium">
              {t("portfolioV2.card.provider")}{" "}
            </span>
            {profile?.provider || "-"}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => portfolioID && void loadSummary(portfolioID)}
              disabled={loadingSummary}
            >
              {t("portfolioV2.card.refreshButton")}
            </Button>

            {actions.length === 0 ? (
              <span className="self-center text-muted-foreground">
                {t("portfolioV2.overview.noQuickActions")}
              </span>
            ) : null}
          </div>

          {actions.map((action) => {
            if (action.id === "sandbox_pay_in") {
              return (
                <div key={action.id} className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="portfolio-v2-sandbox-currency">
                      {t("portfolioV2.card.sandboxCurrency")}
                    </Label>
                    <Input
                      id="portfolio-v2-sandbox-currency"
                      type="text"
                      value={sandboxCurrency}
                      onChange={(event) =>
                        setSandboxCurrency(event.target.value.toUpperCase())
                      }
                      className="w-24"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="portfolio-v2-sandbox-units">
                      {t("portfolioV2.card.sandboxUnits")}
                    </Label>
                    <Input
                      id="portfolio-v2-sandbox-units"
                      type="number"
                      min={1}
                      value={sandboxUnits}
                      onChange={(event) =>
                        setSandboxUnits(
                          Math.max(
                            1,
                            Number(event.target.value) ||
                              DEFAULT_SANDBOX_TOP_UP_UNITS,
                          ),
                        )
                      }
                      className="w-40"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() =>
                      void runAction(action.id || "sandbox_pay_in", {
                        currency: sandboxCurrency.trim() || "RUB",
                        units: Math.max(
                          1,
                          Number(sandboxUnits) || DEFAULT_SANDBOX_TOP_UP_UNITS,
                        ),
                      })
                    }
                    disabled={working}
                  >
                    {action.label || t("portfolioV2.card.runAction")}
                  </Button>
                </div>
              );
            }

            if (action.id === "deposit_cash") {
              return (
                <div key={action.id} className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="portfolio-v2-virtual-currency">
                      {t("portfolioV2.card.virtualTradeCurrency")}
                    </Label>
                    <Input
                      id="portfolio-v2-virtual-currency"
                      type="text"
                      value={virtualCurrency}
                      onChange={(event) =>
                        setVirtualCurrency(event.target.value.toUpperCase())
                      }
                      className="w-24"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="portfolio-v2-virtual-amount">
                      {t("portfolioV2.card.virtualDepositAmount")}
                    </Label>
                    <Input
                      id="portfolio-v2-virtual-amount"
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={virtualAmount}
                      onChange={(event) =>
                        setVirtualAmount(Number(event.target.value) || 0)
                      }
                      className="w-40"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() =>
                      void runAction(action.id || "deposit_cash", {
                        currency: virtualCurrency.trim() || "RUB",
                        amount: Math.max(0.01, Number(virtualAmount) || 0.01),
                      })
                    }
                    disabled={working}
                  >
                    {action.label || t("portfolioV2.card.runAction")}
                  </Button>
                </div>
              );
            }

            if (action.id === "buy" || action.id === "sell") {
              return (
                <div key={action.id} className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`portfolio-v2-virtual-ticker-${action.id}`}>
                      {t("portfolioV2.card.virtualTradeTicker")}
                    </Label>
                    <Input
                      id={`portfolio-v2-virtual-ticker-${action.id}`}
                      type="text"
                      value={virtualTicker}
                      onChange={(event) =>
                        setVirtualTicker(event.target.value.toUpperCase())
                      }
                      className="w-28"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor={`portfolio-v2-virtual-instrument-${action.id}`}
                    >
                      {t("portfolioV2.card.virtualTradeInstrumentID")}
                    </Label>
                    <Input
                      id={`portfolio-v2-virtual-instrument-${action.id}`}
                      type="text"
                      value={virtualInstrumentID}
                      onChange={(event) =>
                        setVirtualInstrumentID(event.target.value.toUpperCase())
                      }
                      className="w-36"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor={`portfolio-v2-virtual-quantity-${action.id}`}
                    >
                      {t("portfolioV2.card.virtualTradeQuantity")}
                    </Label>
                    <Input
                      id={`portfolio-v2-virtual-quantity-${action.id}`}
                      type="number"
                      min={0.0001}
                      step="0.0001"
                      value={virtualQuantity}
                      onChange={(event) =>
                        setVirtualQuantity(Number(event.target.value) || 0)
                      }
                      className="w-28"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`portfolio-v2-virtual-price-${action.id}`}>
                      {t("portfolioV2.card.virtualTradePrice")}
                    </Label>
                    <Input
                      id={`portfolio-v2-virtual-price-${action.id}`}
                      type="number"
                      min={0.0001}
                      step="0.0001"
                      value={virtualPrice}
                      onChange={(event) =>
                        setVirtualPrice(Number(event.target.value) || 0)
                      }
                      className="w-28"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor={`portfolio-v2-virtual-commission-${action.id}`}
                    >
                      {t("portfolioV2.card.virtualTradeCommission")}
                    </Label>
                    <Input
                      id={`portfolio-v2-virtual-commission-${action.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={virtualCommission}
                      onChange={(event) =>
                        setVirtualCommission(Number(event.target.value) || 0)
                      }
                      className="w-28"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label
                      htmlFor={`portfolio-v2-virtual-currency-${action.id}`}
                    >
                      {t("portfolioV2.card.virtualTradeCurrency")}
                    </Label>
                    <Input
                      id={`portfolio-v2-virtual-currency-${action.id}`}
                      type="text"
                      value={virtualCurrency}
                      onChange={(event) =>
                        setVirtualCurrency(event.target.value.toUpperCase())
                      }
                      className="w-24"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() =>
                      void runAction(action.id || "", {
                        ticker: virtualTicker.trim() || undefined,
                        instrument_id: virtualInstrumentID.trim() || undefined,
                        quantity: Math.max(
                          0.0001,
                          Number(virtualQuantity) || 0.0001,
                        ),
                        price: Math.max(0.0001, Number(virtualPrice) || 0.0001),
                        commission: Math.max(0, Number(virtualCommission) || 0),
                        currency: virtualCurrency.trim() || "RUB",
                      })
                    }
                    disabled={working || !action.id}
                  >
                    {action.label ||
                      action.id ||
                      t("portfolioV2.card.runAction")}
                  </Button>
                </div>
              );
            }

            return (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                onClick={() => void runAction(action.id || "")}
                disabled={working || !action.id}
              >
                {action.label || action.id || t("portfolioV2.card.runAction")}
              </Button>
            );
          })}
        </div>

        {loadingSummary ? (
          <div className="text-muted-foreground">
            {t("portfolioV2.card.loading")}
          </div>
        ) : summary ? (
          <>
            <div className="space-y-2">
              <div className="font-medium">
                {t("portfolioV2.overview.balancesTitle")}
              </div>
              <div className="rounded-md border p-3">
                <div>
                  <span className="font-medium">
                    {t("portfolioV2.card.totalLabel")}{" "}
                  </span>
                  {formatNumber(summary.total_amount_portfolio ?? 0)}{" "}
                  {summary.total_amount_currency || ""}
                </div>
                <div>
                  <span className="font-medium">
                    {t("portfolioV2.card.dailyYieldLabel")}{" "}
                  </span>
                  {formatNumber(summary.daily_yield ?? 0)}
                </div>
                <div>
                  <span className="font-medium">
                    {t("portfolioV2.card.dailyYieldRelativeLabel")}{" "}
                  </span>
                  {formatPercent(summary.daily_yield_relative ?? 0)}
                </div>
              </div>

              <div className="overflow-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2">
                        {t("portfolioV2.card.moneyCurrency")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.moneyAvailable")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.moneyBlocked")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.moneyWithdrawAvailable")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.moneyWithdrawBlocked")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.money ?? []).length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={5}>
                          {t("portfolioV2.card.moneyEmpty")}
                        </td>
                      </tr>
                    ) : (
                      (summary.money ?? []).map((balance) => (
                        <tr key={balance.currency} className="border-t">
                          <td className="p-2">{balance.currency}</td>
                          <td className="p-2">
                            {formatNumber(balance.available ?? 0)}
                          </td>
                          <td className="p-2">
                            {formatNumber(balance.blocked ?? 0)}
                          </td>
                          <td className="p-2">
                            {formatNumber(balance.withdraw_available ?? 0)}
                          </td>
                          <td className="p-2">
                            {formatNumber(balance.withdraw_blocked ?? 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">
                {t("portfolioV2.card.positionsTitle", {
                  count: Math.min((summary.positions ?? []).length, 10),
                })}
              </div>
              <div className="overflow-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2">
                        {t("portfolioV2.card.positionTicker")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.positionInstrumentID")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.positionQuantity")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.positionCurrentPrice")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.positionCurrentValue")}
                      </th>
                      <th className="p-2">
                        {t("portfolioV2.card.positionExpectedYield")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.positions ?? []).length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={6}>
                          {t("portfolioV2.card.positionsEmpty")}
                        </td>
                      </tr>
                    ) : (
                      (summary.positions ?? []).slice(0, 10).map((position) => (
                        <tr
                          key={`${position.instrument_id || "-"}:${position.ticker || "-"}`}
                          className="border-t"
                        >
                          <td className="p-2">{position.ticker || "-"}</td>
                          <td className="p-2">
                            {position.instrument_id || "-"}
                          </td>
                          <td className="p-2">
                            {formatNumber(position.quantity ?? 0)}
                          </td>
                          <td className="p-2">
                            {formatNumber(position.current_price ?? 0)}{" "}
                            {position.currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(position.current_value ?? 0)}{" "}
                            {position.currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(position.expected_yield ?? 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="text-muted-foreground">
            {t("portfolioV2.card.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
