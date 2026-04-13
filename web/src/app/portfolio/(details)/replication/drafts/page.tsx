'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  FileCheck2,
  LoaderCircle,
  Settings,
  Play,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';

import type {
  PortfolioRebalanceCreateRequest,
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceRun,
  PortfolioRebalanceScheduleConfigResponse,
  PortfolioRebalanceScheduleConfigUpsertRequest,
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
import { DateTimePicker } from '@/components/ui/date-time-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { RebalanceDraftCreateForm } from './rebalance-draft-create-form';
import { RebalanceDraftDetailCard } from './rebalance-draft-detail-card';
import {
  canExecuteRunStatus,
  isRunExecutionInProgress,
  isRunPlanningInProgress,
  runStatusBadgeIconKey,
  runStatusBadgeLabelKey,
  mergeRunByID,
} from './rebalance-status-utils';
import { useRebalanceStatus } from './use-rebalance-status';

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

function parseDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function runSortTimestamp(run: PortfolioRebalanceRun): number {
  const value = run.started_at || run.created_at || '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : -1;
}

function runDisplayIndex(run: PortfolioRebalanceRun | null | undefined): number | null {
  const index = run?.run_index;
  if (typeof index === 'number' && index > 0) {
    return index;
  }
  const id = run?.id;
  if (typeof id === 'number' && id > 0) {
    return id;
  }
  return null;
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

function renderRunStatusIcon(status: string | undefined) {
  const iconKey = runStatusBadgeIconKey(status);
  const spinning = status === 'planning_queued' ||
    status === 'planning' ||
    status === 'queued' ||
    status === 'executing';
  const className = `size-3.5 ${spinning ? 'animate-spin' : ''}`;

  switch (iconKey) {
    case 'planning':
      return <LoaderCircle className={className} />;
    case 'planning_done':
      return <FileCheck2 className={className} />;
    case 'planning_failed':
      return <XCircle className={className} />;
    case 'executing':
      return <LoaderCircle className={className} />;
    case 'completed':
      return <CheckCircle2 className={className} />;
    case 'partially_completed':
      return <AlertTriangle className={className} />;
    case 'failed':
      return <XCircle className={className} />;
    default:
      return <CircleHelp className={className} />;
  }
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
  const [scheduledRunDialogOpen, setScheduledRunDialogOpen] = useState(false);
  const [scheduledRunWorking, setScheduledRunWorking] = useState(false);
  const [scheduledRunError, setScheduledRunError] = useState('');
  const [scheduleConfig, setScheduleConfig] = useState<PortfolioRebalanceScheduleConfigResponse | null>(null);
  const [scheduledRunAtDraft, setScheduledRunAtDraft] = useState(() => new Date());
  const syncedDetailRunStatusRef = useRef('');

  const selectedRebalanceID = useMemo(
    () => parseRebalanceID(searchParams.get('rebalance_id')),
    [searchParams],
  );
  const latestRebalanceID = useMemo(() => {
    if (rebalanceRuns.length === 0) {
      return null;
    }
    const latestRun = rebalanceRuns.reduce((latest, candidate) => {
      const latestTs = runSortTimestamp(latest);
      const candidateTs = runSortTimestamp(candidate);
      if (candidateTs !== latestTs) {
        return candidateTs > latestTs ? candidate : latest;
      }
      const latestID = typeof latest.id === 'number' ? latest.id : 0;
      const candidateID = typeof candidate.id === 'number' ? candidate.id : 0;
      return candidateID > latestID ? candidate : latest;
    });
    return typeof latestRun.id === 'number' && latestRun.id > 0
      ? latestRun.id
      : null;
  }, [rebalanceRuns]);

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
    rebalanceID: latestRebalanceID,
    enabled: Boolean(latestRebalanceID),
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

  const loadScheduleConfig = useCallback(async () => {
    if (!portfolioID) {
      setScheduleConfig(null);
      return;
    }

    try {
      const response = await portfolioApi.mePortfoliosIdRebalancesScheduleGet(portfolioID);
      setScheduleConfig(response.data ?? null);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setScheduleConfig(null);
        return;
      }
      setScheduleConfig(null);
      setRebalanceError(
        parseErrorMessage(
          err,
          t('portfolio.replication.errors.loadSchedule'),
        ),
      );
    }
  }, [parseErrorMessage, portfolioID, t]);

  useEffect(() => {
    void loadScheduleConfig();
  }, [loadScheduleConfig]);

  const loadRebalanceDetail = useCallback(async (
    runID: number,
    options?: { silent?: boolean },
  ) => {
    if (!portfolioID || runID <= 0) {
      return null;
    }
    const silent = options?.silent === true;
    if (!silent) {
      setRebalanceDetailLoading(true);
    }
    try {
      const response =
        await portfolioApi.mePortfoliosIdRebalancesRebalanceIdGet(
          portfolioID,
          runID,
        );
      const detail = response.data ?? null;
      setRebalanceDetail(detail);
      setRebalanceError('');
      const runStatus = detail?.run?.status;
      syncedDetailRunStatusRef.current = typeof runStatus === 'string'
        ? runStatus
        : '';
      return detail;
    } catch (err) {
      if (!silent) {
        setRebalanceError(
          parseErrorMessage(
            err,
            t('portfolio.replication.errors.loadRebalanceDetail'),
          ),
        );
      }
      return null;
    } finally {
      if (!silent) {
        setRebalanceDetailLoading(false);
      }
    }
  }, [parseErrorMessage, portfolioID, t]);

  useEffect(() => {
    syncedDetailRunStatusRef.current = '';
    if (!portfolioID || !selectedRebalanceID) {
      setRebalanceDetail(null);
      return;
    }
    void loadRebalanceDetail(selectedRebalanceID);
  }, [loadRebalanceDetail, portfolioID, selectedRebalanceID]);

  useEffect(() => {
    if (!detailDialogOpen || !portfolioID || !selectedRebalanceID) {
      return;
    }
    const statusRunID = status?.run?.id;
    const statusRunStatus = status?.run?.status;
    if (statusRunID !== selectedRebalanceID || !statusRunStatus) {
      return;
    }
    if (syncedDetailRunStatusRef.current === statusRunStatus) {
      return;
    }
    void loadRebalanceDetail(selectedRebalanceID, { silent: true });
  }, [
    detailDialogOpen,
    loadRebalanceDetail,
    portfolioID,
    selectedRebalanceID,
    status?.run?.id,
    status?.run?.status,
  ]);

  const onCreateDraft = useCallback(async () => {
    if (!portfolioID || !isReplicationEnabled) {
      if (!isReplicationEnabled) {
        setRebalanceError(createDraftDisabledReason);
      }
      return false;
    }

    const payload: PortfolioRebalanceCreateRequest = {
      execution_mode: 'manual',
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
    applyRunUpdate,
    createDraftDisabledReason,
    isReplicationEnabled,
    parseErrorMessage,
    portfolioID,
    setSelectedRebalanceInQuery,
    t,
  ]);

  const selectedRun = useMemo(() => {
    if (!selectedRebalanceID) {
      return null;
    }
    const liveRun = status?.run;
    if (liveRun?.id === selectedRebalanceID) {
      return liveRun;
    }
    if (rebalanceDetail?.run?.id === selectedRebalanceID) {
      return rebalanceDetail.run;
    }
    return rebalanceRuns.find(run => run.id === selectedRebalanceID) ?? null;
  }, [rebalanceDetail?.run, rebalanceRuns, selectedRebalanceID, status?.run]);
  const selectedRunDisplayIndex = useMemo(
    () => runDisplayIndex(selectedRun),
    [selectedRun],
  );
  const selectedLiveStatus = status?.run?.id === selectedRebalanceID ? status : null;
  const selectedLiveStatusLoading = status?.run?.id === selectedRebalanceID
    ? statusLoading
    : false;
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
        let latestRunStatus: string | undefined;
        try {
          const detailResponse =
            await portfolioApi.mePortfoliosIdRebalancesRebalanceIdGet(
              portfolioID,
              runID,
            );
          const latestDetail = detailResponse.data ?? null;
          const latestRun = latestDetail?.run;
          if (latestRun) {
            latestRunStatus = latestRun.status;
            applyRunUpdate(latestRun);
            if (selectedRebalanceID === runID && detailDialogOpen) {
              setRebalanceDetail(latestDetail);
              syncedDetailRunStatusRef.current = latestRun.status || '';
            }
          }
        } catch {
          // Do not block execute on preflight refresh failure.
        }

        if (latestRunStatus && !canExecuteRunStatus(latestRunStatus)) {
          setRebalanceError(t('portfolio.replication.errors.executeDraftNotExecutable'));
          return;
        }

        const response =
          await portfolioApi.mePortfoliosIdRebalancesRebalanceIdExecutePost(
            portfolioID,
            runID,
          );
        const run = response.data;
        if (run) {
          applyRunUpdate(run);
        }
        if (
          selectedRebalanceID === runID &&
          detailDialogOpen &&
          runID === latestRebalanceID
        ) {
          await refreshStatus();
        }
      } catch (err) {
        const message = parseErrorMessage(
          err,
          t('portfolio.replication.errors.executeDraft'),
        );
        if (message.toLowerCase().includes('not executable')) {
          try {
            const detailResponse =
              await portfolioApi.mePortfoliosIdRebalancesRebalanceIdGet(
                portfolioID,
                runID,
              );
            const latestRun = detailResponse.data?.run;
            if (latestRun) {
              applyRunUpdate(latestRun);
              if (selectedRebalanceID === runID && detailDialogOpen) {
                setRebalanceDetail(detailResponse.data ?? null);
                syncedDetailRunStatusRef.current = latestRun.status || '';
              }
            }
          } catch {
            // Keep original error if refresh after failure also fails.
          }
          setRebalanceError(t('portfolio.replication.errors.executeDraftNotExecutable'));
          return;
        }
        setRebalanceError(
          message,
        );
      } finally {
        setRebalanceWorking(false);
      }
    },
    [
      applyRunUpdate,
      detailDialogOpen,
      latestRebalanceID,
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
          syncedDetailRunStatusRef.current = '';
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

  const scheduledRunAt = scheduleConfig?.next_run_at;
  const hasScheduledRun = typeof scheduledRunAt === 'string' && scheduledRunAt.length > 0;
  const scheduledRunAtLabel = hasScheduledRun
    ? formatDateTime(scheduledRunAt, i18n.language || 'en')
    : '-';

  const onOpenScheduledRunDialog = useCallback(() => {
    if (!hasScheduledRun) {
      return;
    }
    const parsed = parseDateTime(scheduledRunAt);
    setScheduledRunAtDraft(parsed ?? new Date());
    setScheduledRunError('');
    setScheduledRunDialogOpen(true);
  }, [hasScheduledRun, scheduledRunAt]);

  const onSaveScheduledRun = useCallback(async () => {
    if (!portfolioID) {
      return;
    }
    if (!scheduleConfig?.rrule) {
      setScheduledRunError(t('portfolio.replication.rebalances.scheduledRun.missingRRule'));
      return;
    }

    setScheduledRunWorking(true);
    setScheduledRunError('');
    setRebalanceError('');
    try {
      const payload: PortfolioRebalanceScheduleConfigUpsertRequest = {
        is_enabled: scheduleConfig.is_enabled ?? true,
        dtstart: scheduledRunAtDraft.toISOString(),
        rrule: scheduleConfig.rrule,
        business_day_adjustment: scheduleConfig.business_day_adjustment,
      };
      const response = await portfolioApi.mePortfoliosIdRebalancesSchedulePut(portfolioID, payload);
      const nextConfig = response.data ?? {};
      setScheduleConfig({
        ...scheduleConfig,
        ...nextConfig,
        next_run_at: nextConfig.next_run_at ?? undefined,
      });
      setScheduledRunDialogOpen(false);
    } catch (err) {
      setScheduledRunError(
        parseErrorMessage(
          err,
          t('portfolio.replication.schedule.errors.save'),
        ),
      );
    } finally {
      setScheduledRunWorking(false);
    }
  }, [
    parseErrorMessage,
    portfolioID,
    scheduleConfig,
    scheduledRunAtDraft,
    t,
  ]);

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

          <div className='grid gap-0'>
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

            {hasScheduledRun ? (
              <div className={`-mt-px flex items-center justify-between gap-3 border border-dashed bg-muted/20 p-2 text-xs first:mt-0 first:rounded-t-md ${rebalanceRuns.length === 0 ? 'rounded-b-md' : ''}`}>
                <div className='grid flex-1 gap-1'>
                  <div className='flex w-full items-center gap-2'>
                    <span className='font-medium'>{t('portfolio.replication.rebalances.scheduledRun.idLabel')}</span>
                    <Badge variant='outline'>
                      {t('portfolio.replication.rebalances.scheduledRun.badge')}
                    </Badge>
                  </div>
                  <span className='text-muted-foreground'>
                    {scheduledRunAtLabel}
                  </span>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onOpenScheduledRunDialog}
                  disabled={rebalanceWorking || scheduledRunWorking}
                >
                  <Settings className='size-4' />
                  {t('portfolio.replication.rebalances.scheduledRun.settingsButton')}
                </Button>
              </div>
            ) : null}

            {rebalanceRuns.map(run => {
              const runID = typeof run.id === 'number' ? run.id : 0;
              const displayIndex = runDisplayIndex(run);
              const isDraftRun = run.status === 'draft';
              const runDisplayTime = run.started_at || run.created_at;
              const entityLabel = isDraftRun
                ? t('portfolio.replication.rebalances.entity.draft')
                : t('portfolio.replication.rebalances.entity.run');
              const openTooltipLabel = t(
                'portfolio.replication.rebalances.openTooltip',
                {
                  entity: entityLabel,
                },
              );
              const isOpenDisabled = !runID || rebalanceWorking;
              const deleteDescriptionKey = isDraftRun
                ? 'portfolio.replication.rebalances.deleteConfirmDescriptionDraft'
                : 'portfolio.replication.rebalances.deleteConfirmDescriptionRun';
              return (
                <Tooltip key={runID || `${run.created_at}-${run.status}`}>
                  <TooltipTrigger asChild>
                    <div
                      role='button'
                      tabIndex={isOpenDisabled ? -1 : 0}
                      aria-disabled={isOpenDisabled}
                      onClick={() => {
                        if (!isOpenDisabled) {
                          onOpenDraftDetail(runID || null);
                        }
                      }}
                      onKeyDown={event => {
                        if (isOpenDisabled) {
                          return;
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onOpenDraftDetail(runID || null);
                        }
                      }}
                      className={`-mt-px flex items-center justify-between gap-3 border p-2 text-xs transition-colors first:mt-0 ${!hasScheduledRun ? 'first:rounded-t-md' : ''} last:rounded-b-md ${
                        isOpenDisabled
                          ? 'cursor-not-allowed opacity-70'
                          : 'cursor-pointer hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                      }`}
                    >
                      <div className='grid flex-1 gap-1'>
                        <div className='flex w-full items-center gap-2'>
                          <span className='font-medium'>#{displayIndex || '-'}</span>
                          <Badge variant='outline' className='inline-flex items-center gap-1'>
                            {renderRunStatusIcon(run.status)}
                            {t(runStatusBadgeLabelKey(run.status))}
                          </Badge>
                        </div>
                        <span className='text-muted-foreground'>
                          {formatDateTime(runDisplayTime, i18n.language || 'en')} | {run.execution_mode || '-'}
                        </span>
                      </div>

                      <ButtonGroup className='shrink-0' onClick={event => event.stopPropagation()}>
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
                        <ConfirmActionDialog
                          trigger={(
                            <Button
                              type='button'
                              variant='destructive'
                              size='sm'
                              disabled={!runID || rebalanceWorking}
                              aria-label={t('portfolio.replication.rebalances.deleteButton', {
                                entity: entityLabel,
                              })}
                            >
                              <Trash2 className='size-4' />
                            </Button>
                          )}
                          title={t('portfolio.replication.rebalances.deleteConfirmTitle', {
                            entity: entityLabel,
                            id: displayIndex || '-',
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
                  </TooltipTrigger>
                  <TooltipContent>{openTooltipLabel}</TooltipContent>
                </Tooltip>
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
            working={rebalanceWorking}
            canCreateDraft={isReplicationEnabled}
            disabledReasonText={createDraftDisabledReason}
            onSubmit={() => {
              void onSubmitCreateDraft();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={scheduledRunDialogOpen}
        onOpenChange={open => {
          setScheduledRunDialogOpen(open);
          if (!open) {
            setScheduledRunError('');
          }
        }}
      >
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {t('portfolio.replication.rebalances.scheduledRun.dialogTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className='grid gap-3'>
            <p className='text-sm text-muted-foreground'>
              {t('portfolio.replication.rebalances.scheduledRun.dialogHint')}
            </p>
            <DateTimePicker
              idPrefix='scheduled-run-at'
              label={t('portfolio.replication.rebalances.scheduledRun.timeLabel')}
              value={scheduledRunAtDraft}
              dateLabel={t('portfolio.replication.schedule.datePlaceholder')}
              timeLabel={t('portfolio.replication.schedule.timeLabel')}
              onChange={setScheduledRunAtDraft}
            />
            {scheduledRunError ? (
              <Alert variant='destructive'>
                <AlertTitle>{t('common.error')}</AlertTitle>
                <AlertDescription>{scheduledRunError}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setScheduledRunDialogOpen(false)}
              disabled={scheduledRunWorking}
            >
              {t('portfolio.replication.modeDialog.cancelButton')}
            </Button>
            <Button
              type='button'
              onClick={() => void onSaveScheduledRun()}
              disabled={scheduledRunWorking}
            >
              {scheduledRunWorking
                ? t('portfolio.replication.rebalances.scheduledRun.saveWorking')
                : t('portfolio.replication.rebalances.scheduledRun.saveButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedRun && (
        <Dialog
          open={detailDialogOpen}
          onOpenChange={open => {
            setDetailDialogOpen(open);
            if (!open) {
              setSelectedRebalanceInQuery(null);
              syncedDetailRunStatusRef.current = '';
              clearStatus();
            }
          }}
        >
          <DialogContent className='sm:max-w-6xl overflow-hidden'>
            <DialogTitle className='font-semibold'>
              <div className='flex flex-wrap items-center gap-2'>
                {t('portfolio.replication.rebalances.detailTitle', {
                  entity: selectedEntityLabel,
                  id: selectedRunDisplayIndex ?? '-',
                })}
                <Badge className='inline-flex items-center gap-1'>
                  {renderRunStatusIcon(selectedRun.status)}
                  {t(runStatusBadgeLabelKey(selectedRun.status))}
                </Badge>
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
                  status={selectedLiveStatus}
                  statusLoading={selectedLiveStatusLoading}
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
