"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import {
  tbankClient,
  type TBankAccountPortfolioResponse,
  type TBankConnectionStatusResponse,
  type TBankInstrumentLookupItem,
  type TBankInstrumentLookupResponse,
  type TBankSandboxPayInResponse,
  type TBankTestBuyResponse,
} from "@/lib/tbank-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TBankSetupInstructions } from "@/components/tbank-test/setup-instructions";

type Environment = "sandbox" | "production";

const DEFAULT_SANDBOX_TOP_UP_UNITS = 1_000_000;

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

export default function TBankTestPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TBankConnectionStatusResponse | null>(null);
  const [portfolio, setPortfolio] = useState<TBankAccountPortfolioResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<TBankInstrumentLookupResponse | null>(null);
  const [sandboxResult, setSandboxResult] = useState<TBankSandboxPayInResponse | null>(null);
  const [buyResult, setBuyResult] = useState<TBankTestBuyResponse | null>(null);

  const [error, setError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [working, setWorking] = useState(false);

  const [connectToken, setConnectToken] = useState("");
  const [environment, setEnvironment] = useState<Environment>("sandbox");
  const [defaultAccountID, setDefaultAccountID] = useState("");
  const [portfolioAccountID, setPortfolioAccountID] = useState("");

  const [instrumentID, setInstrumentID] = useState("");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderAccountID, setOrderAccountID] = useState("");

  const [lookupTicker, setLookupTicker] = useState("");
  const [lookupClassCode, setLookupClassCode] = useState("");

  const [sandboxCurrency, setSandboxCurrency] = useState("RUB");
  const [sandboxUnits, setSandboxUnits] = useState(DEFAULT_SANDBOX_TOP_UP_UNITS);

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

  const loadPortfolio = async (accountID?: string) => {
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
  };

  const loadStatus = async () => {
    setError("");
    setLoadingStatus(true);
    try {
      const nextStatus = await tbankClient.getStatus();
      const nextEnvironment: Environment =
        nextStatus.environment === "production" ? "production" : "sandbox";
      const nextDefaultAccountID = nextStatus.default_account_id || "";

      setStatus(nextStatus);
      setEnvironment(nextEnvironment);
      setDefaultAccountID(nextDefaultAccountID);

      if (!orderAccountID && nextDefaultAccountID) {
        setOrderAccountID(nextDefaultAccountID);
      }
      if (!portfolioAccountID && nextDefaultAccountID) {
        setPortfolioAccountID(nextDefaultAccountID);
      }

      if (nextStatus.connected) {
        await loadPortfolio(portfolioAccountID || nextDefaultAccountID || undefined);
      } else {
        setPortfolio(null);
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
    setSandboxResult(null);
    try {
      const nextStatus = await tbankClient.connect({
        token: connectToken,
        environment,
        default_account_id: defaultAccountID || undefined,
      });
      const nextDefault = nextStatus.default_account_id || "";
      setStatus(nextStatus);
      setDefaultAccountID(nextDefault);
      setOrderAccountID(nextDefault);
      setPortfolioAccountID(nextDefault);
      setConnectToken("");
      await loadPortfolio(nextDefault || undefined);
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
    setSandboxResult(null);
    setLookupResult(null);
    try {
      await tbankClient.disconnect();
      await loadStatus();
      setDefaultAccountID("");
      setOrderAccountID("");
      setPortfolioAccountID("");
      setPortfolio(null);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.disconnect")));
    } finally {
      setWorking(false);
    }
  };

  const onSaveDefaultAccount = async () => {
    if (!defaultAccountID.trim()) {
      setError(t("tbankTest.errors.defaultAccount"));
      return;
    }

    setError("");
    setWorking(true);
    try {
      const nextStatus = await tbankClient.setDefaultAccount({ account_id: defaultAccountID.trim() });
      setStatus(nextStatus);
      setDefaultAccountID(nextStatus.default_account_id || defaultAccountID);
      if (!orderAccountID) {
        setOrderAccountID(nextStatus.default_account_id || "");
      }
      if (!portfolioAccountID) {
        setPortfolioAccountID(nextStatus.default_account_id || "");
      }
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.defaultAccount")));
    } finally {
      setWorking(false);
    }
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
      const result = await tbankClient.findInstrumentByTicker(
        lookupTicker.trim(),
        lookupClassCode.trim() || undefined
      );
      setLookupResult(result);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.lookup")));
    } finally {
      setLoadingLookup(false);
    }
  };

  const onUseInstrument = (item: TBankInstrumentLookupItem) => {
    setInstrumentID(item.instrument_id);
  };

  const onSandboxPayIn = async () => {
    setError("");
    setWorking(true);
    setSandboxResult(null);
    try {
      const result = await tbankClient.sandboxPayIn({
        account_id: portfolioAccountID || resolvedAccountID || undefined,
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
      await loadPortfolio(result.account_id || resolvedAccountID || undefined);
    } catch (err) {
      setError(parseErrorMessage(err, t("tbankTest.errors.buy")));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
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
              {status?.default_account_id ? (
                <div className="text-muted-foreground">
                  {t("tbankTest.connect.defaultAccountValue", { accountID: status.default_account_id })}
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
              <select
                id="tbank-default-account"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={defaultAccountID}
                onChange={event => setDefaultAccountID(event.target.value)}
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
              <Button type="button" variant="outline" onClick={onSaveDefaultAccount} disabled={working || !status?.connected || !defaultAccountID.trim()}>
                {t("tbankTest.connect.saveDefaultButton")}
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
                        <Button type="button" variant="outline" onClick={() => setOrderAccountID(account.id)}>
                          {t("tbankTest.connect.useForOrderButton")}
                        </Button>
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

        <Card>
          <CardHeader>
            <CardTitle>{t("tbankTest.buy.title")}</CardTitle>
            <CardDescription>{t("tbankTest.buy.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("tbankTest.portfolio.title")}</CardTitle>
            <CardDescription>{t("tbankTest.portfolio.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Button type="button" variant="outline" onClick={() => void loadPortfolio(portfolioAccountID || undefined)} disabled={!status?.connected || loadingPortfolio}>
                {t("tbankTest.portfolio.refreshButton")}
              </Button>

              {status?.environment === "sandbox" ? (
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
                    onChange={event => setSandboxUnits(Math.max(1, Number(event.target.value) || DEFAULT_SANDBOX_TOP_UP_UNITS))}
                    placeholder={t("tbankTest.portfolio.sandboxUnitsPlaceholder")}
                    className="w-40"
                  />
                  <Button type="button" onClick={onSandboxPayIn} disabled={working || !status?.connected}>
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

            {loadingPortfolio ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.portfolio.loading")}</div>
            ) : null}

            {portfolio ? (
              <div className="space-y-4 text-sm">
                <div className="rounded-md border p-3">
                  <div><span className="font-medium">{t("tbankTest.portfolio.totalLabel")} </span>{formatNumber(portfolio.total_amount_portfolio)} {portfolio.total_amount_portfolio_currency || ""}</div>
                  <div><span className="font-medium">{t("tbankTest.portfolio.dailyYieldLabel")} </span>{formatNumber(portfolio.daily_yield)}</div>
                  <div><span className="font-medium">{t("tbankTest.portfolio.dailyYieldRelativeLabel")} </span>{formatPercent(portfolio.daily_yield_relative)}</div>
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
                            <td className="p-2 text-muted-foreground" colSpan={5}>{t("tbankTest.portfolio.moneyEmpty")}</td>
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
                            <td className="p-2 text-muted-foreground" colSpan={6}>{t("tbankTest.portfolio.positionsEmpty")}</td>
                          </tr>
                        ) : (
                          portfolio.positions.slice(0, 10).map(position => (
                            <tr key={`${position.instrument_id || position.figi || "-"}:${position.ticker || "-"}`} className="border-t">
                              <td className="p-2">{position.ticker || "-"}</td>
                              <td className="p-2">{position.instrument_id || position.figi || "-"}</td>
                              <td className="p-2">{formatNumber(position.quantity)}</td>
                              <td className="p-2">{formatNumber(position.current_price)} {position.currency || ""}</td>
                              <td className="p-2">{formatNumber(position.current_value)} {position.currency || ""}</td>
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

        <Card>
          <CardHeader>
            <CardTitle>{t("tbankTest.lookup.title")}</CardTitle>
            <CardDescription>{t("tbankTest.lookup.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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

            <Button
              type="button"
              onClick={onLookupInstrument}
              disabled={loadingLookup || !status?.connected || !lookupTicker.trim()}
            >
              {t("tbankTest.lookup.searchButton")}
            </Button>

            {loadingLookup ? (
              <div className="text-sm text-muted-foreground">{t("tbankTest.lookup.loading")}</div>
            ) : null}

            {lookupResult ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {t("tbankTest.lookup.resultCount", { count: lookupResult.instruments.length })}
                </div>
                <div className="max-h-96 space-y-2 overflow-auto rounded-md border p-2">
                  {lookupResult.instruments.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("tbankTest.lookup.empty")}</div>
                  ) : (
                    lookupResult.instruments.map(item => (
                      <div key={`${item.instrument_id}:${item.ticker}`} className="space-y-1 rounded border p-2 text-sm">
                        <div className="font-medium">{item.name || t("tbankTest.lookup.noName")}</div>
                        <div className="text-muted-foreground">{item.ticker} {item.class_code ? `(${item.class_code})` : ""}</div>
                        <div><span className="font-medium">{t("tbankTest.lookup.instrumentIdLabel")} </span>{item.instrument_id}</div>
                        <div className="text-muted-foreground">UID: {item.uid || "-"}</div>
                        <div className="text-muted-foreground">FIGI: {item.figi || "-"}</div>
                        <Button type="button" variant="outline" onClick={() => onUseInstrument(item)}>
                          {t("tbankTest.lookup.useInstrumentButton")}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
