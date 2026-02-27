"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import {
  tbankClient,
  type TBankAccountPortfolioResponse,
  type TBankSandboxPayInResponse,
} from "@/lib/tbank-client";
import { useTBankConnectionContext } from "@/components/tbank-test/tbank-connection-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEFAULT_SANDBOX_TOP_UP_UNITS = 1_000_000;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

export function TBankPortfolioCard() {
  const { t } = useTranslation();
  const { status, availableAccounts, connected } = useTBankConnectionContext();

  const [portfolioAccountID, setPortfolioAccountID] = useState("");
  const [portfolio, setPortfolio] = useState<TBankAccountPortfolioResponse | null>(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);

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
      const apiError = err.response?.data?.error;
      if (typeof apiError === "string" && apiError.length > 0) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const loadPortfolio = useCallback(async (accountID?: string) => {
    if (!connected) {
      setPortfolio(null);
      return;
    }

    setError("");
    setLoadingPortfolio(true);
    try {
      const nextPortfolio = await tbankClient.getPortfolio(accountID || undefined);
      setPortfolio(nextPortfolio);
      setPortfolioAccountID(nextPortfolio.account_id || "");
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.portfolio")));
    } finally {
      setLoadingPortfolio(false);
    }
  }, [connected, parseErrorMessage, t]);

  useEffect(() => {
    if (!connected) {
      setPortfolio(null);
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
      const result = await tbankClient.sandboxPayIn({
        account_id: resolvedAccountID || undefined,
        currency: sandboxCurrency.trim() || undefined,
        units: Math.max(1, Number(sandboxUnits) || DEFAULT_SANDBOX_TOP_UP_UNITS),
      });
      setSandboxResult(result);
      await loadPortfolio(result.account_id);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.payIn")));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tbankTest.portfolio.title")}</CardTitle>
        <CardDescription>{t("tbankTest.portfolio.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

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
              <Button type="button" onClick={onSandboxPayIn} disabled={working || !connected}>
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

        {portfolio ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border p-3">
              <div>
                <span className="font-medium">{t("tbankTest.portfolio.totalLabel")} </span>
                {formatNumber(portfolio.total_amount_portfolio)} {portfolio.total_amount_portfolio_currency || ""}
              </div>
              <div>
                <span className="font-medium">{t("tbankTest.portfolio.dailyYieldLabel")} </span>
                {formatNumber(portfolio.daily_yield)}
              </div>
              <div>
                <span className="font-medium">{t("tbankTest.portfolio.dailyYieldRelativeLabel")} </span>
                {formatPercent(portfolio.daily_yield_relative)}
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
                    {portfolio.money.length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={5}>
                          {t("tbankTest.portfolio.moneyEmpty")}
                        </td>
                      </tr>
                    ) : (
                      portfolio.money.map(balance => (
                        <tr key={balance.currency} className="border-t">
                          <td className="p-2">{balance.currency}</td>
                          <td className="p-2">{formatNumber(balance.available)}</td>
                          <td className="p-2">{formatNumber(balance.blocked)}</td>
                          <td className="p-2">{formatNumber(balance.withdraw_available)}</td>
                          <td className="p-2">{formatNumber(balance.withdraw_blocked)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">
                {t("tbankTest.portfolio.positionsTitle", { count: Math.min(portfolio.positions.length, 10) })}
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
                    {portfolio.positions.length === 0 ? (
                      <tr>
                        <td className="p-2 text-muted-foreground" colSpan={6}>
                          {t("tbankTest.portfolio.positionsEmpty")}
                        </td>
                      </tr>
                    ) : (
                      portfolio.positions.slice(0, 10).map(position => (
                        <tr
                          key={`${position.instrument_id || position.figi || "-"}:${position.ticker || "-"}`}
                          className="border-t"
                        >
                          <td className="p-2">{position.ticker || "-"}</td>
                          <td className="p-2">{position.instrument_id || position.figi || "-"}</td>
                          <td className="p-2">{formatNumber(position.quantity)}</td>
                          <td className="p-2">
                            {formatNumber(position.current_price)} {position.currency || ""}
                          </td>
                          <td className="p-2">
                            {formatNumber(position.current_value)} {position.currency || ""}
                          </td>
                          <td className="p-2">{formatNumber(position.expected_yield)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.empty")}</div>
        )}
      </CardContent>
    </Card>
  );
}
