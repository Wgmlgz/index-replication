import { useTranslation } from "react-i18next";

import { getPortfolioActionFormConfig } from "@/app/portfolio/components/portfolio-summary-actions/portfolio-action-form-schema";
import { PortfolioActionRJSFForm } from "@/app/portfolio/components/portfolio-summary-actions/portfolio-action-rjsf-form";
import { PortfolioSimpleAction } from "@/app/portfolio/components/portfolio-summary-actions/portfolio-simple-action";
import type { PortfolioActionControlProps } from "@/app/portfolio/components/portfolio-summary-actions/types";

export function PortfolioActionControl({
  action,
  working,
  onRunAction,
}: PortfolioActionControlProps) {
  const { t } = useTranslation();
  const config = getPortfolioActionFormConfig(action.id, t);

  if (config) {
    return (
      <PortfolioActionRJSFForm
        action={action}
        working={working}
        onRunAction={onRunAction}
        config={config}
      />
    );
  }

  return (
    <PortfolioSimpleAction action={action} working={working} onRunAction={onRunAction} />
  );
}
