import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PortfolioActionControl } from "@/app/portfolio/components/portfolio-summary-actions/portfolio-action-control";
import type { PortfolioSummaryActionsProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PortfolioSummaryActions({
  profile: _profile,
  actions,
  working,
  onRunAction,
}: PortfolioSummaryActionsProps) {
  const { t } = useTranslation();
  const actionTabs = useMemo(
    () =>
      actions.map((action, index) => ({
        value: `${action.id || "action"}-${index}`,
        label: action.label || action.id || `${t("portfolio.card.runAction")} ${index + 1}`,
        action,
      })),
    [actions, t],
  );
  const [activeActionTab, setActiveActionTab] = useState<string>("");

  useEffect(() => {
    if (actionTabs.length === 0) {
      setActiveActionTab("");
      return;
    }
    if (!actionTabs.some(tab => tab.value === activeActionTab)) {
      setActiveActionTab(actionTabs[0].value);
    }
  }, [actionTabs, activeActionTab]);

  return (
    <div className="space-y-2">
      {actions.length === 0 ? (
        <span className="text-muted-foreground">
          {t("portfolio.overview.noQuickActions")}
        </span>
      ) : null}

      {actionTabs.length > 0 ? (
        <Tabs value={activeActionTab} onValueChange={setActiveActionTab} className="gap-3">
          <TabsList className="h-auto w-full justify-start overflow-x-auto">
            {actionTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-none">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {actionTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              <PortfolioActionControl
                action={tab.action}
                working={working}
                onRunAction={onRunAction}
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </div>
  );
}
