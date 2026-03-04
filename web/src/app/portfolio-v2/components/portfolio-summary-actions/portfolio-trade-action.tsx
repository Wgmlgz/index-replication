import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  dateTimeLocalValueToISOString,
  nowAsDateTimeLocalValue,
} from "@/app/portfolio-v2/components/portfolio-formatting";
import type { PortfolioSimpleActionProps } from "@/app/portfolio-v2/components/portfolio-summary-actions/types";
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
        <Label htmlFor={`portfolio-v2-virtual-ticker-${action.id}`}>
          {t("portfolioV2.card.virtualTradeTicker")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-ticker-${action.id}`}
          type="text"
          value={ticker}
          onChange={(event) => setTicker(event.target.value.toUpperCase())}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-v2-virtual-instrument-${action.id}`}>
          {t("portfolioV2.card.virtualTradeInstrumentID")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-instrument-${action.id}`}
          type="text"
          value={instrumentID}
          onChange={(event) => setInstrumentID(event.target.value.toUpperCase())}
          className="w-36"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-v2-virtual-quantity-${action.id}`}>
          {t("portfolioV2.card.virtualTradeQuantity")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-quantity-${action.id}`}
          type="number"
          min={0.0001}
          step="0.0001"
          value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value) || 0)}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-v2-virtual-price-${action.id}`}>
          {t("portfolioV2.card.virtualTradePrice")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-price-${action.id}`}
          type="number"
          min={0.0001}
          step="0.0001"
          value={price}
          onChange={(event) => setPrice(Number(event.target.value) || 0)}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-v2-virtual-commission-${action.id}`}>
          {t("portfolioV2.card.virtualTradeCommission")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-commission-${action.id}`}
          type="number"
          min={0}
          step="0.01"
          value={commission}
          onChange={(event) => setCommission(Number(event.target.value) || 0)}
          className="w-28"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-v2-virtual-currency-${action.id}`}>
          {t("portfolioV2.card.virtualTradeCurrency")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-currency-${action.id}`}
          type="text"
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          className="w-24"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`portfolio-v2-virtual-date-${action.id}`}>
          {t("portfolioV2.card.virtualTradeDateTime")}
        </Label>
        <Input
          id={`portfolio-v2-virtual-date-${action.id}`}
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
        {action.label || action.id || t("portfolioV2.card.runAction")}
      </Button>
    </div>
  );
}
