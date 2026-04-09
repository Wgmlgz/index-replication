'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Play, Plus, Trash2 } from 'lucide-react';

import type {
  PortfolioRebalanceCreateRequest,
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceRun,
} from '@/api-client';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonGroup } from '@/components/ui/button-group';
import { Button } from '@/components/ui/button';
import {
  CardAction,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { RebalanceDraftCreateForm } from './rebalance-draft-create-form';
import { RebalanceDraftDetailCard } from './rebalance-draft-detail-card';
import {
  canExecuteRunStatus,
  hasStatusState,
  isRunExecutionInProgress,
  isRunPlanningInProgress,
  mergeRunByID,
} from './rebalance-status-utils';
import { useRebalanceStatus } from './use-rebalance-status';

type RebalanceDraftFormState = {
  asOfDate: string;
};

const EMPTY_DRAFT_FORM: RebalanceDraftFormState = {
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

function executeButtonLabel(status: string | undefined, t: TFunction): string {
  if (status === 'failed') {
    return t('portfolio.replication.rebalances.executeDraftRetry');
  }
  if (isRunPlanningInProgress(status) || isRunExecutionInProgress(status)) {
    return t('portfolio.replication.rebalances.executeDraftRunning');
  }
  if (!canExecuteRunStatus(status)) {
    return t('portfolio.replication.rebalances.executeDraftDone');
  }
  return t('portfolio.replication.rebalances.executeDraftButton');
}

export default function PortfolioReplicationDraftsPage() {
  const { t, i18n } = useTranslation();
  const { selectedPortfolioID, selectedProfile } = usePortfolioDetailsContext();
  const portfolioID = selectedPortfolioID;
  const isReplicationEnabled = selectedProfile?.replication?.is_enabled === true;
  const createDraftDisabledReason = t(
    'portfolio.replication.rebalances.createDraftDisabledReason',
  );
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

  const applyRunUpdate = useCallback((nextRun: PortfolioRebalanceRun) => {
    setRebalanceRuns(prev => mergeRunByID(prev, nextRun));
    setRebalanceDetail(prev => {
      if (!prev?.run || prev.run.id !== nextRun.id) {
        return prev;
      }
      return {
        ...prev,
        run: nextRun,
      };
    });
  }, []);

  const {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    clearStatus,
  } = useRebalanceStatus({
    portfolioID,
    rebalanceID: selectedRebalanceID,
    detailDialogOpen,
    enabled: hasStatusState(rebalanceDetail?.run?.status),
    t,
    parseErrorMessage,
    onRunUpdate: applyRunUpdate,
  });

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
    if (!portfolioID || !isReplicationEnabled) {
      if (!isReplicationEnabled) {
        setRebalanceError(createDraftDisabledReason);
      }
      return false;
    }

    const payload: PortfolioRebalanceCreateRequest = {
      execution_mode: 'automatic',
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
      if (detail?.run) {
        applyRunUpdate(detail.run);
      }

      const runID = detail?.run?.id;
      if (typeof runID === 'number' && runID > 0) {
        setSelectedRebalanceInQuery(runID);
      }
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
    applyRunUpdate,
    createDraftDisabledReason,
    isReplicationEnabled,
    parseErrorMessage,
    portfolioID,
    setSelectedRebalanceInQuery,
    t,
  ]);

  const selectedRun = status?.run ?? rebalanceDetail?.run;
  const selectedEntityLabel = selectedRun
    ? selectedRun.status === 'draft'
      ? t('portfolio.replication.rebalances.entity.draft')
      : t('portfolio.replication.rebalances.entity.run')
    : '';

  const onOpenDraftDetail = useCallback(
    (runID: number | null) => {
      setSelectedRebalanceInQuery(runID);
      setDetailDialogOpen(Boolean(runID));
    },
    [setSelectedRebalanceInQuery],
  );

  const onSubmitCreateDraft = useCallback(async () => {
    if (!isReplicationEnabled) {
      setRebalanceError(createDraftDisabledReason);
      return;
    }
    const created = await onCreateDraft();
    if (created) {
      setCreateDialogOpen(false);
    }
  }, [createDraftDisabledReason, isReplicationEnabled, onCreateDraft]);

  const onExecuteDraft = useCallback(
    async (runID: number) => {
      if (!portfolioID || runID <= 0) {
        return;
      }

      setRebalanceWorking(true);
      setRebalanceError('');
      try {
        const response =
          await portfolioApi.mePortfoliosIdRebalancesRebalanceIdExecutePost(
            portfolioID,
            runID,
          );
        const run = response.data;
        if (run) {
          applyRunUpdate(run);
        }
        if (selectedRebalanceID === runID && detailDialogOpen) {
          await refreshStatus();
        }
      } catch (err) {
        setRebalanceError(
          parseErrorMessage(err, t('portfolio.replication.errors.executeDraft')),
        );
      } finally {
        setRebalanceWorking(false);
      }
    },
    [
      applyRunUpdate,
      detailDialogOpen,
      parseErrorMessage,
      portfolioID,
      refreshStatus,
      selectedRebalanceID,
      t,
    ],
  );

  const onDeleteDraft = useCallback(
    async (runID: number) => {
      if (!portfolioID || runID <= 0) {
        return;
      }

      setRebalanceWorking(true);
      setRebalanceError('');
      try {
        await portfolioApi.mePortfoliosIdRebalancesRebalanceIdDelete(
          portfolioID,
          runID,
        );
        if (selectedRebalanceID === runID) {
          setRebalanceDetail(null);
          setDetailDialogOpen(false);
          setSelectedRebalanceInQuery(null);
          clearStatus();
        }
        await loadRebalanceRuns();
      } catch (err) {
        setRebalanceError(
          parseErrorMessage(err, t('portfolio.replication.errors.deleteDraft')),
        );
      } finally {
        setRebalanceWorking(false);
      }
    },
    [
      loadRebalanceRuns,
      parseErrorMessage,
      portfolioID,
      clearStatus,
      selectedRebalanceID,
      setSelectedRebalanceInQuery,
      t,
    ],
  );

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
          <CardAction>
            <div className='grid justify-items-end gap-1'>
              <Button
                type='button'
                onClick={() => setCreateDialogOpen(true)}
                disabled={rebalanceWorking || !isReplicationEnabled}
              >
                <Plus className='size-4' />
                {t('portfolio.replication.rebalances.openCreateDialogButton')}
              </Button>
              {!isReplicationEnabled ? (
                <p className='text-xs text-muted-foreground'>
                  {createDraftDisabledReason}
                </p>
              ) : null}
            </div>
          </CardAction>
        </CardHeader>

        <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
          {rebalanceError || statusError ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{rebalanceError || statusError}</AlertDescription>
            </Alert>
          ) : null}

          <div className='grid gap-2'>
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
              const isDraftRun = run.status === 'draft';
              const entityLabel = isDraftRun
                ? t('portfolio.replication.rebalances.entity.draft')
                : t('portfolio.replication.rebalances.entity.run');
              const deleteDescriptionKey = isDraftRun
                ? 'portfolio.replication.rebalances.deleteConfirmDescriptionDraft'
                : 'portfolio.replication.rebalances.deleteConfirmDescriptionRun';
              return (
                <div
                  key={runID || `${run.created_at}-${run.status}`}
                  className={`flex items-center justify-between gap-3 rounded p-2 text-xs transition-colors`}
                >
                  <div className='grid gap-1'>
                    <div className='flex w-full items-center gap-2'>
                      <span className='font-medium'>#{runID || '-'}</span>
                      <Badge variant='outline'>{run.status || '-'}</Badge>
                    </div>
                    <span className='text-muted-foreground'>
                      {run.as_of_date || '-'} | {run.execution_mode || '-'}
                    </span>
                    <span className='text-muted-foreground'>
                      {formatDateTime(run.created_at, i18n.language || 'en')}
                    </span>
                  </div>

                  <ButtonGroup className='shrink-0'>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={() => void onExecuteDraft(runID)}
                      disabled={!runID || rebalanceWorking || !canExecuteRunStatus(run.status)}
                    >
                      <Play className='size-4' />
                      {executeButtonLabel(run.status, t)}
                    </Button>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={() => onOpenDraftDetail(runID || null)}
                      disabled={!runID || rebalanceWorking}
                    >
                      {t('portfolio.replication.rebalances.viewButton', {
                        entity: entityLabel,
                      })}
                    </Button>
                    <ConfirmActionDialog
                      trigger={(
                        <Button
                          type='button'
                          variant='destructive'
                          size='sm'
                          disabled={!runID || rebalanceWorking}
                        >
                          <Trash2 className='size-4' />
                          {t('portfolio.replication.rebalances.deleteButton', {
                            entity: entityLabel,
                          })}
                        </Button>
                      )}
                      title={t('portfolio.replication.rebalances.deleteConfirmTitle', {
                        entity: entityLabel,
                        id: runID || '-',
                      })}
                      description={t(deleteDescriptionKey)}
                      cancelLabel={t('portfolio.replication.modeDialog.cancelButton')}
                      actionLabel={rebalanceWorking
                        ? t('portfolio.replication.rebalances.deleteDraftWorking')
                        : t('portfolio.replication.rebalances.deleteConfirmAction', {
                          entity: entityLabel,
                        })}
                      disabled={!runID || rebalanceWorking}
                      onAction={() => onDeleteDraft(runID)}
                    />
                  </ButtonGroup>
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
          </DialogHeader>

          <RebalanceDraftCreateForm
            asOfDate={draftForm.asOfDate}
            working={rebalanceWorking}
            canCreateDraft={isReplicationEnabled}
            disabledReasonText={createDraftDisabledReason}
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
              clearStatus();
            }
          }}
        >
          <DialogContent className='sm:max-w-6xl overflow-hidden'>
            <DialogTitle className='font-semibold'>
              <div className='flex flex-wrap items-center gap-2'>
                {t('portfolio.replication.rebalances.detailTitle', {
                  entity: selectedEntityLabel,
                  id: selectedRun.id ?? '-',
                })}
                <Badge>{selectedRun.status || '-'}</Badge>
              </div>
            </DialogTitle>

            <div className='h-[80svh]  overflow-y-auto overflow-x-hidden'>
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

              {selectedRebalanceID &&
              !rebalanceDetailLoading &&
              selectedRun &&
              rebalanceDetail ? (
                <RebalanceDraftDetailCard
                  detail={rebalanceDetail}
                  status={status}
                  statusLoading={statusLoading}
                  language={i18n.language || 'en'}
                />
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='secondary'
                onClick={() =>
                  selectedRebalanceID
                    ? void onExecuteDraft(selectedRebalanceID)
                    : undefined
                }
                disabled={
                  !selectedRebalanceID ||
                  rebalanceWorking ||
                  !canExecuteRunStatus(selectedRun.status)
                }
              >
                <Play className='size-4' />
                {executeButtonLabel(selectedRun.status, t)}
              </Button>
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
