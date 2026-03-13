"use client";

import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type { PortfolioActionResponse } from "@/api-client";
import { PortfolioSummaryActions } from "@/app/portfolio/components/portfolio-summary-actions";
import { usePortfolioDetailsContext } from "@/app/portfolio/components/portfolio-details-context";
import { portfolioApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PortfolioActionsPage() {
  const { t } = useTranslation();
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<PortfolioActionResponse | null>(null);

  const actions = useMemo(
    () => selectedProfile?.capabilities?.actions ?? [],
    [selectedProfile?.capabilities?.actions],
  );

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const refreshData = useCallback(
    async (targetPortfolioID: number) => {
      setError("");
      setLoadingRefresh(true);
      try {
        await portfolioApi.mePortfoliosIdSummaryGet(targetPortfolioID);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolio.errors.summary")));
      } finally {
        setLoadingRefresh(false);
      }
    },
    [parseErrorMessage, t],
  );

  const runAction = useCallback(
    async (actionID: string, payload?: Record<string, unknown>) => {
      if (!selectedPortfolioID) {
        return;
      }

      setError("");
      setWorking(true);
      try {
        const response = (
          await portfolioApi.mePortfoliosIdActionsActionPost(selectedPortfolioID, actionID, {
            payload: payload ?? {},
          })
        ).data;
        setActionResult(response);
        await refreshData(selectedPortfolioID);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolio.errors.action")));
      } finally {
        setWorking(false);
      }
    },
    [parseErrorMessage, selectedPortfolioID, refreshData, t],
  );

  if (!selectedPortfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("portfolio.actions.title")}</CardTitle>
          <CardDescription>{t("portfolio.actions.description")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("portfolio.actions.selectPrompt")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t("portfolio.actions.title")}</CardTitle>
        <CardDescription>{t("portfolio.actions.description")}</CardDescription>
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
            {t("portfolio.card.actionResult", { action: actionResult.action || "-" })}
          </div>
        ) : null}

        <PortfolioSummaryActions
          profile={selectedProfile}
          actions={actions}
          loadingSummary={loadingRefresh}
          working={working}
          onRefresh={() => void refreshData(selectedPortfolioID)}
          onRunAction={runAction}
        />
      </CardContent>
    </Card>
  );
}
