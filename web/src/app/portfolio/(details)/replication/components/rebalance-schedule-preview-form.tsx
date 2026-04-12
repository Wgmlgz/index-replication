'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { CalendarClock, CircleHelp, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';

import type {
  PortfolioRebalanceSchedulePreviewRequest,
  PortfolioRebalanceSchedulePreviewResponse,
} from '@/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDayButton } from '@/components/ui/calendar';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SortHeader, SortableDataTable } from '@/app/portfolio/components/sortable-data-table';
import { axiosClient, portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';

type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_INTERVAL';
type BusinessDayAdjustment =
  | 'strict'
  | 'following'
  | 'preceding'
  | 'modified_following'
  | 'modified_preceding';

type EventRow = {
  id: string;
  eventAt: string;
};

const WEEKDAY_RRULE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const WEEKDAY_FROM_RRULE: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

type ScheduleConfigResponse = {
  is_enabled?: boolean;
  dtstart?: string;
  rrule?: string;
  business_day_adjustment?: string;
  updated_at?: string;
};

type ScheduleConfigUpsertRequest = {
  is_enabled: boolean;
  dtstart: string;
  rrule: string;
  business_day_adjustment: BusinessDayAdjustment;
};

type SchedulePreviewRequestPayload = PortfolioRebalanceSchedulePreviewRequest & {
  business_day_adjustment: BusinessDayAdjustment;
};

const DEFAULT_BUSINESS_DAY_ADJUSTMENT: BusinessDayAdjustment = 'strict';
const DEFAULT_PREFERRED_TIME = '09:30';
const DEFAULT_WEEKLY_DAY_OF_WEEK = 1;
const DEFAULT_MONTHLY_DAY_INPUT = '1';
const DEFAULT_CUSTOM_INTERVAL_DAYS_INPUT = '14';

type ScheduleFormSnapshot = {
  frequency: ScheduleFrequency;
  preferredTime: string;
  weeklyDayOfWeek: number;
  monthlyDayInput: string;
  customIntervalDaysInput: string;
  customAnchorAtMs: number;
  businessDayAdjustment: BusinessDayAdjustment;
};

type ScheduleFormState = {
  frequency: ScheduleFrequency;
  preferredTime: string;
  weeklyDayOfWeek: number;
  monthlyDayInput: string;
  customIntervalDaysInput: string;
  customAnchorAt: Date;
  businessDayAdjustment: BusinessDayAdjustment;
};

function normalizeBusinessDayAdjustment(value: string | undefined): BusinessDayAdjustment {
  if (!value) {
    return DEFAULT_BUSINESS_DAY_ADJUSTMENT;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'strict'
    || normalized === 'following'
    || normalized === 'preceding'
    || normalized === 'modified_following'
    || normalized === 'modified_preceding'
  ) {
    return normalized;
  }
  return DEFAULT_BUSINESS_DAY_ADJUSTMENT;
}

function isSameScheduleFormSnapshot(a: ScheduleFormSnapshot, b: ScheduleFormSnapshot): boolean {
  return a.frequency === b.frequency
    && a.preferredTime === b.preferredTime
    && a.weeklyDayOfWeek === b.weeklyDayOfWeek
    && a.monthlyDayInput === b.monthlyDayInput
    && a.customIntervalDaysInput === b.customIntervalDaysInput
    && a.customAnchorAtMs === b.customAnchorAtMs
    && a.businessDayAdjustment === b.businessDayAdjustment;
}

function isValidDate(value: Date): boolean {
  return Number.isFinite(value.getTime());
}

function withTime(date: Date, timeValue: string): Date {
  const [hoursRaw, minutesRaw] = timeValue.split(':');
  const hours = Number.parseInt(hoursRaw ?? '', 10);
  const minutes = Number.parseInt(minutesRaw ?? '', 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return date;
  }

  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseIntStrict(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function startOfDayKey(value: Date): string {
  return format(value, 'yyyy-MM-dd');
}

function parseDayKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return isValidDate(parsed) ? parsed : null;
}

function formatLocalClock(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function normalizeRuleText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.toUpperCase().startsWith('RRULE:')) {
    return trimmed.slice(6).trim();
  }
  return trimmed;
}

function parseRRuleParts(rruleValue: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of normalizeRuleText(rruleValue).toUpperCase().split(';')) {
    const [keyRaw, valueRaw] = part.split('=');
    const key = keyRaw?.trim();
    const value = valueRaw?.trim();
    if (!key || !value) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function resolveMonthlyDay(parts: Record<string, string>): number {
  const values = (parts.BYMONTHDAY ?? '')
    .split(',')
    .map(raw => Number.parseInt(raw.trim(), 10))
    .filter(value => Number.isFinite(value) && value >= 1 && value <= 31);
  if (values.length === 0) {
    return 1;
  }
  return Math.max(...values);
}

type RebalanceSchedulePreviewFormProps = {
  portfolioID: number;
};

export function RebalanceSchedulePreviewForm({
  portfolioID,
}: RebalanceSchedulePreviewFormProps) {
  const { t, i18n } = useTranslation();
  const [frequency, setFrequency] = useState<ScheduleFrequency>('DAILY');
  const [preferredTime, setPreferredTime] = useState(DEFAULT_PREFERRED_TIME);
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState(DEFAULT_WEEKLY_DAY_OF_WEEK);
  const [monthlyDayInput, setMonthlyDayInput] = useState(DEFAULT_MONTHLY_DAY_INPUT);
  const [customIntervalDaysInput, setCustomIntervalDaysInput] = useState(DEFAULT_CUSTOM_INTERVAL_DAYS_INPUT);
  const [customAnchorAt, setCustomAnchorAt] = useState(() => withTime(new Date(), DEFAULT_PREFERRED_TIME));
  const [businessDayAdjustment, setBusinessDayAdjustment] = useState<BusinessDayAdjustment>(
    DEFAULT_BUSINESS_DAY_ADJUSTMENT,
  );
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelected, setCalendarSelected] = useState<Date | undefined>(new Date());
  const [preview, setPreview] = useState<PortfolioRebalanceSchedulePreviewResponse | null>(null);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [scheduleWorking, setScheduleWorking] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState<ScheduleFormSnapshot | null>(null);

  const weekdayOptions = useMemo(() => [
    { value: 1, label: t('portfolio.replication.schedule.weekdays.mon') },
    { value: 2, label: t('portfolio.replication.schedule.weekdays.tue') },
    { value: 3, label: t('portfolio.replication.schedule.weekdays.wed') },
    { value: 4, label: t('portfolio.replication.schedule.weekdays.thu') },
    { value: 5, label: t('portfolio.replication.schedule.weekdays.fri') },
  ], [t]);
  const businessDayAdjustmentOptions = useMemo(() => [
    {
      value: 'strict' as const,
      label: t('portfolio.replication.schedule.businessDayAdjustment.options.strict'),
    },
    {
      value: 'following' as const,
      label: t('portfolio.replication.schedule.businessDayAdjustment.options.following'),
    },
    {
      value: 'preceding' as const,
      label: t('portfolio.replication.schedule.businessDayAdjustment.options.preceding'),
    },
    {
      value: 'modified_following' as const,
      label: t('portfolio.replication.schedule.businessDayAdjustment.options.modifiedFollowing'),
    },
    {
      value: 'modified_preceding' as const,
      label: t('portfolio.replication.schedule.businessDayAdjustment.options.modifiedPreceding'),
    },
  ], [t]);
  const toSnapshot = useCallback((state: ScheduleFormState): ScheduleFormSnapshot => ({
    frequency: state.frequency,
    preferredTime: state.preferredTime,
    weeklyDayOfWeek: state.weeklyDayOfWeek,
    monthlyDayInput: state.monthlyDayInput,
    customIntervalDaysInput: state.customIntervalDaysInput,
    customAnchorAtMs: state.customAnchorAt.getTime(),
    businessDayAdjustment: state.businessDayAdjustment,
  }), []);
  const toState = useCallback((snapshot: ScheduleFormSnapshot): ScheduleFormState => ({
    frequency: snapshot.frequency,
    preferredTime: snapshot.preferredTime,
    weeklyDayOfWeek: snapshot.weeklyDayOfWeek,
    monthlyDayInput: snapshot.monthlyDayInput,
    customIntervalDaysInput: snapshot.customIntervalDaysInput,
    customAnchorAt: new Date(snapshot.customAnchorAtMs),
    businessDayAdjustment: snapshot.businessDayAdjustment,
  }), []);
  const applyScheduleState = useCallback((nextState: ScheduleFormState) => {
    setFrequency(nextState.frequency);
    setPreferredTime(nextState.preferredTime);
    setWeeklyDayOfWeek(nextState.weeklyDayOfWeek);
    setMonthlyDayInput(nextState.monthlyDayInput);
    setCustomIntervalDaysInput(nextState.customIntervalDaysInput);
    setCustomAnchorAt(nextState.customAnchorAt);
    setBusinessDayAdjustment(nextState.businessDayAdjustment);
    setCalendarMonth(nextState.customAnchorAt);
    setCalendarSelected(nextState.customAnchorAt);
  }, []);
  const buildDefaultScheduleState = useCallback((baseDate: Date): ScheduleFormState => {
    const anchor = withTime(baseDate, DEFAULT_PREFERRED_TIME);
    return {
      frequency: 'DAILY',
      preferredTime: DEFAULT_PREFERRED_TIME,
      weeklyDayOfWeek: DEFAULT_WEEKLY_DAY_OF_WEEK,
      monthlyDayInput: DEFAULT_MONTHLY_DAY_INPUT,
      customIntervalDaysInput: DEFAULT_CUSTOM_INTERVAL_DAYS_INPUT,
      customAnchorAt: anchor,
      businessDayAdjustment: DEFAULT_BUSINESS_DAY_ADJUSTMENT,
    };
  }, []);
  const parseScheduleState = useCallback((schedule: ScheduleConfigResponse): ScheduleFormState | null => {
    const dtStart = schedule.dtstart ? new Date(schedule.dtstart) : null;
    if (!dtStart || !isValidDate(dtStart)) {
      return null;
    }

    const parts = parseRRuleParts(schedule.rrule ?? '');
    const freq = parts.FREQ ?? 'DAILY';
    const interval = Number.parseInt(parts.INTERVAL ?? '1', 10);
    const weeklyToken = (parts.BYDAY ?? 'MO').split(',')[0]?.trim() ?? 'MO';
    const monthlyDay = resolveMonthlyDay(parts);

    let nextFrequency: ScheduleFrequency = 'DAILY';
    if (freq === 'WEEKLY') {
      nextFrequency = 'WEEKLY';
    } else if (freq === 'MONTHLY') {
      nextFrequency = 'MONTHLY';
    } else if (freq === 'DAILY' && Number.isFinite(interval) && interval > 1) {
      nextFrequency = 'CUSTOM_INTERVAL';
    }

    return {
      frequency: nextFrequency,
      preferredTime: formatLocalClock(dtStart),
      weeklyDayOfWeek: clampInt(WEEKDAY_FROM_RRULE[weeklyToken] ?? 1, 1, 5),
      monthlyDayInput: String(monthlyDay),
      customIntervalDaysInput: String(clampInt(interval > 0 ? interval : 14, 1, 365)),
      customAnchorAt: dtStart,
      businessDayAdjustment: normalizeBusinessDayAdjustment(schedule.business_day_adjustment),
    };
  }, []);
  const currentSnapshot = useMemo<ScheduleFormSnapshot>(() => toSnapshot({
    frequency,
    preferredTime,
    weeklyDayOfWeek,
    monthlyDayInput,
    customIntervalDaysInput,
    customAnchorAt,
    businessDayAdjustment,
  }), [
    businessDayAdjustment,
    customAnchorAt,
    customIntervalDaysInput,
    frequency,
    monthlyDayInput,
    preferredTime,
    toSnapshot,
    weeklyDayOfWeek,
  ]);
  const hasUnsavedChanges = useMemo(() => {
    if (!baselineSnapshot) {
      return false;
    }
    return !isSameScheduleFormSnapshot(currentSnapshot, baselineSnapshot);
  }, [baselineSnapshot, currentSnapshot]);

  const formatDateTime = useCallback((value: string) => {
    const date = new Date(value);
    if (!isValidDate(date)) {
      return value;
    }
    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }, [i18n.language]);
  const formatDate = useCallback((value: Date) => new Intl.DateTimeFormat(i18n.language || 'en', {
    dateStyle: 'long',
  }).format(value), [i18n.language]);
  const previewWindowStart = useMemo(
    () => startOfMonth(subMonths(calendarMonth, 1)),
    [calendarMonth],
  );
  const previewWindowEnd = useMemo(
    () => endOfMonth(addMonths(calendarMonth, 1)),
    [calendarMonth],
  );

  const eventDays = useMemo(() => {
    if (!preview?.events?.length) {
      return [] as Date[];
    }
    const byDay = new Map<string, Date>();
    for (const eventAt of preview.events) {
      const parsed = new Date(eventAt);
      if (!isValidDate(parsed)) {
        continue;
      }
      const key = startOfDayKey(parsed);
      if (!byDay.has(key)) {
        byDay.set(key, parsed);
      }
    }
    return [...byDay.values()];
  }, [preview?.events]);
  const nonWorkDays = useMemo(() => {
    if (!preview?.calendar?.length) {
      return [] as Date[];
    }
    const byDay = new Map<string, Date>();
    for (const row of preview.calendar) {
      if (row.is_work_day || !row.date) {
        continue;
      }
      const parsed = parseDayKey(row.date);
      if (!parsed) {
        continue;
      }
      const key = startOfDayKey(parsed);
      if (!byDay.has(key)) {
        byDay.set(key, parsed);
      }
    }
    return [...byDay.values()];
  }, [preview?.calendar]);

  const monthlyRRulePart = useCallback((monthlyDayOfMonth: number) => {
    if (monthlyDayOfMonth <= 1) {
      return 'BYMONTHDAY=1';
    }
    const allDaysUpToTarget = Array.from(
      { length: monthlyDayOfMonth },
      (_, index) => String(index + 1),
    ).join(',');
    return `BYMONTHDAY=${allDaysUpToTarget};BYSETPOS=-1`;
  }, []);

  const resetScheduleInputs = useCallback((markAsBaseline = false) => {
    const nextState = buildDefaultScheduleState(new Date());
    applyScheduleState(nextState);
    if (markAsBaseline) {
      setBaselineSnapshot(toSnapshot(nextState));
    }
  }, [applyScheduleState, buildDefaultScheduleState, toSnapshot]);

  const applySavedSchedule = useCallback((schedule: ScheduleConfigResponse, markAsBaseline = false): boolean => {
    const nextState = parseScheduleState(schedule);
    if (!nextState) {
      return false;
    }
    applyScheduleState(nextState);
    if (markAsBaseline) {
      setBaselineSnapshot(toSnapshot(nextState));
    }
    return true;
  }, [applyScheduleState, parseScheduleState, toSnapshot]);

  const buildSchedulePayload = useCallback((): ScheduleConfigUpsertRequest => {
    const trimmedTime = preferredTime.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmedTime)) {
      throw new Error(t('portfolio.replication.schedule.errors.preferredTime'));
    }

    const normalizedWeekDay = clampInt(weeklyDayOfWeek, 1, 5);
    const monthlyDay = parseIntStrict(monthlyDayInput);
    const customIntervalDays = parseIntStrict(customIntervalDaysInput);

    if (frequency === 'MONTHLY' && (monthlyDay === null || monthlyDay < 1 || monthlyDay > 31)) {
      throw new Error(t('portfolio.replication.schedule.errors.monthlyDay'));
    }

    if (
      frequency === 'CUSTOM_INTERVAL'
      && (customIntervalDays === null || customIntervalDays < 1 || customIntervalDays > 365)
    ) {
      throw new Error(t('portfolio.replication.schedule.errors.customIntervalDays'));
    }

    let dtStart = withTime(new Date(), trimmedTime);
    let rrule = 'FREQ=DAILY';

    if (frequency === 'WEEKLY') {
      const byDay = WEEKDAY_RRULE[normalizedWeekDay] ?? WEEKDAY_RRULE[1];
      rrule = `FREQ=WEEKLY;BYDAY=${byDay}`;
    } else if (frequency === 'MONTHLY') {
      const normalizedMonthlyDay = clampInt(monthlyDay ?? 31, 1, 31);
      rrule = `FREQ=MONTHLY;${monthlyRRulePart(normalizedMonthlyDay)}`;
    } else if (frequency === 'CUSTOM_INTERVAL') {
      const normalizedInterval = clampInt(customIntervalDays ?? 14, 1, 365);
      dtStart = new Date(customAnchorAt);
      rrule = `FREQ=DAILY;INTERVAL=${normalizedInterval}`;
    }

    if (!isValidDate(dtStart)) {
      throw new Error(t('portfolio.replication.schedule.errors.dtstart'));
    }

    return {
      is_enabled: true,
      dtstart: dtStart.toISOString(),
      rrule,
      business_day_adjustment: businessDayAdjustment,
    };
  }, [
    businessDayAdjustment,
    customAnchorAt,
    customIntervalDaysInput,
    frequency,
    monthlyDayInput,
    monthlyRRulePart,
    preferredTime,
    t,
    weeklyDayOfWeek,
  ]);

  const loadSavedSchedule = useCallback(async () => {
    setScheduleWorking(true);
    setSavedUpdatedAt('');
    setError('');
    setPreview(null);
    resetScheduleInputs(true);

    try {
      const response = await axiosClient.get<ScheduleConfigResponse>(
        `/me/portfolios/${portfolioID}/rebalances/schedule`,
      );
      applySavedSchedule(response.data ?? {}, true);
      setSavedUpdatedAt(response.data?.updated_at ?? '');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return;
      }
      if (axios.isAxiosError(err)) {
        setError(
          getApiErrorMessage(err.response?.data as unknown)
          ?? t('portfolio.replication.schedule.errors.load'),
        );
      } else {
        setError(t('portfolio.replication.schedule.errors.load'));
      }
    } finally {
      setScheduleWorking(false);
    }
  }, [applySavedSchedule, portfolioID, resetScheduleInputs, t]);

  useEffect(() => {
    void loadSavedSchedule();
  }, [loadSavedSchedule]);

  const buildPreviewPayload = useCallback((): SchedulePreviewRequestPayload => {
    const trimmedTime = preferredTime.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmedTime)) {
      throw new Error(t('portfolio.replication.schedule.errors.preferredTime'));
    }

    const normalizedWeekDay = clampInt(weeklyDayOfWeek, 1, 5);
    const monthlyDay = parseIntStrict(monthlyDayInput);
    const customIntervalDays = parseIntStrict(customIntervalDaysInput);

    if (frequency === 'MONTHLY' && (monthlyDay === null || monthlyDay < 1 || monthlyDay > 31)) {
      throw new Error(t('portfolio.replication.schedule.errors.monthlyDay'));
    }

    if (
      frequency === 'CUSTOM_INTERVAL'
      && (customIntervalDays === null || customIntervalDays < 1 || customIntervalDays > 365)
    ) {
      throw new Error(t('portfolio.replication.schedule.errors.customIntervalDays'));
    }

    const fromBoundary = new Date(previewWindowStart);
    fromBoundary.setHours(0, 0, 0, 0);
    const toBoundary = new Date(previewWindowEnd);
    toBoundary.setHours(23, 59, 59, 999);

    let dtStart = withTime(fromBoundary, trimmedTime);
    let rrule = 'FREQ=DAILY';

    if (frequency === 'WEEKLY') {
      const byDay = WEEKDAY_RRULE[normalizedWeekDay] ?? WEEKDAY_RRULE[1];
      rrule = `FREQ=WEEKLY;BYDAY=${byDay}`;
    } else if (frequency === 'MONTHLY') {
      const normalizedMonthlyDay = clampInt(monthlyDay ?? 31, 1, 31);
      rrule = `FREQ=MONTHLY;${monthlyRRulePart(normalizedMonthlyDay)}`;
    } else if (frequency === 'CUSTOM_INTERVAL') {
      const normalizedInterval = clampInt(customIntervalDays ?? 14, 1, 365);
      dtStart = new Date(customAnchorAt);
      rrule = `FREQ=DAILY;INTERVAL=${normalizedInterval}`;
    }

    if (!isValidDate(dtStart)) {
      throw new Error(t('portfolio.replication.schedule.errors.dtstart'));
    }

    return {
      dtstart: dtStart.toISOString(),
      rrule,
      business_day_adjustment: businessDayAdjustment,
      from: fromBoundary.toISOString(),
      to: toBoundary.toISOString(),
    };
  }, [
    businessDayAdjustment,
    customAnchorAt,
    customIntervalDaysInput,
    frequency,
    monthlyDayInput,
    monthlyRRulePart,
    previewWindowEnd,
    previewWindowStart,
    preferredTime,
    t,
    weeklyDayOfWeek,
  ]);

  const onPreview = useCallback(async () => {
    setWorking(true);
    setError('');
    try {
      const payload = buildPreviewPayload();
      const response = await portfolioApi.mePortfoliosIdRebalancesSchedulePreviewPost(
        portfolioID,
        payload,
      );
      const data = response.data;
      setPreview({
        events: data.events ?? [],
        calendar: (data.calendar ?? []).map(row => ({
          date: row.date ?? '',
          source: row.source ?? 'none',
          day_code: row.day_code ?? '',
          day_type: row.day_type ?? 'unknown',
          is_work_day: row.is_work_day === true,
          start_time: row.start_time,
          stop_time: row.stop_time,
        })),
      });
    } catch (err) {
      if (err instanceof Error && !axios.isAxiosError(err)) {
        setError(err.message);
      } else if (axios.isAxiosError(err)) {
        setError(
          getApiErrorMessage(err.response?.data as unknown)
          ?? t('portfolio.replication.schedule.errors.preview'),
        );
      } else {
        setError(t('portfolio.replication.schedule.errors.preview'));
      }
      setPreview(null);
    } finally {
      setWorking(false);
    }
  }, [buildPreviewPayload, portfolioID, t]);

  const onSaveSchedule = useCallback(async () => {
    setScheduleWorking(true);
    setError('');
    try {
      const payload = buildSchedulePayload();
      const response = await axiosClient.put<ScheduleConfigResponse>(
        `/me/portfolios/${portfolioID}/rebalances/schedule`,
        payload,
      );
      const data = response.data ?? {};
      if (!applySavedSchedule(data, true)) {
        setBaselineSnapshot(currentSnapshot);
      }
      setSavedUpdatedAt(data.updated_at ?? '');
    } catch (err) {
      if (err instanceof Error && !axios.isAxiosError(err)) {
        setError(err.message);
      } else if (axios.isAxiosError(err)) {
        setError(
          getApiErrorMessage(err.response?.data as unknown)
          ?? t('portfolio.replication.schedule.errors.save'),
        );
      } else {
        setError(t('portfolio.replication.schedule.errors.save'));
      }
    } finally {
      setScheduleWorking(false);
    }
  }, [applySavedSchedule, buildSchedulePayload, currentSnapshot, portfolioID, t]);

  const onDeleteSchedule = useCallback(async () => {
    setScheduleWorking(true);
    setError('');
    try {
      await axiosClient.delete(`/me/portfolios/${portfolioID}/rebalances/schedule`);
      setSavedUpdatedAt('');
      setPreview(null);
      resetScheduleInputs(true);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(
          getApiErrorMessage(err.response?.data as unknown)
          ?? t('portfolio.replication.schedule.errors.delete'),
        );
      } else {
        setError(t('portfolio.replication.schedule.errors.delete'));
      }
    } finally {
      setScheduleWorking(false);
    }
  }, [portfolioID, resetScheduleInputs, t]);

  const onDiscardChanges = useCallback(() => {
    if (!baselineSnapshot) {
      return;
    }
    applyScheduleState(toState(baselineSnapshot));
    setError('');
  }, [applyScheduleState, baselineSnapshot, toState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void onPreview();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [onPreview]);

  const events = useMemo(() => preview?.events ?? [], [preview?.events]);
  const eventsInCurrentMonth = useMemo(
    () => events.filter(eventAt => {
      const parsed = new Date(eventAt);
      return isValidDate(parsed) && isSameMonth(parsed, calendarMonth);
    }),
    [calendarMonth, events],
  );
  const eventRows = useMemo<EventRow[]>(
    () => eventsInCurrentMonth.map((eventAt, index) => ({ id: `${eventAt}-${index}`, eventAt })),
    [eventsInCurrentMonth],
  );
  const calendarRows = useMemo(() => preview?.calendar ?? [], [preview?.calendar]);
  const selectedDayKey = useMemo(() => {
    if (!calendarSelected || !isValidDate(calendarSelected)) {
      return null;
    }
    return startOfDayKey(calendarSelected);
  }, [calendarSelected]);
  const selectedDayEvents = useMemo(() => {
    if (!selectedDayKey) {
      return [] as string[];
    }
    return events.filter(eventAt => {
      const parsed = new Date(eventAt);
      return isValidDate(parsed) && startOfDayKey(parsed) === selectedDayKey;
    });
  }, [events, selectedDayKey]);
  const selectedDay = useMemo(
    () => (selectedDayKey ? calendarRows.find(row => row.date === selectedDayKey) ?? null : null),
    [calendarRows, selectedDayKey],
  );
  const selectedDayTypeLabel = useMemo(() => {
    if (!selectedDay?.day_type) {
      return '-';
    }
    switch (selectedDay.day_type) {
      case 'workday':
        return t('portfolio.replication.schedule.dayTypes.workday');
      case 'non_working_day':
        return t('portfolio.replication.schedule.dayTypes.nonWorkingDay');
      case 'shortened_workday':
        return t('portfolio.replication.schedule.dayTypes.shortenedWorkday');
      case 'special_workday':
        return t('portfolio.replication.schedule.dayTypes.specialWorkday');
      case 'public_holiday':
        return t('portfolio.replication.schedule.dayTypes.publicHoliday');
      default:
        return t('portfolio.replication.schedule.dayTypes.unknown');
    }
  }, [selectedDay?.day_type, t]);

  const eventColumns = useMemo<ColumnDef<EventRow>[]>(() => [
    {
      id: 'idx',
      header: '#',
      enableSorting: false,
      cell: ({ row }) => row.index + 1,
    },
    {
      accessorFn: row => row.eventAt,
      id: 'eventAt',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.schedule.eventsAt')}
        />
      ),
      cell: ({ row }) => formatDateTime(row.original.eventAt),
    },
  ], [formatDateTime, t]);

  const savedAtLabel = useMemo(() => {
    if (!savedUpdatedAt) {
      return t('portfolio.replication.schedule.savedAtEmpty');
    }
    return formatDateTime(savedUpdatedAt);
  }, [formatDateTime, savedUpdatedAt, t]);

  return (
    <div className='grid min-h-0 gap-4'>
      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid gap-3'>
        <div className='grid lg:grid-cols-3'>
          <div className='grid gap-2 rounded-l-md border justify-items-center'>
            <div className='w-full border-b px-2 py-2 text-sm font-medium'>
              {t('portfolio.replication.schedule.calendarTitle')}
            </div>
            <Calendar
              weekStartsOn={1}
              mode='single'
              month={calendarMonth}
              selected={calendarSelected}
              onSelect={setCalendarSelected}
              onMonthChange={nextMonth => {
                setCalendarMonth(nextMonth);
                setPreview(null);
                setError('');
              }}
              className='min-h-[331px]'
              modifiers={{
                event: eventDays,
                nonWorkday: nonWorkDays,
              }}
              modifiersClassNames={{
                nonWorkday: '[&>button]:line-through opacity-50',
              }}
              components={{
                DayButton: ({ children, modifiers, day, ...props }) => (
                  <CalendarDayButton day={day} modifiers={modifiers} {...props}>
                    {children}
                    {modifiers.event ? (
                      <span
                        aria-hidden
                        className={`inline-block size-1.5 rounded-full ${modifiers.selected ? 'bg-primary-foreground' : 'bg-emerald-500'
                          }`}
                      />
                    ) :
                      <span
                        aria-hidden
                        className='inline-block size-1.5 rounded-full'
                      />}
                  </CalendarDayButton>
                ),
              }}
              captionLayout='dropdown'
            />
            <div className='grid justify-items-center items-center gap-2 text-xs text-muted-foreground px-4 pb-2'>
              <span className='inline-flex items-center gap-1'>
                <span className='inline-block size-1.5 rounded-full bg-emerald-500' />
                {t('portfolio.replication.schedule.legendEventDay')}
              </span>
            </div>
          </div>

          <div className='border-y text-xs'>
            <div className='w-full border-b px-2 py-2 text-sm font-medium'>
              <p>
                {t('portfolio.replication.schedule.selectedDateTitle', {
                  date: calendarSelected ? formatDate(calendarSelected) : '-',
                })}
              </p>
            </div>
            {!preview ? (
              <p className='mt-1 px-2 py-2 text-muted-foreground'>
                {t('portfolio.replication.schedule.selectedDateNeedPreview')}
              </p>
            ) : (
              <div className='grid gap-2 px-2 py-2'>
                <div>
                  <p className='font-medium'>
                    {t('portfolio.replication.schedule.selectedDateEventsLabel')}
                    {' '}
                    {selectedDayEvents.length}
                  </p>
                  {selectedDayEvents.length === 0 ? (
                    <p className='text-muted-foreground'>
                      {t('portfolio.replication.schedule.selectedDateNoEvents')}
                    </p>
                  ) : (
                    <div className='grid gap-1'>
                      {selectedDayEvents.map((eventAt, index) => (
                        <p key={`${eventAt}-${index}`} className='font-mono'>
                          {formatDateTime(eventAt)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className='grid gap-1'>
                  <p>
                    <span className='font-medium'>{t('portfolio.replication.schedule.selectedDateMoexSource')}</span>
                    {' '}
                    <span className='font-mono'>{selectedDay?.source ?? '-'}</span>
                  </p>
                  <p>
                    <span className='font-medium'>{t('portfolio.replication.schedule.selectedDateMoexWorkday')}</span>
                    {' '}
                    {selectedDay
                      ? (selectedDay.is_work_day
                        ? t('portfolio.replication.schedule.yes')
                        : t('portfolio.replication.schedule.no'))
                      : '-'}
                  </p>
                  <p>
                    <span className='font-medium'>{t('portfolio.replication.schedule.selectedDateDayType')}</span>
                    {' '}
                    <span className='font-mono'>
                      {selectedDayTypeLabel}
                    </span>
                  </p>
                  <p>
                    <span className='font-medium'>{t('portfolio.replication.schedule.selectedDateMoexWindow')}</span>
                    {' '}
                    <span className='font-mono'>
                      {selectedDay?.start_time && selectedDay?.stop_time
                        ? `${selectedDay.start_time} - ${selectedDay.stop_time}`
                        : '-'}
                    </span>
                  </p>
                  {!selectedDay ? (
                    <p className='text-muted-foreground'>
                      {t('portfolio.replication.schedule.selectedDateNoMoex')}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          <div className='flex flex-col rounded-r-md border'>
            <div className='w-full border-b px-2 py-2 text-sm font-medium'>
              <p>{t('portfolio.replication.schedule.eventsTitle')}</p>
            </div>
            <div className='h-full relative'>
              <div className='absolute  inset-0'>
                <SortableDataTable
                  data={eventRows}
                  columns={eventColumns}
                  emptyLabel={t('portfolio.replication.schedule.eventsEmpty')}
                  getRowKey={row => row.id}
                  className='h-full border-none rounded-tl-none'
                />
              </div>
            </div>
          </div>
        </div>

        <div className='grid gap-2 md:grid-cols-2 md:items-start'>
          <div className='grid gap-2 self-start'>
            <Label htmlFor='schedule-preferred-time'>
              {t('portfolio.replication.schedule.preferredTimeLabel')}
            </Label>
            <Input
              id='schedule-preferred-time'
              type='time'
              value={preferredTime}
              onChange={event => setPreferredTime(event.target.value)}
              step={60}
            />
          </div>
          <div className='grid gap-2 self-start'>
            <div className='flex items-center gap-1'>
              <Label htmlFor='schedule-business-day-adjustment'>
                {t('portfolio.replication.schedule.businessDayAdjustment.label')}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type='button'
                    aria-label={t('portfolio.replication.schedule.businessDayAdjustment.tooltipLabel')}
                    className='text-muted-foreground transition-colors hover:text-foreground'
                  >
                    <CircleHelp className='size-4' />
                  </button>
                </TooltipTrigger>
                <TooltipContent side='top' className='max-w-sm space-y-1'>
                  <p className='font-medium'>
                    {t('portfolio.replication.schedule.businessDayAdjustment.tooltip.title')}
                  </p>
                  <p>{t('portfolio.replication.schedule.businessDayAdjustment.tooltip.strict')}</p>
                  <p>{t('portfolio.replication.schedule.businessDayAdjustment.tooltip.following')}</p>
                  <p>{t('portfolio.replication.schedule.businessDayAdjustment.tooltip.preceding')}</p>
                  <p>{t('portfolio.replication.schedule.businessDayAdjustment.tooltip.modifiedFollowing')}</p>
                  <p>{t('portfolio.replication.schedule.businessDayAdjustment.tooltip.modifiedPreceding')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={businessDayAdjustment}
              onValueChange={value => {
                setBusinessDayAdjustment(normalizeBusinessDayAdjustment(value));
              }}
            >
              <SelectTrigger id='schedule-business-day-adjustment' className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {businessDayAdjustmentOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              {t('portfolio.replication.schedule.businessDayAdjustment.hint')}
            </p>
          </div>
        </div>

        <div className='grid gap-2'>
          <Label>{t('portfolio.replication.schedule.frequencyLabel')}</Label>
          <Tabs
            value={frequency}
            onValueChange={value => setFrequency(value as ScheduleFrequency)}
            className='w-full'
          >
            <TabsList className='grid h-auto w-full grid-cols-2 md:grid-cols-4'>
              <TabsTrigger value='DAILY'>
                {t('portfolio.replication.schedule.frequency.daily')}
              </TabsTrigger>
              <TabsTrigger value='WEEKLY'>
                {t('portfolio.replication.schedule.frequency.weekly')}
              </TabsTrigger>
              <TabsTrigger value='MONTHLY'>
                {t('portfolio.replication.schedule.frequency.monthly')}
              </TabsTrigger>
              <TabsTrigger value='CUSTOM_INTERVAL'>
                {t('portfolio.replication.schedule.frequency.customInterval')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className='grid gap-2 md:grid-cols-4'>
          {frequency === 'WEEKLY' ? (
            <div className='grid gap-2'>
              <Label htmlFor='schedule-weekly-day'>
                {t('portfolio.replication.schedule.weeklyDayLabel')}
              </Label>
              <Select
                value={String(weeklyDayOfWeek)}
                onValueChange={value => {
                  const parsed = Number.parseInt(value, 10);
                  setWeeklyDayOfWeek(Number.isFinite(parsed) ? clampInt(parsed, 1, 5) : 1);
                }}
              >
                <SelectTrigger id='schedule-weekly-day' className='w-full'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {weekdayOptions.map(option => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {frequency === 'MONTHLY' ? (
            <div className='grid gap-2'>
              <Label htmlFor='schedule-monthly-day'>
                {t('portfolio.replication.schedule.monthlyDayLabel')}
              </Label>
              <Input
                id='schedule-monthly-day'
                type='number'
                min={1}
                max={31}
                value={monthlyDayInput}
                onChange={event => setMonthlyDayInput(event.target.value)}
              />
            </div>
          ) : null}

          {frequency === 'CUSTOM_INTERVAL' ? (
            <>
              <div className='grid gap-2'>
                <Label htmlFor='schedule-custom-interval-days'>
                  {t('portfolio.replication.schedule.customIntervalDaysLabel')}
                </Label>
                <Input
                  id='schedule-custom-interval-days'
                  type='number'
                  min={1}
                  max={365}
                  value={customIntervalDaysInput}
                  onChange={event => setCustomIntervalDaysInput(event.target.value)}
                />
              </div>
              <div className='md:col-span-2'>
                <DateTimePicker
                  idPrefix='schedule-custom-anchor'
                  label={t('portfolio.replication.schedule.customAnchorLabel')}
                  value={customAnchorAt}
                  dateLabel={t('portfolio.replication.schedule.datePlaceholder')}
                  timeLabel={t('portfolio.replication.schedule.timeLabel')}
                  onChange={setCustomAnchorAt}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button type='button' onClick={() => void onPreview()} disabled={working || scheduleWorking}>
            <CalendarClock className='size-4' />
            {t('portfolio.replication.schedule.previewButton')}
          </Button>
          {hasUnsavedChanges ? (
            <Button
              type='button'
              variant='outline'
              onClick={onDiscardChanges}
              disabled={working || scheduleWorking}
            >
              <RotateCcw className='size-4' />
              {t('portfolio.replication.schedule.discardButton')}
            </Button>
          ) : null}
          {working ? (
            <span className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
              <Loader2 className='size-3.5 animate-spin' />
              {t('portfolio.replication.schedule.previewWorking')}
            </span>
          ) : null}
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={() => void onSaveSchedule()}
            disabled={working || scheduleWorking || !hasUnsavedChanges}
          >
            <Save className='size-4' />
            {scheduleWorking
              ? t('portfolio.replication.schedule.saveWorking')
              : t('portfolio.replication.schedule.saveButton')}
          </Button>
          <Button type='button' variant='destructive' onClick={() => void onDeleteSchedule()} disabled={working || scheduleWorking}>
            <Trash2 className='size-4' />
            {scheduleWorking
              ? t('portfolio.replication.schedule.deleteWorking')
              : t('portfolio.replication.schedule.deleteButton')}
          </Button>
          <span className='text-xs text-muted-foreground'>
            {t('portfolio.replication.schedule.savedAtLabel')}: {savedAtLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
