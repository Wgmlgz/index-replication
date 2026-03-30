import type { PortfolioRebalanceItem } from '@/api-client';

export function formatDateTime(value: string | undefined, language: string): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat(language || 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatNumber(value: number | undefined, fractionDigits = 4): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function unresolvedReason(item: PortfolioRebalanceItem): string {
  const reason: unknown = item.metadata?.reason;
  return typeof reason === 'string' && reason.trim().length > 0 ? reason : '-';
}
