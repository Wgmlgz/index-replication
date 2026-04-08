import type { PortfolioProviderAction } from "@/api-client";
import type { NormalizedPortfolioProfile } from "@/app/portfolio/use-portfolio";

export type RunActionFn = (
  actionID: string,
  payload?: Record<string, unknown>,
) => Promise<void>;

export type PortfolioSummaryActionsProps = {
  profile: NormalizedPortfolioProfile | null;
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
