import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  dateTimeLocalValueToISOString,
  nowAsDateTimeLocalValue,
} from "@/app/portfolio/components/portfolio-formatting";
import type { PortfolioSimpleActionProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortfolioTradeAction({
  action,
  working,
  onRunAction,
}: PortfolioSimpleActionProps) {
  const { t } = useTranslation();
  const [ticker, setTicker] = useState("");
  const [instrumentID, setInstrumentID] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(100);
  const [commission, setCommission] = useState(0);
  const [currency, setCurrency] = useState("RUB");
  const [executedAt, setExecutedAt] = useState(() => nowAsDateTimeLocalValue());

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-ticker-${action.id}`}>
          {t("portfolio.card.virtualTradeTicker")}
        </Label>
        <Input
          id={`portfolio-virtual-ticker-${action.id}`}
          type="text"
          value={ticker}
          onChange={(event) => setTicker(event.target.value.toUpperCase())}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-instrument-${action.id}`}>
          {t("portfolio.card.virtualTradeInstrumentID")}
        </Label>
        <Input
          id={`portfolio-virtual-instrument-${action.id}`}
          type="text"
          value={instrumentID}
          onChange={(event) => setInstrumentID(event.target.value.toUpperCase())}
          className="w-36"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-quantity-${action.id}`}>
          {t("portfolio.card.virtualTradeQuantity")}
        </Label>
        <Input
          id={`portfolio-virtual-quantity-${action.id}`}
          type="number"
          min={0.0001}
          step="0.0001"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value) || 0)}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-price-${action.id}`}>
          {t("portfolio.card.virtualTradePrice")}
        </Label>
        <Input
          id={`portfolio-virtual-price-${action.id}`}
          type="number"
          min={0.0001}
          step="0.0001"
          value={price}
          onChange={(event) => setPrice(Number(event.target.value) || 0)}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-commission-${action.id}`}>
          {t("portfolio.card.virtualTradeCommission")}
        </Label>
        <Input
          id={`portfolio-virtual-commission-${action.id}`}
          type="number"
          min={0}
          step="0.01"
          value={commission}
          onChange={(event) => setCommission(Number(event.target.value) || 0)}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-currency-${action.id}`}>
          {t("portfolio.card.virtualTradeCurrency")}
        </Label>
        <Input
          id={`portfolio-virtual-currency-${action.id}`}
          type="text"
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          className="w-24"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-virtual-date-${action.id}`}>
          {t("portfolio.card.virtualTradeDateTime")}
        </Label>
        <Input
          id={`portfolio-virtual-date-${action.id}`}
          type="datetime-local"
          value={executedAt}
          onChange={(event) => setExecutedAt(event.target.value)}
          className="w-56"
        />
      </div>
      <Button
        type="button"
        onClick={() =>
          void onRunAction(action.id || "", {
            ticker: ticker.trim() || undefined,
            instrument_id: instrumentID.trim() || undefined,
            quantity: Math.max(0.0001, Number(quantity) || 0.0001),
            price: Math.max(0.0001, Number(price) || 0.0001),
            commission: Math.max(0, Number(commission) || 0),
            currency: currency.trim() || "RUB",
            executed_at: dateTimeLocalValueToISOString(executedAt),
          })
        }
        disabled={working || !action.id}
      >
        {action.label || action.id || t("portfolio.card.runAction")}
      </Button>
    </div>
  );
}
