import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { PortfolioSimpleActionProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortfolioTBankTestBuyAction({
  action,
  working,
  onRunAction,
}: PortfolioSimpleActionProps) {
  const { t } = useTranslation();
  const [instrumentID, setInstrumentID] = useState("");
  const [accountID, setAccountID] = useState("");
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-2">
        <Label htmlFor="portfolio-tbank-test-buy-instrument">
          {t("portfolio.card.tbankTestBuyInstrumentID")}
        </Label>
        <Input
          id="portfolio-tbank-test-buy-instrument"
          type="text"
          value={instrumentID}
          onChange={(event) => setInstrumentID(event.target.value)}
          className="w-40"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portfolio-tbank-test-buy-account">
          {t("portfolio.card.tbankTestBuyAccountID")}
        </Label>
        <Input
          id="portfolio-tbank-test-buy-account"
          type="text"
          value={accountID}
          onChange={(event) => setAccountID(event.target.value)}
          className="w-44"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="portfolio-tbank-test-buy-quantity">
          {t("portfolio.card.tbankTestBuyQuantity")}
        </Label>
        <Input
          id="portfolio-tbank-test-buy-quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          className="w-28"
        />
      </div>
      <Button
        type="button"
        onClick={() =>
          void onRunAction(action.id || "test_buy", {
            instrument_id: instrumentID.trim() || undefined,
            account_id: accountID.trim() || undefined,
            quantity: Math.max(1, Number(quantity) || 1),
          })
        }
        disabled={working || !instrumentID.trim()}
      >
        {action.label || t("portfolio.card.runAction")}
      </Button>
    </div>
  );
}
