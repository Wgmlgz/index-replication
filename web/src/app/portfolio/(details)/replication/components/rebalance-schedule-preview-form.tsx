'use client';

import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';

import type { PortfolioRebalanceSchedulePreviewRequest } from '@/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SortHeader, SortableDataTable } from '@/app/portfolio/components/sortable-data-table';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';

type ScheduleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_INTERVAL';

type SchedulePreviewResponse = {
  events: string[];
  moex: {
    engine: string;
    calendar: Array<{
      date: string;
      source: string;
      is_work_day: boolean;
      start_time?: string;
      stop_time?: string;
    }>;
  };
};

type EventRow = {
  id: string;
  eventAt: string;
};

type MoexCalendarRow = {
  date: string;
  source: string;
  is_work_day: boolean;
  start_time?: string;
  stop_time?: string;
};

type DateTimePickerProps = {
  idPrefix: string;
  label: string;
  value: Date;
  dateLabel: string;
  timeLabel: string;
  onChange: (nextValue: Date) => void;
};

const WEEKDAY_RRULE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

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

function replaceDatePart(base: Date, pickedDate: Date): Date {
  const next = new Date(base);
  next.setFullYear(
    pickedDate.getFullYear(),
    pickedDate.getMonth(),
    pickedDate.getDate(),
  );
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

function DateTimePicker({
  idPrefix,
  label,
  value,
  dateLabel,
  timeLabel,
  onChange,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const dateButtonLabel = isValidDate(value)
    ? format(value, 'yyyy-MM-dd')
    : dateLabel;
  const timeValue = isValidDate(value) ? format(value, 'HH:mm') : '00:00';

  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={`${idPrefix}-date`}
              type='button'
              variant='outline'
              className='justify-start text-left font-normal'
            >
              <CalendarIcon className='size-4' />
              {dateButtonLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start'>
            <Calendar
              mode='single'
              selected={value}
              onSelect={nextDate => {
                if (!nextDate) {
                  return;
                }
                onChange(replaceDatePart(value, nextDate));
                setOpen(false);
              }}
              captionLayout='dropdown'
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <div className='grid gap-1'>
          <Label htmlFor={`${idPrefix}-time`} className='text-xs text-muted-foreground'>
            {timeLabel}
          </Label>
          <Input
            id={`${idPrefix}-time`}
            type='time'
            value={timeValue}
            onChange={event => onChange(withTime(value, event.target.value))}
            step={60}
          />
        </div>
      </div>
    </div>
  );
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
  const [monthlyDayInput, setMonthlyDayInput] = useState('31');
  const [customIntervalDaysInput, setCustomIntervalDaysInput] = useState('14');
  const [customAnchorAt, setCustomAnchorAt] = useState(() => withTime(new Date(), '09:30'));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [calendarSelected, setCalendarSelected] = useState<Date | undefined>(new Date());
  const [preview, setPreview] = useState<SchedulePreviewResponse | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const weekdayOptions = useMemo(() => [
    { value: 0, label: t('portfolio.replication.schedule.weekdays.sun') },
    { value: 1, label: t('portfolio.replication.schedule.weekdays.mon') },
    { value: 2, label: t('portfolio.replication.schedule.weekdays.tue') },
    { value: 3, label: t('portfolio.replication.schedule.weekdays.wed') },
    { value: 4, label: t('portfolio.replication.schedule.weekdays.thu') },
    { value: 5, label: t('portfolio.replication.schedule.weekdays.fri') },
    { value: 6, label: t('portfolio.replication.schedule.weekdays.sat') },
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

  const buildPreviewPayload = useCallback((): PortfolioRebalanceSchedulePreviewRequest => {
    const trimmedTime = preferredTime.trim();
    if (!/^\d{2}:\d{2}$/.test(trimmedTime)) {
      throw new Error(t('portfolio.replication.schedule.errors.preferredTime'));
    }

    const normalizedWeekDay = clampInt(weeklyDayOfWeek, 0, 6);
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

    const fromBoundary = startOfMonth(calendarMonth);
    fromBoundary.setHours(0, 0, 0, 0);
    const toBoundary = endOfMonth(calendarMonth);
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
    calendarMonth,
    customAnchorAt,
    customIntervalDaysInput,
    frequency,
    monthlyDayInput,
    monthlyRRulePart,
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
        moex: {
          engine: data.moex?.engine ?? '',
          calendar: (data.moex?.calendar ?? []).map(row => ({
            date: row.date ?? '',
            source: row.source ?? 'none',
            is_work_day: row.is_work_day === true,
            start_time: row.start_time,
            stop_time: row.stop_time,
          })),
        },
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

  const events = useMemo(() => preview?.events ?? [], [preview?.events]);
  const eventRows = useMemo<EventRow[]>(
    () => events.map((eventAt, index) => ({ id: `${eventAt}-${index}`, eventAt })),
    [events],
  );
  const moexRows = useMemo(() => preview?.moex.calendar ?? [], [preview?.moex.calendar]);

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

  const moexColumns = useMemo<ColumnDef<MoexCalendarRow>[]>(() => [
    {
      accessorFn: row => row.date,
      id: 'date',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.schedule.moexDate')}
        />
      ),
      cell: ({ row }) => row.original.date,
    },
    {
      accessorFn: row => row.source,
      id: 'source',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.schedule.moexSource')}
        />
      ),
      cell: ({ row }) => <span className='font-mono text-xs'>{row.original.source}</span>,
    },
    {
      accessorFn: row => (row.is_work_day ? 1 : 0),
      id: 'is_work_day',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.schedule.moexWorkday')}
        />
      ),
      cell: ({ row }) => (row.original.is_work_day
        ? t('portfolio.replication.schedule.yes')
        : t('portfolio.replication.schedule.no')),
    },
    {
      accessorFn: row => (row.start_time && row.stop_time ? `${row.start_time}-${row.stop_time}` : ''),
      id: 'window',
      header: ({ column }) => (
        <SortHeader
          column={column}
          label={t('portfolio.replication.schedule.moexWindow')}
        />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.start_time && row.original.stop_time
            ? `${row.original.start_time} - ${row.original.stop_time}`
            : '-'}
        </span>
      ),
    },
  ], [t]);

  return (
    <div className='grid min-h-0 gap-4'>
      {error ? (
        <Alert variant='destructive'>
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid gap-3 rounded-md border p-3'>
        <div className='grid gap-3 lg:grid-cols-2'>
          <div className='grid gap-2 rounded-md border p-2'>
            <p className='text-sm font-medium'>{t('portfolio.replication.schedule.calendarTitle')}</p>
            <p className='text-xs text-muted-foreground'>
              {t('portfolio.replication.schedule.calendarHint', {
                from: format(startOfMonth(calendarMonth), 'yyyy-MM-dd'),
                to: format(endOfMonth(calendarMonth), 'yyyy-MM-dd'),
              })}
            </p>
            <div className='flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <span className='inline-flex items-center gap-1'>
                <span className='inline-block size-2 rounded-sm bg-emerald-500' />
                {t('portfolio.replication.schedule.legendEventDay')}
              </span>
            </div>
            <Calendar
              mode='single'
              month={calendarMonth}
              selected={calendarSelected}
              onSelect={setCalendarSelected}
              onMonthChange={nextMonth => {
                setCalendarMonth(nextMonth);
                setPreview(null);
                setError('');
              }}
              modifiers={{
                event: eventDays,
              }}
              modifiersClassNames={{
                event: 'bg-emerald-100 text-emerald-900',
              }}
              captionLayout='dropdown'
            />
          </div>

          <div className='flex gap-2 flex-col rounded-md border p-2'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-medium'>{t('portfolio.replication.schedule.eventsTitle')}</p>
              <Badge variant='outline'>
                {t('portfolio.replication.schedule.eventsCount', { count: events.length })}
              </Badge>
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
                setWeeklyDayOfWeek(Number.isFinite(parsed) ? clampInt(parsed, 0, 6) : 1);
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
          <div className='grid gap-2 sm:max-w-48'>
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
          <div className='grid gap-3'>
            <div className='grid gap-2 sm:max-w-48'>
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
            <DateTimePicker
              idPrefix='schedule-custom-anchor'
              label={t('portfolio.replication.schedule.customAnchorLabel')}
              value={customAnchorAt}
              dateLabel={t('portfolio.replication.schedule.datePlaceholder')}
              timeLabel={t('portfolio.replication.schedule.timeLabel')}
              onChange={setCustomAnchorAt}
            />
          </div>
        ) : null}

        <Button type='button' onClick={() => void onPreview()} disabled={working}>
          {working
            ? t('portfolio.replication.schedule.previewWorking')
            : t('portfolio.replication.schedule.previewButton')}
        </Button>
      </div>

      <div className='grid gap-3 rounded-md border p-3'>
        <div className='flex flex-wrap items-center gap-2'>
          <h4 className='font-medium'>{t('portfolio.replication.schedule.previewTitle')}</h4>
        </div>

        {!preview ? (
          <p className='text-sm text-muted-foreground'>
            {t('portfolio.replication.schedule.previewEmpty')}
          </p>
        ) : (
          <>
            <div className='grid gap-2'>
              <h5 className='text-sm font-medium'>{t('portfolio.replication.schedule.moexTitle')}</h5>
              <div className='rounded-md border p-2 text-xs'>
                <p>
                  <span className='font-medium'>{t('portfolio.replication.schedule.moexEngine')}</span>
                  {' '}
                  <span className='font-mono'>{preview.moex.engine}</span>
                </p>
              </div>
              <div className='grid gap-2 lg:grid-cols-2'>
                <div className='rounded-md border p-2 lg:col-span-2'>
                  <p className='mb-2 text-xs font-medium'>
                    {t('portfolio.replication.schedule.moexCalendar')}
                  </p>
                  <SortableDataTable
                    data={moexRows}
                    columns={moexColumns}
                    emptyLabel={t('portfolio.replication.schedule.moexEmpty')}
                    getRowKey={(row, index) => `${row.date}-${index}`}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
