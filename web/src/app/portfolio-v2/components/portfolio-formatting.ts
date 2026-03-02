export const DEFAULT_SANDBOX_TOP_UP_UNITS = 1_000_000;

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value);
}

export function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

export function formatDateTime(value?: string): string {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatEnumLabel(value: string | undefined, prefix: string): string {
  if (!value) {
    return '-';
  }

  const normalized = value.replace(prefix, '');
  return normalized
    .split('_')
    .map(token => `${token.charAt(0)}${token.slice(1).toLowerCase()}`)
    .join(' ');
}
