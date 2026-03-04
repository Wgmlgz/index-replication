import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { PortfolioSimpleActionProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import {
  dateTimeLocalValueToISOString,
  nowAsDateTimeLocalValue,
} from "@/app/portfolio/components/portfolio-formatting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortfolioDepositCashAction({
  action,
  working,
  onRunAction,
}: PortfolioSimpleActionProps) {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState("RUB");
  const [amount, setAmount] = useState(10000);
  const [executedAt, setExecutedAt] = useState(() => nowAsDateTimeLocalValue());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-2">
        <Label htmlFor="portfolio-virtual-currency">
          {t("portfolio.card.virtualTradeCurrency")}
        </Label>
        <Input
          id="portfolio-virtual-currency"
          type="text"
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          className="w-24"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portfolio-virtual-amount">
          {t("portfolio.card.virtualDepositAmount")}
        </Label>
        <Input
          id="portfolio-virtual-amount"
          type="number"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value) || 0)}
          className="w-40"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portfolio-virtual-date-deposit_cash">
          {t("portfolio.card.virtualTradeDateTime")}
        </Label>
        <Input
          id="portfolio-virtual-date-deposit_cash"
          type="datetime-local"
          value={executedAt}
          onChange={(event) => setExecutedAt(event.target.value)}
          className="w-56"
        />
      </div>
      <Button
        type="button"
        onClick={() =>
          void onRunAction(action.id || "deposit_cash", {
            currency: currency.trim() || "RUB",
            amount,
            executed_at: dateTimeLocalValueToISOString(executedAt),
          })
        }
        disabled={working || amount === 0}
      >
        {action.label || t("portfolio.card.runAction")}
      </Button>
    </div>
  );
}
