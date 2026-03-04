import { useTranslation } from "react-i18next";

import type { PortfolioSimpleActionProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import { Button } from "@/components/ui/button";

export function PortfolioSimpleAction({
  action,
  working,
  onRunAction,
}: PortfolioSimpleActionProps) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void onRunAction(action.id || "")}
      disabled={working || !action.id}
    >
      {action.label || action.id || t("portfolio.card.runAction")}
    </Button>
  );
}
