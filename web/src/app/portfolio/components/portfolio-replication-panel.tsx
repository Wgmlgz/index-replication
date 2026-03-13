'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import type {
  MoexIndex,
  PortfolioRebalanceCreateRequest,
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceItem,
  PortfolioRebalanceRun,
} from '@/api-client';
import type { NormalizedPortfolioProfile, PortfolioReplicationConfig } from '@/app/portfolio/use-portfolio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoexIndexSelectorDialog } from '@/components/moex-indexes/list/moex-index-selector-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { axiosClient, getApiUrl, portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';

type PortfolioReplicationPanelProps = {
  portfolioID: number | null;
  profile: NormalizedPortfolioProfile | null;
  refreshProfiles: () => Promise<void>;
};

type ReplicationFormState = {
  isEnabled: boolean;
  benchmarkSecid: string;
  modeKey: string;
  modeParamsRaw: string;
  updatedAt: string;
};

type RebalanceDraftFormState = {
  executionMode: 'manual' | 'automatic';
  asOfDate: string;
};

type ReplicationViewTab = 'settings' | 'drafts';

const EMPTY_FORM_STATE: ReplicationFormState = {
  isEnabled: false,
  benchmarkSecid: '',
  modeKey: 'full',
  modeParamsRaw: '{}',
  updatedAt: '',
};

const EMPTY_DRAFT_FORM: RebalanceDraftFormState = {
  executionMode: 'manual',
  asOfDate: '',
};

const REPLICATION_MODE_OPTIONS = ['full', 'sampled'] as const;

function toFormState(config: PortfolioReplicationConfig | null): ReplicationFormState {
  if (!config) {
    return { ...EMPTY_FORM_STATE };
  }

  return {
    isEnabled: config.is_enabled,
    benchmarkSecid: config.benchmark_secid ?? '',
    modeKey: config.mode_key || 'full',
    modeParamsRaw: JSON.stringify(config.mode_params ?? {}, null, 2),
    updatedAt: config.updated_at || '',
  };
}

function parseRebalanceID(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseReplicationViewTab(
  value: string | null,
  fallback: ReplicationViewTab,
): ReplicationViewTab {
  if (value === 'settings' || value === 'drafts') {
    return value;
  }
  return fallback;
}

function formatDateTime(value: string | undefined, language: string): string {
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

function formatNumber(value: number | undefined, fractionDigits = 4): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '-';
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function extractSummaryNumber(run: PortfolioRebalanceRun | undefined, key: string): number | null {
  const raw: unknown = run?.summary?.[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function unresolvedReason(item: PortfolioRebalanceItem): string {
  const reason: unknown = item.metadata?.reason;
  return typeof reason === 'string' && reason.trim().length > 0
    ? reason
    : '-';
}

export function PortfolioReplicationPanel({
  portfolioID,
  profile,
  refreshProfiles,
}: PortfolioReplicationPanelProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [form, setForm] = useState<ReplicationFormState>({ ...EMPTY_FORM_STATE });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const [draftForm, setDraftForm] = useState<RebalanceDraftFormState>({ ...EMPTY_DRAFT_FORM });
  const [rebalanceRuns, setRebalanceRuns] = useState<PortfolioRebalanceRun[]>([]);
  const [rebalanceDetail, setRebalanceDetail] = useState<PortfolioRebalanceDetailResponse | null>(null);
  const [rebalanceError, setRebalanceError] = useState('');
  const [rebalanceListLoading, setRebalanceListLoading] = useState(false);
  const [rebalanceDetailLoading, setRebalanceDetailLoading] = useState(false);
  const [rebalanceWorking, setRebalanceWorking] = useState(false);

  const selectedRebalanceID = useMemo(
    () => parseRebalanceID(searchParams.get('rebalance_id')),
    [searchParams],
  );
  const activeViewTab = useMemo(
    () =>
      parseReplicationViewTab(
        searchParams.get('replication_tab'),
        selectedRebalanceID ? 'drafts' : 'settings',
      ),
    [searchParams, selectedRebalanceID],
  );

  const setReplicationTabInQuery = useCallback(
    (tab: ReplicationViewTab) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('tab', 'replication');
      nextParams.set('replication_tab', tab);
      const query = nextParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    setForm(toFormState(profile?.replication ?? null));
    setError('');
  }, [profile?.id, profile?.replication]);

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }

    return fallback;
  }, []);

  const setSelectedRebalanceInQuery = useCallback(
    (runID: number | null) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (!runID) {
        nextParams.delete('rebalance_id');
      } else {
        nextParams.set('rebalance_id', String(runID));
        nextParams.set('tab', 'replication');
        nextParams.set('replication_tab', 'drafts');
      }
      const query = nextParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const loadRebalanceRuns = useCallback(async () => {
    if (!portfolioID) {
      setRebalanceRuns([]);
      return;
    }

    setRebalanceListLoading(true);
    try {
      const response = await portfolioApi.mePortfoliosIdRebalancesGet(portfolioID, 50);
      setRebalanceRuns(response.data ?? []);
      setRebalanceError('');
    } catch (err) {
      setRebalanceError(parseErrorMessage(err, t('portfolio.replication.errors.loadRebalances')));
    } finally {
      setRebalanceListLoading(false);
    }
  }, [parseErrorMessage, portfolioID, t]);

  useEffect(() => {
    void loadRebalanceRuns();
  }, [loadRebalanceRuns]);

  useEffect(() => {
    if (!portfolioID) {
      setRebalanceDetail(null);
      return;
    }

    if (!selectedRebalanceID) {
      setRebalanceDetail(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setRebalanceDetailLoading(true);
      try {
        const response = await portfolioApi.mePortfoliosIdRebalancesRebalanceIdGet(
          portfolioID,
          selectedRebalanceID,
        );
        if (!cancelled) {
          setRebalanceDetail(response.data ?? null);
          setRebalanceError('');
        }
      } catch (err) {
        if (!cancelled) {
          setRebalanceError(parseErrorMessage(err, t('portfolio.replication.errors.loadRebalanceDetail')));
        }
      } finally {
        if (!cancelled) {
          setRebalanceDetailLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [parseErrorMessage, portfolioID, selectedRebalanceID, t]);

  useEffect(() => {
    if (!portfolioID) {
      return;
    }

    if (rebalanceRuns.length === 0) {
      if (selectedRebalanceID) {
        setSelectedRebalanceInQuery(null);
      }
      return;
    }

    const hasSelected = selectedRebalanceID
      ? rebalanceRuns.some(run => run.id === selectedRebalanceID)
      : false;
    if (!hasSelected) {
      const firstID = rebalanceRuns[0]?.id;
      if (typeof firstID === 'number' && firstID > 0) {
        setSelectedRebalanceInQuery(firstID);
      }
    }
  }, [portfolioID, rebalanceRuns, selectedRebalanceID, setSelectedRebalanceInQuery]);

  const formattedUpdatedAt = useMemo(() => {
    if (!form.updatedAt) {
      return t('portfolio.replication.updatedAtEmpty');
    }

    const date = new Date(form.updatedAt);
    if (Number.isNaN(date.getTime())) {
      return t('portfolio.replication.updatedAtEmpty');
    }

    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }, [form.updatedAt, i18n.language, t]);

  const onSave = useCallback(async () => {
    if (!portfolioID) {
      return;
    }

    const modeKey = form.modeKey.trim() || 'full';

    let modeParams: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(form.modeParamsRaw || '{}') as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        setError(t('portfolio.replication.errors.modeParamsObject'));
        return;
      }
      modeParams = parsed as Record<string, unknown>;
    } catch {
      setError(t('portfolio.replication.errors.modeParamsJson'));
      return;
    }

    const payload = {
      is_enabled: form.isEnabled,
      benchmark_secid: form.benchmarkSecid.trim() || null,
      mode_key: modeKey,
      mode_params: modeParams,
    };

    setWorking(true);
    setError('');
    try {
      const response = await axiosClient.put(
        `${getApiUrl()}/me/portfolios/${portfolioID}/replication`,
        payload,
      );
      const data = response.data as PortfolioReplicationConfig;
      setForm(toFormState(data));
      await refreshProfiles();
    } catch (err) {
      setError(parseErrorMessage(err, t('portfolio.replication.errors.save')));
    } finally {
      setWorking(false);
    }
  }, [form, parseErrorMessage, portfolioID, refreshProfiles, t]);

  const onClear = useCallback(async () => {
    if (!portfolioID) {
      return;
    }

    setWorking(true);
    setError('');
    try {
      await axiosClient.delete(`${getApiUrl()}/me/portfolios/${portfolioID}/replication`);
      setForm({ ...EMPTY_FORM_STATE });
      await refreshProfiles();
    } catch (err) {
      setError(parseErrorMessage(err, t('portfolio.replication.errors.clear')));
    } finally {
      setWorking(false);
    }
  }, [parseErrorMessage, portfolioID, refreshProfiles, t]);

  const onCreateDraft = useCallback(async () => {
    if (!portfolioID) {
      return;
    }

    const payload: PortfolioRebalanceCreateRequest = {
      execution_mode: draftForm.executionMode,
      as_of_date: draftForm.asOfDate.trim() || undefined,
      planning_params: {},
    };

    setRebalanceWorking(true);
    setRebalanceError('');
    try {
      const response = await portfolioApi.mePortfoliosIdRebalancesPost(portfolioID, payload);
      const detail = response.data ?? null;
      setRebalanceDetail(detail);

      const runID = detail?.run?.id;
      if (typeof runID === 'number' && runID > 0) {
        setSelectedRebalanceInQuery(runID);
      }

      await loadRebalanceRuns();
    } catch (err) {
      setRebalanceError(parseErrorMessage(err, t('portfolio.replication.errors.createDraft')));
    } finally {
      setRebalanceWorking(false);
    }
  }, [
    draftForm.asOfDate,
    draftForm.executionMode,
    loadRebalanceRuns,
    parseErrorMessage,
    portfolioID,
    setSelectedRebalanceInQuery,
    t,
  ]);

  const onSelectBenchmark = useCallback((index: MoexIndex) => {
    setForm(prev => ({
      ...prev,
      benchmarkSecid: index.secid ?? '',
    }));
  }, []);

  const selectedRun = rebalanceDetail?.run;
  const selectedItems = rebalanceDetail?.items ?? [];

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.replication.title')}</CardTitle>
          <CardDescription>{t('portfolio.replication.description')}</CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.replication.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='h-full min-h-0 overflow-hidden'>
      <CardHeader>
        <CardTitle>{t('portfolio.replication.title')}</CardTitle>
        <CardDescription>{t('portfolio.replication.description')}</CardDescription>
      </CardHeader>

      <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <Tabs
          value={activeViewTab}
          onValueChange={value => setReplicationTabInQuery(value === 'drafts' ? 'drafts' : 'settings')}
          className='min-h-0 flex-1 overflow-hidden'
        >
          <TabsList className='grid h-auto w-full grid-cols-2 md:w-auto'>
            <TabsTrigger value='settings'>
              {t('portfolio.replication.tabs.settings')}
            </TabsTrigger>
            <TabsTrigger value='drafts'>
              {t('portfolio.replication.tabs.drafts')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value='settings' className='min-h-0 flex-1 overflow-hidden data-[state=active]:flex'>
            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1 pt-2 text-sm'>
              {error ? (
                <Alert variant='destructive'>
                  <AlertTitle>{t('common.error')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <div className='grid gap-4 rounded-md border p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <Label htmlFor='portfolio-replication-enabled'>
                    {t('portfolio.replication.isEnabledLabel')}
                  </Label>
                  <Switch
                    id='portfolio-replication-enabled'
                    checked={form.isEnabled}
                    onCheckedChange={checked => setForm(prev => ({ ...prev, isEnabled: checked }))}
                    disabled={working}
                  />
                </div>

                <div className='grid gap-2'>
                  <Label>
                    {t('portfolio.replication.benchmarkLabel')}
                  </Label>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setSelectorOpen(true)}
                      disabled={working}
                    >
                      {form.benchmarkSecid
                        ? t('portfolio.replication.changeBenchmarkButton')
                        : t('portfolio.replication.selectBenchmarkButton')}
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      onClick={() => setForm(prev => ({ ...prev, benchmarkSecid: '' }))}
                      disabled={working || !form.benchmarkSecid}
                    >
                      {t('portfolio.replication.clearBenchmarkButton')}
                    </Button>
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {form.benchmarkSecid
                      ? t('portfolio.replication.selectedBenchmarkValue', {
                          secid: form.benchmarkSecid,
                        })
                      : t('portfolio.replication.selectedBenchmarkEmpty')}
                  </div>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='portfolio-replication-mode'>
                    {t('portfolio.replication.modeKeyLabel')}
                  </Label>
                  <Select
                    value={form.modeKey || 'full'}
                    onValueChange={value => setForm(prev => ({ ...prev, modeKey: value }))}
                    disabled={working}
                  >
                    <SelectTrigger id='portfolio-replication-mode'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REPLICATION_MODE_OPTIONS.map(mode => (
                        <SelectItem key={mode} value={mode}>
                          {t(`portfolio.replication.modeOptions.${mode}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className='grid gap-2'>
                  <Label htmlFor='portfolio-replication-mode-params'>
                    {t('portfolio.replication.modeParamsLabel')}
                  </Label>
                  <Textarea
                    id='portfolio-replication-mode-params'
                    value={form.modeParamsRaw}
                    onChange={event => setForm(prev => ({ ...prev, modeParamsRaw: event.target.value }))}
                    placeholder='{}'
                    rows={6}
                    disabled={working}
                  />
                </div>

                <div className='text-xs text-muted-foreground'>
                  {t('portfolio.replication.updatedAtLabel')}: {formattedUpdatedAt}
                </div>
              </div>

              <div className='flex flex-wrap gap-2'>
                <Button type='button' onClick={() => void onSave()} disabled={working}>
                  {t('portfolio.replication.saveButton')}
                </Button>
                <Button type='button' variant='outline' onClick={() => void onClear()} disabled={working}>
                  {t('portfolio.replication.clearButton')}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value='drafts' className='min-h-0 flex-1 overflow-hidden data-[state=active]:flex'>
            <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1 pt-2 text-sm'>
              <div className='grid gap-4 rounded-md border p-4'>
                <div className='space-y-1'>
                  <h3 className='font-semibold'>{t('portfolio.replication.rebalances.title')}</h3>
                  <p className='text-xs text-muted-foreground'>
                    {t('portfolio.replication.rebalances.description')}
                  </p>
                </div>

                {rebalanceError ? (
                  <Alert variant='destructive'>
                    <AlertTitle>{t('common.error')}</AlertTitle>
                    <AlertDescription>{rebalanceError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className='grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end'>
                  <div className='grid gap-2'>
                    <Label htmlFor='rebalance-execution-mode'>
                      {t('portfolio.replication.rebalances.executionModeLabel')}
                    </Label>
                    <Select
                      value={draftForm.executionMode}
                      onValueChange={value =>
                        setDraftForm(prev => ({
                          ...prev,
                          executionMode: value === 'automatic' ? 'automatic' : 'manual',
                        }))
                      }
                      disabled={rebalanceWorking}
                    >
                      <SelectTrigger id='rebalance-execution-mode'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='manual'>
                          {t('portfolio.replication.rebalances.executionModeOptions.manual')}
                        </SelectItem>
                        <SelectItem value='automatic'>
                          {t('portfolio.replication.rebalances.executionModeOptions.automatic')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='grid gap-2'>
                    <Label htmlFor='rebalance-as-of-date'>
                      {t('portfolio.replication.rebalances.asOfDateLabel')}
                    </Label>
                    <Input
                      id='rebalance-as-of-date'
                      type='date'
                      value={draftForm.asOfDate}
                      onChange={event =>
                        setDraftForm(prev => ({
                          ...prev,
                          asOfDate: event.target.value,
                        }))
                      }
                      disabled={rebalanceWorking}
                    />
                  </div>

                  <Button type='button' onClick={() => void onCreateDraft()} disabled={rebalanceWorking}>
                    {rebalanceWorking
                      ? t('portfolio.replication.rebalances.createDraftWorking')
                      : t('portfolio.replication.rebalances.createDraftButton')}
                  </Button>
                </div>

                <div className='grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]'>
                  <div className='grid gap-2 rounded-md border p-2'>
                    <p className='px-2 text-xs font-medium text-muted-foreground'>
                      {t('portfolio.replication.rebalances.listTitle')}
                    </p>

                    {rebalanceListLoading ? (
                      <p className='px-2 text-xs text-muted-foreground'>
                        {t('portfolio.replication.rebalances.loadingList')}
                      </p>
                    ) : null}

                    {!rebalanceListLoading && rebalanceRuns.length === 0 ? (
                      <p className='px-2 text-xs text-muted-foreground'>
                        {t('portfolio.replication.rebalances.emptyList')}
                      </p>
                    ) : null}

                    {rebalanceRuns.map(run => {
                      const runID = typeof run.id === 'number' ? run.id : 0;
                      const isSelected = runID > 0 && runID === selectedRebalanceID;
                      return (
                        <button
                          key={runID || `${run.created_at}-${run.status}`}
                          type='button'
                          onClick={() => setSelectedRebalanceInQuery(runID || null)}
                          className={`flex w-full flex-col items-start gap-1 rounded border px-2 py-2 text-left text-xs transition-colors ${
                            isSelected ? 'bg-accent border-accent-foreground/30' : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className='flex w-full items-center justify-between gap-2'>
                            <span className='font-medium'>#{runID || '-'}</span>
                            <Badge variant='outline'>{run.status || '-'}</Badge>
                          </div>
                          <span className='text-muted-foreground'>
                            {run.as_of_date || '-'} · {run.execution_mode || '-'}
                          </span>
                          <span className='text-muted-foreground'>
                            {formatDateTime(run.created_at, i18n.language || 'en')}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className='grid gap-3 rounded-md border p-3'>
                    {!selectedRebalanceID ? (
                      <p className='text-xs text-muted-foreground'>
                        {t('portfolio.replication.rebalances.selectPrompt')}
                      </p>
                    ) : null}

                    {selectedRebalanceID && rebalanceDetailLoading ? (
                      <p className='text-xs text-muted-foreground'>
                        {t('portfolio.replication.rebalances.loadingDetail')}
                      </p>
                    ) : null}

                    {selectedRebalanceID && !rebalanceDetailLoading && selectedRun ? (
                      <>
                        <div className='grid gap-2'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h4 className='font-semibold'>
                              {t('portfolio.replication.rebalances.detailTitle', {
                                id: selectedRun.id ?? '-',
                              })}
                            </h4>
                            <Badge>{selectedRun.status || '-'}</Badge>
                          </div>
                          <div className='grid gap-1 text-xs text-muted-foreground'>
                            <p>
                              {t('portfolio.replication.rebalances.detailModeLabel')}: {selectedRun.mode_key || '-'}
                            </p>
                            <p>
                              {t('portfolio.replication.rebalances.detailExecutionLabel')}:{' '}
                              {selectedRun.execution_mode || '-'}
                            </p>
                            <p>
                              {t('portfolio.replication.rebalances.detailAsOfLabel')}:{' '}
                              {selectedRun.as_of_date || '-'}
                            </p>
                            <p>
                              {t('portfolio.replication.rebalances.detailCreatedLabel')}:{' '}
                              {formatDateTime(selectedRun.created_at, i18n.language || 'en')}
                            </p>
                          </div>
                        </div>

                        {selectedRun.warnings && selectedRun.warnings.length > 0 ? (
                          <Alert>
                            <AlertTitle>{t('portfolio.replication.rebalances.warningsTitle')}</AlertTitle>
                            <AlertDescription>
                              {selectedRun.warnings.join(', ')}
                            </AlertDescription>
                          </Alert>
                        ) : null}

                        <div className='grid gap-1 text-xs text-muted-foreground'>
                          <p>
                            {t('portfolio.replication.rebalances.summaryItemsTotal')}:{' '}
                            {formatNumber(extractSummaryNumber(selectedRun, 'items_total') ?? undefined, 0)}
                          </p>
                          <p>
                            {t('portfolio.replication.rebalances.summaryActionable')}:{' '}
                            {formatNumber(extractSummaryNumber(selectedRun, 'actionable_items') ?? undefined, 0)}
                          </p>
                          <p>
                            {t('portfolio.replication.rebalances.summaryUnresolved')}:{' '}
                            {formatNumber(extractSummaryNumber(selectedRun, 'unresolved_items') ?? undefined, 0)}
                          </p>
                          <p>
                            {t('portfolio.replication.rebalances.summaryTurnover')}:{' '}
                            {formatNumber(
                              extractSummaryNumber(selectedRun, 'estimated_turnover_abs') ?? undefined,
                              2,
                            )}
                          </p>
                        </div>

                        <div className='rounded-md border'>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.ticker')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.side')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.currentQty')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.targetQty')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.deltaQty')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.currentWeight')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.targetWeight')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.status')}</TableHead>
                                <TableHead>{t('portfolio.replication.rebalances.itemsColumns.reason')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {selectedItems.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={9} className='text-muted-foreground'>
                                    {t('portfolio.replication.rebalances.emptyItems')}
                                  </TableCell>
                                </TableRow>
                              ) : null}
                              {selectedItems.map(item => (
                                <TableRow key={`${item.id ?? 0}-${item.ticker ?? ''}-${item.instrument_id ?? ''}`}>
                                  <TableCell>{item.ticker || item.instrument_id || '-'}</TableCell>
                                  <TableCell>{item.side || '-'}</TableCell>
                                  <TableCell>{formatNumber(item.current_quantity)}</TableCell>
                                  <TableCell>{formatNumber(item.target_quantity)}</TableCell>
                                  <TableCell>{formatNumber(item.delta_quantity)}</TableCell>
                                  <TableCell>{formatNumber(item.current_weight)}</TableCell>
                                  <TableCell>{formatNumber(item.target_weight)}</TableCell>
                                  <TableCell>
                                    <Badge variant='outline'>{item.status || '-'}</Badge>
                                  </TableCell>
                                  <TableCell>{unresolvedReason(item)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {selectorOpen ? (
        <MoexIndexSelectorDialog
          open={selectorOpen}
          value={form.benchmarkSecid || null}
          onOpenChange={setSelectorOpen}
          onSelect={onSelectBenchmark}
        />
      ) : null}
    </Card>
  );
}
