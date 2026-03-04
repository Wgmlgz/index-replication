import type { PortfolioProviderAction } from "@/api-client";
import type { NormalizedPortfolioProfile } from "@/app/portfolio-v2/use-portfolio-v2";

export type RunActionFn = (
  actionID: string,
  payload?: Record<string, unknown>,
) => Promise<void>;

export type PortfolioSummaryActionsProps = {
  profile: NormalizedPortfolioProfile | null;
  actions: PortfolioProviderAction[];
  loadingSummary: boolean;
  working: boolean;
  onRefresh: () => void;
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
