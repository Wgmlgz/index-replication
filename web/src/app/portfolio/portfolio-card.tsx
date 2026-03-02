"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import {
  type TBankAccountPortfolioResponse,
  type TBankOperationHistoryItem,
  type TBankSandboxPayInResponse,
} from "@/api-client";
import { usePortfolioAccountContext } from "@/app/portfolio/portfolio-account-context";
import { tbankApi } from "@/lib/api";
import { useTBankConnectionContext } from "@/components/tbank/tbank-connection-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApiErrorMessage } from "@/lib/error-utils";

const DEFAULT_SANDBOX_TOP_UP_UNITS = 1_000_000;
const OPERATIONS_PAGE_SIZE = 50;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
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
    .map(token => `${token.charAt(0)}${token.slice(1).toLowerCase()}`)
    .join(" ");
}

export function TBankPortfolioCard() {
  const { t } = useTranslation();
  const { status, availableAccounts, connected } = useTBankConnectionContext();
  const { accountID: portfolioAccountID, setAccountID: setPortfolioAccountID } = usePortfolioAccountContext();

  const [portfolio, setPortfolio] = useState<TBankAccountPortfolioResponse | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [operations, setOperations] = useState<TBankOperationHistoryItem[]>([]);
  const [operationsHasNext, setOperationsHasNext] = useState(false);
  const [operationsNextCursor, setOperationsNextCursor] = useState("");
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [loadingMoreOperations, setLoadingMoreOperations] = useState(false);
  const [operationsError, setOperationsError] = useState("");

  const [sandboxCurrency, setSandboxCurrency] = useState("RUB");
  const [sandboxUnits, setSandboxUnits] = useState(DEFAULT_SANDBOX_TOP_UP_UNITS);
  const [sandboxResult, setSandboxResult] = useState<TBankSandboxPayInResponse | null>(null);

  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const isSandbox = status?.environment === "sandbox";

  const resolvedAccountID = useMemo(() => {
    return portfolioAccountID || status?.default_account_id || "";
  }, [portfolioAccountID, status?.default_account_id]);

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const loadOperations = useCallback(async (accountID?: string, cursor?: string, append = false) => {
    if (!connected) {
      setOperations([]);
      setOperationsHasNext(false);
      setOperationsNextCursor("");
      return;
    }

    if (append) {
      setLoadingMoreOperations(true);
    } else {
      setLoadingOperations(true);
      setOperationsError("");
    }

    try {
      const response = (await tbankApi.meTbankOperationsGet(
        accountID || undefined,
        cursor || undefined,
        OPERATIONS_PAGE_SIZE
      )).data;
      const items = response.items ?? [];
      setOperations(currentItems => (append ? [...currentItems, ...items] : items));
      setOperationsHasNext(Boolean(response.has_next));
      setOperationsNextCursor(response.next_cursor || "");
    } catch (err) {
      setOperationsError(parseErrorMessage(err, t("tbankTest.errors.operations")));
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
  }, [connected, parseErrorMessage, t]);

  const loadPortfolio = useCallback(async (accountID?: string) => {
    if (!connected) {
      setPortfolio(null);
      return;
    }

    setError("");
    setLoadingPortfolio(true);
    try {
      const nextPortfolio = (await tbankApi.meTbankPortfolioGet(accountID || undefined)).data;
      setPortfolio(nextPortfolio);
      setPortfolioAccountID(nextPortfolio.account_id || "");
      await loadOperations(nextPortfolio.account_id || accountID || undefined);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.portfolio")));
    } finally {
      setLoadingPortfolio(false);
    }
  }, [connected, loadOperations, parseErrorMessage, setPortfolioAccountID, t]);

  useEffect(() => {
    if (!connected) {
      setPortfolio(null);
      setOperations([]);
      setOperationsHasNext(false);
      setOperationsNextCursor("");
      setOperationsError("");
      setSandboxResult(null);
      setError("");
      return;
    }
    void loadPortfolio(status?.default_account_id || undefined);
  }, [connected, loadPortfolio, status?.default_account_id]);

  const onSandboxPayIn = async () => {
    setError("");
    setWorking(true);
    setSandboxResult(null);
    try {
      const result = (await tbankApi.meTbankSandboxPayInPost({
        account_id: resolvedAccountID || undefined,
        currency: sandboxCurrency.trim() || undefined,
        units: Math.max(1, Number(sandboxUnits) || DEFAULT_SANDBOX_TOP_UP_UNITS),
      })).data;
      setSandboxResult(result);
      await loadPortfolio(result.account_id);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.payIn")));
    } finally {
      setWorking(false);
    }
  };

  const onLoadMoreOperations = () => {
    if (!operationsHasNext || !operationsNextCursor) {
      return;
    }
    void loadOperations(resolvedAccountID || undefined, operationsNextCursor, true);
  };

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t("tbankTest.portfolio.title")}</CardTitle>
        <CardDescription>{t("tbankTest.portfolio.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="account" className="flex min-h-0 flex-1 flex-col gap-4">
          <TabsList className="grid h-auto w-full grid-cols-4">
            <TabsTrigger value="account">{t("tbankTest.portfolio.tabs.account")}</TabsTrigger>
            <TabsTrigger value="balance">{t("tbankTest.portfolio.tabs.balance")}</TabsTrigger>
            <TabsTrigger value="positions">{t("tbankTest.portfolio.tabs.positions")}</TabsTrigger>
            <TabsTrigger value="operations">{t("tbankTest.portfolio.tabs.operations")}</TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-4 text-sm">
            <div className="grid gap-2">
              <Label htmlFor="tbank-portfolio-account">{t("tbankTest.portfolio.accountLabel")}</Label>
              <select
                id="tbank-portfolio-account"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={portfolioAccountID}
                onChange={event => setPortfolioAccountID(event.target.value)}
              >
                <option value="">{t("tbankTest.portfolio.accountDefaultOption")}</option>
                {availableAccounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadPortfolio(portfolioAccountID || undefined)}
                disabled={!connected || loadingPortfolio}
              >
                {t("tbankTest.portfolio.refreshButton")}
              </Button>

              {isSandbox ? (
                <>
                  <Input
                    type="text"
                    value={sandboxCurrency}
                    onChange={event => setSandboxCurrency(event.target.value.toUpperCase())}
                    placeholder={t("tbankTest.portfolio.sandboxCurrencyPlaceholder")}
                    className="w-24"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={sandboxUnits}
                    onChange={event =>
                      setSandboxUnits(Math.max(1, Number(event.target.value) || DEFAULT_SANDBOX_TOP_UP_UNITS))
                    }
                    placeholder={t("tbankTest.portfolio.sandboxUnitsPlaceholder")}
                    className="w-40"
                  />
                  <Button type="button" onClick={() => void onSandboxPayIn()} disabled={working || !connected}>
                    {t("tbankTest.portfolio.sandboxTopUpButton")}
                  </Button>
                </>
              ) : null}
            </div>

            {sandboxResult ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                {t("tbankTest.portfolio.sandboxTopUpResult", {
                  accountID: sandboxResult.account_id,
                  currency: sandboxResult.currency,
                  units: sandboxResult.units,
                })}
              </div>
            ) : null}

            {loadingPortfolio ? <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.loading")}</div> : null}
            {!loadingPortfolio && !portfolio ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.empty")}</div>
            ) : null}
          </TabsContent>

          <TabsContent value="balance" className="space-y-4 text-sm">
            {loadingPortfolio ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.loading")}</div>
            ) : portfolio ? (
              <>
                <div className="rounded-md border p-3">
                  <div>
                    <span className="font-medium">{t("tbankTest.portfolio.totalLabel")} </span>
                    {formatNumber(portfolio.total_amount_portfolio ?? 0)} {portfolio.total_amount_portfolio_currency || ""}
                  </div>
                  <div>
                    <span className="font-medium">{t("tbankTest.portfolio.dailyYieldLabel")} </span>
                    {formatNumber(portfolio.daily_yield ?? 0)}
                  </div>
                  <div>
                    <span className="font-medium">{t("tbankTest.portfolio.dailyYieldRelativeLabel")} </span>
                    {formatPercent(portfolio.daily_yield_relative ?? 0)}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium">{t("tbankTest.portfolio.moneyTitle")}</div>
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="p-2">{t("tbankTest.portfolio.moneyCurrency")}</th>
                          <th className="p-2">{t("tbankTest.portfolio.moneyAvailable")}</th>
                          <th className="p-2">{t("tbankTest.portfolio.moneyBlocked")}</th>
                          <th className="p-2">{t("tbankTest.portfolio.moneyWithdrawAvailable")}</th>
                          <th className="p-2">{t("tbankTest.portfolio.moneyWithdrawBlocked")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(portfolio.money ?? []).length === 0 ? (
                          <tr>
                            <td className="p-2 text-muted-foreground" colSpan={5}>
                              {t("tbankTest.portfolio.moneyEmpty")}
                            </td>
                          </tr>
                        ) : (
                          (portfolio.money ?? []).map(balance => (
                            <tr key={balance.currency} className="border-t">
                              <td className="p-2">{balance.currency}</td>
                              <td className="p-2">{formatNumber(balance.available ?? 0)}</td>
                              <td className="p-2">{formatNumber(balance.blocked ?? 0)}</td>
                              <td className="p-2">{formatNumber(balance.withdraw_available ?? 0)}</td>
                              <td className="p-2">{formatNumber(balance.withdraw_blocked ?? 0)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.empty")}</div>
            )}
          </TabsContent>

          <TabsContent value="positions" className="space-y-4 text-sm">
            {loadingPortfolio ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.loading")}</div>
            ) : portfolio ? (
              <div className="space-y-2">
                <div className="font-medium">
                  {t("tbankTest.portfolio.positionsTitle", { count: Math.min((portfolio.positions ?? []).length, 10) })}
                </div>
                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2">{t("tbankTest.portfolio.positionTicker")}</th>
                        <th className="p-2">{t("tbankTest.portfolio.positionInstrumentID")}</th>
                        <th className="p-2">{t("tbankTest.portfolio.positionQuantity")}</th>
                        <th className="p-2">{t("tbankTest.portfolio.positionCurrentPrice")}</th>
                        <th className="p-2">{t("tbankTest.portfolio.positionCurrentValue")}</th>
                        <th className="p-2">{t("tbankTest.portfolio.positionExpectedYield")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(portfolio.positions ?? []).length === 0 ? (
                        <tr>
                          <td className="p-2 text-muted-foreground" colSpan={6}>
                            {t("tbankTest.portfolio.positionsEmpty")}
                          </td>
                        </tr>
                      ) : (
                        (portfolio.positions ?? []).slice(0, 10).map(position => (
                          <tr
                            key={`${position.instrument_id || position.figi || "-"}:${position.ticker || "-"}`}
                            className="border-t"
                          >
                            <td className="p-2">{position.ticker || "-"}</td>
                            <td className="p-2">{position.instrument_id || position.figi || "-"}</td>
                            <td className="p-2">{formatNumber(position.quantity ?? 0)}</td>
                            <td className="p-2">
                              {formatNumber(position.current_price ?? 0)} {position.currency || ""}
                            </td>
                            <td className="p-2">
                              {formatNumber(position.current_value ?? 0)} {position.currency || ""}
                            </td>
                            <td className="p-2">{formatNumber(position.expected_yield ?? 0)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.empty")}</div>
            )}
          </TabsContent>

          <TabsContent value="operations" className="space-y-4 text-sm">
            <div className="font-medium">{t("tbankTest.portfolio.operationsTitle")}</div>
            {operationsError ? (
              <Alert variant="destructive">
                <AlertTitle>{t("common.error")}</AlertTitle>
                <AlertDescription>{operationsError}</AlertDescription>
              </Alert>
            ) : null}

            {loadingOperations ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.operationsLoading")}</div>
            ) : (
              <div className="overflow-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2">{t("tbankTest.portfolio.operationDate")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationType")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationState")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationInstrument")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationQuantity")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationPrice")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationPayment")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationCommission")}</th>
                      <th className="p-2">{t("tbankTest.portfolio.operationDescription")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operations.length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={9}>
                          {t("tbankTest.portfolio.operationsEmpty")}
                        </td>
                      </tr>
                    ) : (
                      operations.map((operation, index) => (
                        <tr
                          key={`${operation.id || "op"}:${operation.cursor || index}:${operation.date || "-"}`}
                          className="border-t"
                        >
                          <td className="p-2">{formatDateTime(operation.date)}</td>
                          <td className="p-2">{formatEnumLabel(operation.type, "OPERATION_TYPE_")}</td>
                          <td className="p-2">{formatEnumLabel(operation.state, "OPERATION_STATE_")}</td>
                          <td className="p-2">{operation.name || operation.instrument_id || operation.figi || "-"}</td>
                          <td className="p-2">{formatNumber(operation.quantity_done || operation.quantity || 0)}</td>
                          <td className="p-2">
                            {formatNumber(operation.price ?? 0)} {operation.price_currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(operation.payment ?? 0)} {operation.payment_currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(operation.commission ?? 0)} {operation.commission_currency || ""}
                          </td>
                          <td className="p-2">{operation.description || "-"}</td>
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
                  ? t("tbankTest.portfolio.operationsLoadingMore")
                  : t("tbankTest.portfolio.operationsLoadMore")}
              </Button>
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
