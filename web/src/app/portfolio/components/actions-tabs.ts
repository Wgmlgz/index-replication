import type { PortfolioProviderAction } from '@/api-client';

export type PortfolioActionTab = {
  value: string;
  label: string;
  action: PortfolioProviderAction;
};

export function buildPortfolioActionTabs(
  actions: PortfolioProviderAction[],
  runActionLabel: string,
): PortfolioActionTab[] {
  const usedValues = new Set<string>();

  return actions.map((action, index) => {
    const baseValue = (action.id || `action-${index + 1}`).trim() || `action-${index + 1}`;
    let value = baseValue;
    let suffix = 2;
    while (usedValues.has(value)) {
      value = `${baseValue}-${suffix}`;
      suffix += 1;
    }
    usedValues.add(value);

    const fallbackLabel = `${runActionLabel} ${index + 1}`;
    const label = (action.label || action.id || fallbackLabel).trim() || fallbackLabel;

    return {
      value,
      label,
      action,
    };
  });
}

export function resolvePortfolioActionTabValue(
  tabs: { value: string }[],
  requestedValue: string,
): string {
  if (tabs.length === 0) {
    return '';
  }
  if (tabs.some(tab => tab.value === requestedValue)) {
    return requestedValue;
  }
  return tabs[0].value;
}
