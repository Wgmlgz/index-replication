"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type {
  PortfolioActionResponse,
  PortfolioOperationHistoryItem,
  PortfolioProfile,
  PortfolioSummaryResponse,
} from "@/api-client";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_SANDBOX_TOP_UP_UNITS = 1_000_000;
const OPERATIONS_PAGE_SIZE = 50;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(
    value,
  );
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatEnumLabel(value: string | undefined, prefix: string): string {
  if (!value) {
    return "-";
  }
  const normalized = value.replace(prefix, "");
  return normalized
    .split("_")
    .map((token) => `${token.charAt(0)}${token.slice(1).toLowerCase()}`)
    .join(" ");
}

type PortfolioCardProps = {
  portfolioID: number | null;
  profile: PortfolioProfile | null;
};

export function PortfolioCard({ portfolioID, profile }: PortfolioCardProps) {
  const { t } = useTranslation();

  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [operations, setOperations] = useState<PortfolioOperationHistoryItem[]>(
    [],
  );
  const [operationsHasNext, setOperationsHasNext] = useState(false);
  const [operationsNextCursor, setOperationsNextCursor] = useState("");
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [loadingMoreOperations, setLoadingMoreOperations] = useState(false);
  const [operationsError, setOperationsError] = useState("");
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

  const loadOperations = useCallback(
    async (targetPortfolioID: number, cursor?: string, append = false) => {
      if (append) {
        setLoadingMoreOperations(true);
      } else {
        setLoadingOperations(true);
        setOperationsError("");
      }

      try {
        const response = (
          await portfolioApi.mePortfoliosIdOperationsGet(
            targetPortfolioID,
            cursor || undefined,
            OPERATIONS_PAGE_SIZE,
          )
        ).data;
        const items = response.items ?? [];
        setOperations((currentItems) =>
          append ? [...currentItems, ...items] : items,
        );
        setOperationsHasNext(Boolean(response.has_next));
        setOperationsNextCursor(response.next_cursor || "");
      } catch (err) {
        setOperationsError(
          parseErrorMessage(err, t("portfolio.errors.operations")),
        );
        if (!append) {
          setOperations([]);
          setOperationsHasNext(false);
          setOperationsNextCursor("");
        }
      } finally {
        if (append) {
          setLoadingMoreOperations(false);
        } else {
          setLoadingOperations(false);
        }
      }
    },
    [parseErrorMessage, t],
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
        await loadOperations(targetPortfolioID);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolio.errors.summary")));
      } finally {
        setLoadingSummary(false);
      }
    },
    [loadOperations, parseErrorMessage, t],
  );

  useEffect(() => {
    if (!portfolioID) {
      setSummary(null);
      setOperations([]);
      setOperationsHasNext(false);
      setOperationsNextCursor("");
      setOperationsError("");
      setError("");
      setActionResult(null);
      return;
    }
    void loadSummary(portfolioID);
  }, [loadSummary, portfolioID]);

  const onLoadMoreOperations = () => {
    if (!portfolioID || !operationsHasNext || !operationsNextCursor) {
      return;
    }
    void loadOperations(portfolioID, operationsNextCursor, true);
  };

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
      setError(parseErrorMessage(err, t("portfolio.errors.action")));
    } finally {
      setWorking(false);
    }
  };

  if (!portfolioID) {
    return (
      <Card className="h-full min-h-0 overflow-hidden">
        <CardHeader>
          <CardTitle>{t("portfolio.card.title")}</CardTitle>
          <CardDescription>{t("portfolio.card.description")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("portfolio.card.selectPrompt")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t("portfolio.card.title")}</CardTitle>
        <CardDescription>{t("portfolio.card.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {actionResult ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            {t("portfolio.card.actionResult", {
              action: actionResult.action || "-",
            })}
          </div>
        ) : null}

        <Tabs
          defaultValue="account"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="account">
              {t("portfolio.card.tabs.account")}
            </TabsTrigger>
            <TabsTrigger value="balance">
              {t("portfolio.card.tabs.balance")}
            </TabsTrigger>
            <TabsTrigger value="positions">
              {t("portfolio.card.tabs.positions")}
            </TabsTrigger>
            <TabsTrigger value="operations">
              {t("portfolio.card.tabs.operations")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-4 text-sm">
            <div className="rounded-md border p-3 space-y-1">
              <div>
                <span className="font-medium">
                  {t("portfolio.card.profileName")}{" "}
                </span>
                {profile?.name || "-"}
              </div>
              <div>
                <span className="font-medium">
                  {t("portfolio.card.provider")}{" "}
                </span>
                {profile?.provider || "-"}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => portfolioID && void loadSummary(portfolioID)}
                disabled={loadingSummary}
              >
                {t("portfolio.card.refreshButton")}
              </Button>
            </div>

            {actions.map((action) => {
              if (action.id === "sandbox_pay_in") {
                return (
                  <div
                    key={action.id}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="portfolio-sandbox-currency">
                        {t("portfolio.card.sandboxCurrency")}
                      </Label>
                      <Input
                        id="portfolio-sandbox-currency"
                        type="text"
                        value={sandboxCurrency}
                        onChange={(event) =>
                          setSandboxCurrency(event.target.value.toUpperCase())
                        }
                        className="w-24"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="portfolio-sandbox-units">
                        {t("portfolio.card.sandboxUnits")}
                      </Label>
                      <Input
                        id="portfolio-sandbox-units"
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
                            Number(sandboxUnits) ||
                              DEFAULT_SANDBOX_TOP_UP_UNITS,
                          ),
                        })
                      }
                      disabled={working}
                    >
                      {action.label || t("portfolio.card.runAction")}
                    </Button>
                  </div>
                );
              }

              if (action.id === "deposit_cash") {
                return (
                  <div
                    key={action.id}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="grid gap-2">
                      <Label htmlFor="portfolio-virtual-currency">
                        {t("portfolio.card.virtualTradeCurrency")}
                      </Label>
                      <Input
                        id="portfolio-virtual-currency"
                        type="text"
                        value={virtualCurrency}
                        onChange={(event) =>
                          setVirtualCurrency(event.target.value.toUpperCase())
                        }
                        className="w-24"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="portfolio-virtual-amount">
                        {t("portfolio.card.virtualDepositAmount")}
                      </Label>
                      <Input
                        id="portfolio-virtual-amount"
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
                      {action.label || t("portfolio.card.runAction")}
                    </Button>
                  </div>
                );
              }

              if (action.id === "buy" || action.id === "sell") {
                return (
                  <div
                    key={action.id}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="grid gap-2">
                      <Label
                        htmlFor={`portfolio-virtual-ticker-${action.id}`}
                      >
                        {t("portfolio.card.virtualTradeTicker")}
                      </Label>
                      <Input
                        id={`portfolio-virtual-ticker-${action.id}`}
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
                        htmlFor={`portfolio-virtual-instrument-${action.id}`}
                      >
                        {t("portfolio.card.virtualTradeInstrumentID")}
                      </Label>
                      <Input
                        id={`portfolio-virtual-instrument-${action.id}`}
                        type="text"
                        value={virtualInstrumentID}
                        onChange={(event) =>
                          setVirtualInstrumentID(
                            event.target.value.toUpperCase(),
                          )
                        }
                        className="w-36"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label
                        htmlFor={`portfolio-virtual-quantity-${action.id}`}
                      >
                        {t("portfolio.card.virtualTradeQuantity")}
                      </Label>
                      <Input
                        id={`portfolio-virtual-quantity-${action.id}`}
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
                      <Label
                        htmlFor={`portfolio-virtual-price-${action.id}`}
                      >
                        {t("portfolio.card.virtualTradePrice")}
                      </Label>
                      <Input
                        id={`portfolio-virtual-price-${action.id}`}
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
                        htmlFor={`portfolio-virtual-commission-${action.id}`}
                      >
                        {t("portfolio.card.virtualTradeCommission")}
                      </Label>
                      <Input
                        id={`portfolio-virtual-commission-${action.id}`}
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
                        htmlFor={`portfolio-virtual-currency-${action.id}`}
                      >
                        {t("portfolio.card.virtualTradeCurrency")}
                      </Label>
                      <Input
                        id={`portfolio-virtual-currency-${action.id}`}
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
                          instrument_id:
                            virtualInstrumentID.trim() || undefined,
                          quantity: Math.max(
                            0.0001,
                            Number(virtualQuantity) || 0.0001,
                          ),
                          price: Math.max(
                            0.0001,
                            Number(virtualPrice) || 0.0001,
                          ),
                          commission: Math.max(
                            0,
                            Number(virtualCommission) || 0,
                          ),
                          currency: virtualCurrency.trim() || "RUB",
                        })
                      }
                      disabled={working || !action.id}
                    >
                      {action.label ||
                        action.id ||
                        t("portfolio.card.runAction")}
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
                  {action.label || action.id || t("portfolio.card.runAction")}
                </Button>
              );
            })}

            {loadingSummary ? (
              <div className="text-sm text-muted-foreground">
                {t("portfolio.card.loading")}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="balance" className="space-y-4 text-sm">
            {loadingSummary ? (
              <div className="text-sm text-muted-foreground">
                {t("portfolio.card.loading")}
              </div>
            ) : summary ? (
              <>
                <div className="rounded-md border p-3">
                  <div>
                    <span className="font-medium">
                      {t("portfolio.card.totalLabel")}{" "}
                    </span>
                    {formatNumber(summary.total_amount_portfolio ?? 0)}{" "}
                    {summary.total_amount_currency || ""}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t("portfolio.card.dailyYieldLabel")}{" "}
                    </span>
                    {formatNumber(summary.daily_yield ?? 0)}
                  </div>
                  <div>
                    <span className="font-medium">
                      {t("portfolio.card.dailyYieldRelativeLabel")}{" "}
                    </span>
                    {formatPercent(summary.daily_yield_relative ?? 0)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium">
                    {t("portfolio.card.moneyTitle")}
                  </div>
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2">
                            {t("portfolio.card.moneyCurrency")}
                          </th>
                          <th className="p-2">
                            {t("portfolio.card.moneyAvailable")}
                          </th>
                          <th className="p-2">
                            {t("portfolio.card.moneyBlocked")}
                          </th>
                          <th className="p-2">
                            {t("portfolio.card.moneyWithdrawAvailable")}
                          </th>
                          <th className="p-2">
                            {t("portfolio.card.moneyWithdrawBlocked")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summary.money ?? []).length === 0 ? (
                          <tr>
                            <td
                              className="p-2 text-muted-foreground"
                              colSpan={5}
                            >
                              {t("portfolio.card.moneyEmpty")}
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
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t("portfolio.card.empty")}
              </div>
            )}
          </TabsContent>

          <TabsContent value="positions" className="space-y-4 text-sm">
            {loadingSummary ? (
              <div className="text-sm text-muted-foreground">
                {t("portfolio.card.loading")}
              </div>
            ) : summary ? (
              <div className="space-y-2">
                <div className="font-medium">
                  {t("portfolio.card.positionsTitle", {
                    count: Math.min((summary.positions ?? []).length, 10),
                  })}
                </div>
                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2">
                          {t("portfolio.card.positionTicker")}
                        </th>
                        <th className="p-2">
                          {t("portfolio.card.positionInstrumentID")}
                        </th>
                        <th className="p-2">
                          {t("portfolio.card.positionQuantity")}
                        </th>
                        <th className="p-2">
                          {t("portfolio.card.positionCurrentPrice")}
                        </th>
                        <th className="p-2">
                          {t("portfolio.card.positionCurrentValue")}
                        </th>
                        <th className="p-2">
                          {t("portfolio.card.positionExpectedYield")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(summary.positions ?? []).length === 0 ? (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={6}>
                            {t("portfolio.card.positionsEmpty")}
                          </td>
                        </tr>
                      ) : (
                        (summary.positions ?? [])
                          .slice(0, 10)
                          .map((position) => (
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
            ) : (
              <div className="text-sm text-muted-foreground">
                {t("portfolio.card.empty")}
              </div>
            )}
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 text-sm">
            <div className="font-medium">
              {t("portfolio.card.operationsTitle")}
            </div>
            {operationsError ? (
              <Alert variant="destructive">
                <AlertTitle>{t("common.error")}</AlertTitle>
                <AlertDescription>{operationsError}</AlertDescription>
              </Alert>
            ) : null}

            {loadingOperations ? (
              <div className="text-sm text-muted-foreground">
                {t("portfolio.card.operationsLoading")}
              </div>
            ) : (
              <div className="overflow-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2">
                        {t("portfolio.card.operationDate")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationType")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationState")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationInstrument")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationQuantity")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationPrice")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationPayment")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationCommission")}
                      </th>
                      <th className="p-2">
                        {t("portfolio.card.operationDescription")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={9}>
                          {t("portfolio.card.operationsEmpty")}
                        </td>
                      </tr>
                    ) : (
                      operations.map((operation, index) => (
                        <tr
                          key={`${operation.id || "op"}:${operation.cursor || index}:${operation.date || "-"}`}
                          className="border-t"
                        >
                          <td className="p-2">
                            {formatDateTime(operation.date)}
                          </td>
                          <td className="p-2">
                            {formatEnumLabel(operation.type, "OPERATION_TYPE_")}
                          </td>
                          <td className="p-2">
                            {formatEnumLabel(
                              operation.state,
                              "OPERATION_STATE_",
                            )}
                          </td>
                          <td className="p-2">
                            {operation.name ||
                              operation.instrument_id ||
                              operation.figi ||
                              "-"}
                          </td>
                          <td className="p-2">
                            {formatNumber(
                              operation.quantity_done ||
                                operation.quantity ||
                                0,
                            )}
                          </td>
                          <td className="p-2">
                            {formatNumber(operation.price ?? 0)}{" "}
                            {operation.price_currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(operation.payment ?? 0)}{" "}
                            {operation.payment_currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(operation.commission ?? 0)}{" "}
                            {operation.commission_currency || ""}
                          </td>
                          <td className="p-2">
                            {operation.description || "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {operationsHasNext ? (
              <Button
                type="button"
                variant="outline"
                onClick={onLoadMoreOperations}
                disabled={loadingMoreOperations}
              >
                {loadingMoreOperations
                  ? t("portfolio.card.operationsLoadingMore")
                  : t("portfolio.card.operationsLoadMore")}
              </Button>
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
