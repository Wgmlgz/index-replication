import { PortfolioDepositCashAction } from "@/app/portfolio-v2/components/portfolio-summary-actions/portfolio-deposit-cash-action";
import { PortfolioSandboxPayInAction } from "@/app/portfolio-v2/components/portfolio-summary-actions/portfolio-sandbox-pay-in-action";
import { PortfolioSimpleAction } from "@/app/portfolio-v2/components/portfolio-summary-actions/portfolio-simple-action";
import { PortfolioTBankTestBuyAction } from "@/app/portfolio-v2/components/portfolio-summary-actions/portfolio-tbank-test-buy-action";
import { PortfolioTradeAction } from "@/app/portfolio-v2/components/portfolio-summary-actions/portfolio-trade-action";
import type { PortfolioActionControlProps } from "@/app/portfolio-v2/components/portfolio-summary-actions/types";

export function PortfolioActionControl({
  action,
  working,
  onRunAction,
}: PortfolioActionControlProps) {
  if (action.id === "sandbox_pay_in") {
    return (
      <PortfolioSandboxPayInAction
        action={action}
        working={working}
        onRunAction={onRunAction}
      />
    );
  }

  if (action.id === "test_buy") {
    return (
      <PortfolioTBankTestBuyAction
        action={action}
        working={working}
        onRunAction={onRunAction}
      />
    );
  }

  if (action.id === "deposit_cash") {
    return (
      <PortfolioDepositCashAction
        action={action}
        working={working}
        onRunAction={onRunAction}
      />
    );
  }

  if (action.id === "buy" || action.id === "sell") {
    return (
      <PortfolioTradeAction action={action} working={working} onRunAction={onRunAction} />
    );
  }

  return (
    <PortfolioSimpleAction action={action} working={working} onRunAction={onRunAction} />
  );
}
