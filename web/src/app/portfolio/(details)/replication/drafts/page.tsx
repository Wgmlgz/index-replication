'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import type {
  PortfolioRebalanceCreateRequest,
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceItem,
  PortfolioRebalanceRun,
} from '@/api-client';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';

type RebalanceDraftFormState = {
  executionMode: 'manual' | 'automatic';
  asOfDate: string;
};

const EMPTY_DRAFT_FORM: RebalanceDraftFormState = {
  executionMode: 'manual',
  asOfDate: '',
};

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

export default function PortfolioReplicationDraftsPage() {
  const { t, i18n } = useTranslation();
  const { selectedPortfolioID } = usePortfolioDetailsContext();
  const portfolioID = selectedPortfolioID;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const selectedRun = rebalanceDetail?.run;
  const selectedItems = rebalanceDetail?.items ?? [];

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.replication.rebalances.title')}</CardTitle>
          <CardDescription>{t('portfolio.replication.rebalances.description')}</CardDescription>
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
        <CardTitle>{t('portfolio.replication.rebalances.title')}</CardTitle>
        <CardDescription>{t('portfolio.replication.rebalances.description')}</CardDescription>
      </CardHeader>

      <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
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
      </CardContent>
    </Card>
  );
}
