import type { PortfolioProviderAction } from "@/api-client";

export type RunActionFn = (
  actionID: string,
  payload?: Record<string, unknown>,
) => Promise<void>;

export type PortfolioSummaryActionsProps = {
  actions: PortfolioProviderAction[];
  working: boolean;
  onRunAction: RunActionFn;
};

export type PortfolioActionControlProps = {
  action: PortfolioProviderAction;
  working: boolean;
  onRunAction: RunActionFn;
};

export type PortfolioSimpleActionProps = {
  action: PortfolioProviderAction;
  working: boolean;
  onRunAction: RunActionFn;
};
