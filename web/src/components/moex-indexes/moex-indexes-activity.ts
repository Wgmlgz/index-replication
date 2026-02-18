import type { LastActiveRange } from './list/use-moex-indexes.types';

const LAST_ACTIVE_MONTHS: Record<Exclude<LastActiveRange, 'all'>, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
  '1y': 12,
};

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const startOfTodayUtc = (now = new Date()) => {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const matchesLastActiveRange = (
  lastActiveDate: string | null,
  range: LastActiveRange
) => {
  if (range === 'all') return true;
  const parsed = parseDateOnly(lastActiveDate);
  if (!parsed) return false;

  const threshold = startOfTodayUtc();
  threshold.setUTCMonth(threshold.getUTCMonth() - LAST_ACTIVE_MONTHS[range]);

  return parsed.getTime() >= threshold.getTime();
};

export const isIndexInactive = (lastActiveDate: string | null) =>
  !matchesLastActiveRange(lastActiveDate, '1m');
