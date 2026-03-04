import { useTranslation } from "react-i18next";

import { PortfolioActionControl } from "@/app/portfolio/components/portfolio-summary-actions/portfolio-action-control";
import type { PortfolioSummaryActionsProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import { Button } from "@/components/ui/button";

export function PortfolioSummaryActions({
  profile,
  actions,
  loadingSummary,
  working,
  onRefresh,
  onRunAction,
}: PortfolioSummaryActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div>
        <span className="font-medium">{t("portfolio.card.profileName")} </span>
        {profile?.name || "-"}
      </div>
      <div>
        <span className="font-medium">{t("portfolio.card.provider")} </span>
        {profile?.provider || "-"}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onRefresh} disabled={loadingSummary}>
          {t("portfolio.card.refreshButton")}
        </Button>

        {actions.length === 0 ? (
          <span className="self-center text-muted-foreground">
            {t("portfolio.overview.noQuickActions")}
          </span>
        ) : null}
      </div>

      {actions.map((action, index) => (
        <PortfolioActionControl
          key={action.id || `portfolio-action-${index}`}
          action={action}
          working={working}
          onRunAction={onRunAction}
        />
      ))}
    </div>
  );
}
