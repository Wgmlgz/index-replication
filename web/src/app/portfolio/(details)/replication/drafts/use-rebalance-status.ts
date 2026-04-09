'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';

import type {
  PortfolioRebalanceStatusResponse,
  PortfolioRebalanceRun,
} from '@/api-client';
import { portfolioApi } from '@/lib/api';
import {
  STATUS_POLLING_MS,
  isRunPlanningInProgress,
  isRunExecutionInProgress,
} from './rebalance-status-utils';

type LoadStatusOptions = {
  silent?: boolean;
};

type UseRebalanceStatusParams = {
  portfolioID: number | null;
  rebalanceID: number | null;
  detailDialogOpen: boolean;
  enabled: boolean;
  t: TFunction;
  parseErrorMessage: (error: unknown, fallback: string) => string;
  onRunUpdate: (run: PortfolioRebalanceRun) => void;
};

export function useRebalanceStatus({
  portfolioID,
  rebalanceID,
  detailDialogOpen,
  enabled,
  t,
  parseErrorMessage,
  onRunUpdate,
}: UseRebalanceStatusParams) {
  const [status, setStatus] = useState<PortfolioRebalanceStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const clearStatus = useCallback(() => {
    setStatus(null);
    setStatusLoading(false);
    setStatusError('');
  }, []);

  const refreshStatus = useCallback(
    async (options?: LoadStatusOptions) => {
      if (!portfolioID || !rebalanceID) {
        return null;
      }
      const silent = options?.silent === true;
      if (!silent) {
        setStatusLoading(true);
      }
      try {
        const response = await portfolioApi.mePortfoliosIdRebalancesRebalanceIdStatusGet(
          portfolioID,
          rebalanceID,
        );
        const nextStatus = response.data ?? null;
        setStatus(nextStatus);
        setStatusError('');
        const nextRun = nextStatus?.run;
        if (nextRun) {
          onRunUpdate(nextRun);
        }
        return nextStatus;
      } catch (error) {
        if (!silent) {
          setStatusError(
            parseErrorMessage(
              error,
              t('portfolio.replication.errors.loadStatus'),
            ),
          );
        }
        return null;
      } finally {
        if (!silent) {
          setStatusLoading(false);
        }
      }
    },
    [onRunUpdate, parseErrorMessage, portfolioID, rebalanceID, t],
  );

  useEffect(() => {
    clearStatus();
  }, [clearStatus, portfolioID, rebalanceID]);

  useEffect(() => {
    if (!enabled || !detailDialogOpen || !portfolioID || !rebalanceID) {
      return;
    }
    void refreshStatus();
  }, [detailDialogOpen, enabled, portfolioID, rebalanceID, refreshStatus]);

  useEffect(() => {
    if (!enabled || !detailDialogOpen || !portfolioID || !rebalanceID) {
      return;
    }
    const runStatus = status?.run?.status;
    if (!isRunPlanningInProgress(runStatus) && !isRunExecutionInProgress(runStatus)) {
      return;
    }
    const timerID = window.setInterval(() => {
      void refreshStatus({ silent: true });
    }, STATUS_POLLING_MS);
    return () => {
      window.clearInterval(timerID);
    };
  }, [
    detailDialogOpen,
    enabled,
    status?.run?.status,
    portfolioID,
    rebalanceID,
    refreshStatus,
  ]);

  return {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    clearStatus,
  };
}
