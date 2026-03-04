"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type { PortfolioSummaryResponse } from "@/api-client";
import { portfolioApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/app/portfolio/components/portfolio-formatting";

type PortfolioSummaryPanelProps = {
  portfolioID: number | null;
};

export function PortfolioSummaryPanel({ portfolioID }: PortfolioSummaryPanelProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PortfolioSummaryResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
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

  const loadSummary = useCallback(
    async (targetPortfolioID: number) => {
      setError("");
      setLoadingSummary(true);
      try {
        const nextSummary = (
          await portfolioApi.mePortfoliosIdSummaryGet(targetPortfolioID)
        ).data;
        setSummary(nextSummary);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolio.errors.summary")));
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
      return;
    }

    void loadSummary(portfolioID);
  }, [loadSummary, portfolioID]);

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("portfolio.overview.summaryTitle")}</CardTitle>
          <CardDescription>
            {t("portfolio.overview.summaryDescription")}
          </CardDescription>
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
        <CardTitle>{t("portfolio.overview.summaryTitle")}</CardTitle>
        <CardDescription>
          {t("portfolio.overview.summaryDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm">
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loadingSummary ? (
          <div className="text-muted-foreground">
            {t("portfolio.card.loading")}
          </div>
        ) : summary ? (
          <>
            <div className="space-y-2">
              <div className="font-medium">
                {t("portfolio.overview.balancesTitle")}
              </div>
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
                        <td className="p-2 text-muted-foreground" colSpan={5}>
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
            {t("portfolio.card.empty")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
