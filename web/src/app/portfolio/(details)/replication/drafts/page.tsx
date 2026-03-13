'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

import type {
  PortfolioRebalanceCreateRequest,
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceRun,
} from '@/api-client';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import {
  RebalanceDraftCreateForm,
  type RebalanceDraftExecutionMode,
} from './rebalance-draft-create-form';
import { RebalanceDraftDetailCard } from './rebalance-draft-detail-card';

type RebalanceDraftFormState = {
  executionMode: RebalanceDraftExecutionMode;
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

export default function PortfolioReplicationDraftsPage() {
  const { t, i18n } = useTranslation();
  const { selectedPortfolioID } = usePortfolioDetailsContext();
  const portfolioID = selectedPortfolioID;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draftForm, setDraftForm] = useState<RebalanceDraftFormState>({
    ...EMPTY_DRAFT_FORM,
  });
  const [rebalanceRuns, setRebalanceRuns] = useState<PortfolioRebalanceRun[]>(
    [],
  );
  const [rebalanceDetail, setRebalanceDetail] =
    useState<PortfolioRebalanceDetailResponse | null>(null);
  const [rebalanceError, setRebalanceError] = useState('');
  const [rebalanceListLoading, setRebalanceListLoading] = useState(false);
  const [rebalanceDetailLoading, setRebalanceDetailLoading] = useState(false);
  const [rebalanceWorking, setRebalanceWorking] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

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
      const response = await portfolioApi.mePortfoliosIdRebalancesGet(
        portfolioID,
        50,
      );
      setRebalanceRuns(response.data ?? []);
      setRebalanceError('');
    } catch (err) {
      setRebalanceError(
        parseErrorMessage(
          err,
          t('portfolio.replication.errors.loadRebalances'),
        ),
      );
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
        const response =
          await portfolioApi.mePortfoliosIdRebalancesRebalanceIdGet(
            portfolioID,
            selectedRebalanceID,
          );
        if (!cancelled) {
          setRebalanceDetail(response.data ?? null);
          setRebalanceError('');
        }
      } catch (err) {
        if (!cancelled) {
          setRebalanceError(
            parseErrorMessage(
              err,
              t('portfolio.replication.errors.loadRebalanceDetail'),
            ),
          );
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

  const onCreateDraft = useCallback(async () => {
    if (!portfolioID) {
      return false;
    }

    const payload: PortfolioRebalanceCreateRequest = {
      execution_mode: draftForm.executionMode,
      as_of_date: draftForm.asOfDate.trim() || undefined,
      planning_params: {},
    };

    setRebalanceWorking(true);
    setRebalanceError('');
    try {
      const response = await portfolioApi.mePortfoliosIdRebalancesPost(
        portfolioID,
        payload,
      );
      const detail = response.data ?? null;
      setRebalanceDetail(detail);

      const runID = detail?.run?.id;
      if (typeof runID === 'number' && runID > 0) {
        setSelectedRebalanceInQuery(runID);
      }

      await loadRebalanceRuns();
      return true;
    } catch (err) {
      setRebalanceError(
        parseErrorMessage(err, t('portfolio.replication.errors.createDraft')),
      );
      return false;
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

  const onOpenDraftDetail = useCallback(
    (runID: number | null) => {
      setSelectedRebalanceInQuery(runID);
      setDetailDialogOpen(Boolean(runID));
    },
    [setSelectedRebalanceInQuery],
  );

  const onSubmitCreateDraft = useCallback(async () => {
    const created = await onCreateDraft();
    if (created) {
      setCreateDialogOpen(false);
    }
  }, [onCreateDraft]);

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.replication.rebalances.title')}</CardTitle>
          <CardDescription>
            {t('portfolio.replication.rebalances.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.replication.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className='h-full min-h-0 overflow-hidden'>
        <CardHeader>
          <CardTitle>{t('portfolio.replication.rebalances.title')}</CardTitle>
          <CardDescription>
            {t('portfolio.replication.rebalances.description')}
          </CardDescription>
        </CardHeader>

        <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
          {rebalanceError ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{rebalanceError}</AlertDescription>
            </Alert>
          ) : null}

          <div className='flex justify-end'>
            <Button
              type='button'
              onClick={() => setCreateDialogOpen(true)}
              disabled={rebalanceWorking}
            >
              <Plus className='size-4' />
              {t('portfolio.replication.rebalances.openCreateDialogButton')}
            </Button>
          </div>

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
                <div
                  key={runID || `${run.created_at}-${run.status}`}
                  className={`flex items-center justify-between gap-3 rounded border px-2 py-2 text-xs transition-colors ${
                    isSelected ? 'bg-accent border-accent-foreground/30' : ''
                  }`}
                >
                  <div className='grid gap-1'>
                    <div className='flex w-full items-center gap-2'>
                      <span className='font-medium'>#{runID || '-'}</span>
                      <Badge variant='outline'>{run.status || '-'}</Badge>
                    </div>
                    <span className='text-muted-foreground'>
                      {run.as_of_date || '-'} · {run.execution_mode || '-'}
                    </span>
                    <span className='text-muted-foreground'>
                      {formatDateTime(run.created_at, i18n.language || 'en')}
                    </span>
                  </div>

                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => onOpenDraftDetail(runID || null)}
                    disabled={!runID}
                  >
                    {t('portfolio.replication.rebalances.viewDraftButton')}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {t('portfolio.replication.rebalances.createDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('portfolio.replication.rebalances.createDialogDescription')}
            </DialogDescription>
          </DialogHeader>

          <RebalanceDraftCreateForm
            executionMode={draftForm.executionMode}
            asOfDate={draftForm.asOfDate}
            working={rebalanceWorking}
            onExecutionModeChange={mode =>
              setDraftForm(prev => ({
                ...prev,
                executionMode: mode,
              }))
            }
            onAsOfDateChange={value =>
              setDraftForm(prev => ({
                ...prev,
                asOfDate: value,
              }))
            }
            onSubmit={() => {
              void onSubmitCreateDraft();
            }}
          />
        </DialogContent>
      </Dialog>

      {selectedRun && (
        <Dialog
          open={detailDialogOpen}
          onOpenChange={open => {
            setDetailDialogOpen(open);
            if (!open) {
              setSelectedRebalanceInQuery(null);
            }
          }}
        >
          <DialogContent className='max-h-[90svh] sm:max-w-6xl'>
            <DialogTitle className='font-semibold'>
              <div className='flex flex-wrap items-center gap-2'>
                {t('portfolio.replication.rebalances.detailTitle', {
                  id: selectedRun.id ?? '-',
                })}
                <Badge>{selectedRun.status || '-'}</Badge>
              </div>
            </DialogTitle>

            <div className='min-h-0 overflow-y-auto'>
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
                <RebalanceDraftDetailCard
                  run={selectedRun}
                  items={selectedItems}
                  language={i18n.language || 'en'}
                />
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setDetailDialogOpen(false)}
              >
                {t('portfolio.replication.rebalances.closeButton')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
