'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { CalendarClock, Save, Trash2 } from 'lucide-react';
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
import { SortHeader, SortableDataTable } from '@/app/portfolio/components/sortable-data-table';
import { axiosClient, portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';

type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_INTERVAL';

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
  updated_at?: string;
};

type ScheduleConfigUpsertRequest = {
  is_enabled: boolean;
  dtstart: string;
  rrule: string;
};

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

function formatUTCClock(value: Date): string {
  const hours = String(value.getUTCHours()).padStart(2, '0');
  const minutes = String(value.getUTCMinutes()).padStart(2, '0');
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
  const [preferredTime, setPreferredTime] = useState('09:30');
  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState(1);
  const [monthlyDayInput, setMonthlyDayInput] = useState('1');
  const [customIntervalDaysInput, setCustomIntervalDaysInput] = useState('14');
  const [customAnchorAt, setCustomAnchorAt] = useState(() => withTime(new Date(), '09:30'));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelected, setCalendarSelected] = useState<Date | undefined>(new Date());
  const [preview, setPreview] = useState<PortfolioRebalanceSchedulePreviewResponse | null>(null);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [scheduleWorking, setScheduleWorking] = useState(false);

  const weekdayOptions = useMemo(() => [
    { value: 1, label: t('portfolio.replication.schedule.weekdays.mon') },
    { value: 2, label: t('portfolio.replication.schedule.weekdays.tue') },
    { value: 3, label: t('portfolio.replication.schedule.weekdays.wed') },
    { value: 4, label: t('portfolio.replication.schedule.weekdays.thu') },
    { value: 5, label: t('portfolio.replication.schedule.weekdays.fri') },
  ], [t]);

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

  const resetScheduleInputs = useCallback(() => {
    const now = new Date();
    setFrequency('DAILY');
    setPreferredTime('09:30');
    setWeeklyDayOfWeek(1);
    setMonthlyDayInput('1');
    setCustomIntervalDaysInput('14');
    setCustomAnchorAt(withTime(now, '09:30'));
    setCalendarMonth(now);
    setCalendarSelected(now);
  }, []);

  const applySavedSchedule = useCallback((schedule: ScheduleConfigResponse) => {
    const dtStart = schedule.dtstart ? new Date(schedule.dtstart) : null;
    if (!dtStart || !isValidDate(dtStart)) {
      return;
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

    setFrequency(nextFrequency);
    setPreferredTime(formatUTCClock(dtStart));
    setWeeklyDayOfWeek(clampInt(WEEKDAY_FROM_RRULE[weeklyToken] ?? 1, 1, 5));
    setMonthlyDayInput(String(monthlyDay));
    setCustomIntervalDaysInput(String(clampInt(interval > 0 ? interval : 14, 1, 365)));
    setCustomAnchorAt(dtStart);
    setCalendarMonth(dtStart);
    setCalendarSelected(dtStart);
  }, []);

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
    };
  }, [
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
    resetScheduleInputs();

    try {
      const response = await axiosClient.get<ScheduleConfigResponse>(
        `/me/portfolios/${portfolioID}/rebalances/schedule`,
      );
      applySavedSchedule(response.data ?? {});
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

  const buildPreviewPayload = useCallback((): PortfolioRebalanceSchedulePreviewRequest => {
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
      from: fromBoundary.toISOString(),
      to: toBoundary.toISOString(),
    };
  }, [
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
      applySavedSchedule(data);
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
  }, [applySavedSchedule, buildSchedulePayload, portfolioID, t]);

  const onDeleteSchedule = useCallback(async () => {
    setScheduleWorking(true);
    setError('');
    try {
      await axiosClient.delete(`/me/portfolios/${portfolioID}/rebalances/schedule`);
      setSavedUpdatedAt('');
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
  }, [portfolioID, t]);

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
        <div className='grid gap-3 lg:grid-cols-3'>
          <div className='grid gap-2 rounded-md border justify-items-center'>
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

          <div className='rounded-md border p-2 text-xs'>
            <div className='border-b pb-2'>
              <p className='text-sm font-medium'>
                {t('portfolio.replication.schedule.selectedDateTitle', {
                  date: calendarSelected ? formatDate(calendarSelected) : '-',
                })}
              </p>
            </div>
            {!preview ? (
              <p className='mt-1 text-muted-foreground'>
                {t('portfolio.replication.schedule.selectedDateNeedPreview')}
              </p>
            ) : (
              <div className='mt-2 grid gap-2'>
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

          <div className='flex gap-2 flex-col rounded-md border p-2'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-medium'>{t('portfolio.replication.schedule.eventsTitle')}</p>
            </div>
            <div className='h-full relative'>
              <div className='absolute  inset-0'>
                <SortableDataTable
                  data={eventRows}
                  columns={eventColumns}
                  emptyLabel={t('portfolio.replication.schedule.eventsEmpty')}
                  getRowKey={row => row.id}
                  className='h-full'
                />
              </div>
            </div>
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

        <div className='grid gap-2 grid-cols-4'>
          <div className='grid gap-2'>
            <div className='grid gap-2'>
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
          </div>

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
              <div className='col-span-2'>
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
            {working
              ? t('portfolio.replication.schedule.previewWorking')
              : t('portfolio.replication.schedule.previewButton')}
          </Button>
          <Button type='button' variant='outline' onClick={() => void onSaveSchedule()} disabled={working || scheduleWorking}>
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
