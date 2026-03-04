"use client";

import { useCallback, useMemo, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import type { PortfolioActionResponse } from "@/api-client";
import { PortfolioSummaryActions } from "@/app/portfolio-v2/components/portfolio-summary-actions";
import type { NormalizedPortfolioProfile } from "@/app/portfolio-v2/use-portfolio-v2";
import { portfolioApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PortfolioActionsPanelProps = {
  portfolioID: number | null;
  profile: NormalizedPortfolioProfile | null;
};

export function PortfolioActionsPanel({
  portfolioID,
  profile,
}: PortfolioActionsPanelProps) {
  const { t } = useTranslation();
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [actionResult, setActionResult] = useState<PortfolioActionResponse | null>(null);

  const actions = useMemo(
    () => profile?.capabilities?.actions ?? [],
    [profile?.capabilities?.actions],
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
        setError(parseErrorMessage(err, t("portfolioV2.errors.summary")));
      } finally {
        setLoadingRefresh(false);
      }
    },
    [parseErrorMessage, t],
  );

  const runAction = useCallback(
    async (actionID: string, payload?: Record<string, unknown>) => {
      if (!portfolioID) {
        return;
      }

      setError("");
      setWorking(true);
      try {
        const response = (
          await portfolioApi.mePortfoliosIdActionsActionPost(portfolioID, actionID, {
            payload: payload ?? {},
          })
        ).data;
        setActionResult(response);
        await refreshData(portfolioID);
      } catch (err) {
        setError(parseErrorMessage(err, t("portfolioV2.errors.action")));
      } finally {
        setWorking(false);
      }
    },
    [parseErrorMessage, portfolioID, refreshData, t],
  );

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("portfolioV2.actions.title")}</CardTitle>
          <CardDescription>{t("portfolioV2.actions.description")}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("portfolioV2.actions.selectPrompt")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{t("portfolioV2.actions.title")}</CardTitle>
        <CardDescription>{t("portfolioV2.actions.description")}</CardDescription>
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
            {t("portfolioV2.card.actionResult", { action: actionResult.action || "-" })}
          </div>
        ) : null}

        <PortfolioSummaryActions
          profile={profile}
          actions={actions}
          loadingSummary={loadingRefresh}
          working={working}
          onRefresh={() => void refreshData(portfolioID)}
          onRunAction={runAction}
        />
      </CardContent>
    </Card>
  );
}
