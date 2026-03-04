import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { PortfolioSimpleActionProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import { DEFAULT_SANDBOX_TOP_UP_UNITS } from "@/app/portfolio/components/portfolio-formatting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortfolioSandboxPayInAction({
  action,
  working,
  onRunAction,
}: PortfolioSimpleActionProps) {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState("RUB");
  const [units, setUnits] = useState(DEFAULT_SANDBOX_TOP_UP_UNITS);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-2">
        <Label htmlFor="portfolio-sandbox-currency">
          {t("portfolio.card.sandboxCurrency")}
        </Label>
        <Input
          id="portfolio-sandbox-currency"
          type="text"
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          className="w-24"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portfolio-sandbox-units">{t("portfolio.card.sandboxUnits")}</Label>
        <Input
          id="portfolio-sandbox-units"
          type="number"
          min={1}
          value={units}
          onChange={(event) =>
            setUnits(
              Math.max(
                1,
                Number(event.target.value) || DEFAULT_SANDBOX_TOP_UP_UNITS,
              ),
            )
          }
          className="w-40"
        />
      </div>
      <Button
        type="button"
        onClick={() =>
          void onRunAction(action.id || "sandbox_pay_in", {
            currency: currency.trim() || "RUB",
            units: Math.max(1, Number(units) || DEFAULT_SANDBOX_TOP_UP_UNITS),
          })
        }
        disabled={working}
      >
        {action.label || t("portfolio.card.runAction")}
      </Button>
    </div>
  );
}
