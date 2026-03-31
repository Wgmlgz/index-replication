'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';

import type {
  PortfolioRebalanceExecutionStatusResponse,
  PortfolioRebalanceRun,
} from '@/api-client';
import { portfolioApi } from '@/lib/api';
import {
  EXECUTION_POLLING_MS,
  isRunExecutionInProgress,
} from './rebalance-execution-utils';

type LoadExecutionStatusOptions = {
  silent?: boolean;
};

type UseRebalanceExecutionStatusParams = {
  portfolioID: number | null;
  rebalanceID: number | null;
  detailDialogOpen: boolean;
  t: TFunction;
  parseErrorMessage: (error: unknown, fallback: string) => string;
  onRunUpdate: (run: PortfolioRebalanceRun) => void;
};

export function useRebalanceExecutionStatus({
  portfolioID,
  rebalanceID,
  detailDialogOpen,
  t,
  parseErrorMessage,
  onRunUpdate,
}: UseRebalanceExecutionStatusParams) {
  const [executionStatus, setExecutionStatus] =
    useState<PortfolioRebalanceExecutionStatusResponse | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionError, setExecutionError] = useState('');

  const clearExecutionStatus = useCallback(() => {
    setExecutionStatus(null);
    setExecutionLoading(false);
    setExecutionError('');
  }, []);

  const refreshExecutionStatus = useCallback(
    async (options?: LoadExecutionStatusOptions) => {
      if (!portfolioID || !rebalanceID) {
        return null;
      }
      const silent = options?.silent === true;
      if (!silent) {
        setExecutionLoading(true);
      }
      try {
        const response =
          await portfolioApi.mePortfoliosIdRebalancesRebalanceIdExecutionGet(
            portfolioID,
            rebalanceID,
          );
        const nextStatus = response.data ?? null;
        setExecutionStatus(nextStatus);
        setExecutionError('');
        const nextRun = nextStatus?.run;
        if (nextRun) {
          onRunUpdate(nextRun);
        }
        return nextStatus;
      } catch (error) {
        if (!silent) {
          setExecutionError(
            parseErrorMessage(
              error,
              t('portfolio.replication.errors.loadExecutionStatus'),
            ),
          );
        }
        return null;
      } finally {
        if (!silent) {
          setExecutionLoading(false);
        }
      }
    },
    [onRunUpdate, parseErrorMessage, portfolioID, rebalanceID, t],
  );

  useEffect(() => {
    clearExecutionStatus();
  }, [clearExecutionStatus, portfolioID, rebalanceID]);

  useEffect(() => {
    if (!detailDialogOpen || !portfolioID || !rebalanceID) {
      return;
    }
    void refreshExecutionStatus();
  }, [detailDialogOpen, portfolioID, rebalanceID, refreshExecutionStatus]);

  useEffect(() => {
    if (!detailDialogOpen || !portfolioID || !rebalanceID) {
      return;
    }
    const runStatus = executionStatus?.run?.status;
    if (!isRunExecutionInProgress(runStatus)) {
      return;
    }
    const timerID = window.setInterval(() => {
      void refreshExecutionStatus({ silent: true });
    }, EXECUTION_POLLING_MS);
    return () => {
      window.clearInterval(timerID);
    };
  }, [
    detailDialogOpen,
    executionStatus?.run?.status,
    portfolioID,
    rebalanceID,
    refreshExecutionStatus,
  ]);

  return {
    executionStatus,
    executionLoading,
    executionError,
    refreshExecutionStatus,
    clearExecutionStatus,
  };
}
