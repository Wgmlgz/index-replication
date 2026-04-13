'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TFunction } from 'i18next';

import type {
  PortfolioRebalanceStatusResponse,
  PortfolioRebalanceRun,
} from '@/api-client';
import { portfolioApi } from '@/lib/api';
import { STATUS_POLLING_MS } from './rebalance-status-utils';

type LoadStatusOptions = {
  silent?: boolean;
};

type UseRebalanceStatusParams = {
  portfolioID: number | null;
  rebalanceID: number | null;
  enabled: boolean;
  t: TFunction;
  parseErrorMessage: (error: unknown, fallback: string) => string;
  onRunUpdate: (run: PortfolioRebalanceRun) => void;
};

export function useRebalanceStatus({
  portfolioID,
  rebalanceID,
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
    if (!enabled || !portfolioID || !rebalanceID) {
      return;
    }
    void refreshStatus();
  }, [enabled, portfolioID, rebalanceID, refreshStatus]);

  useEffect(() => {
    if (!enabled || !portfolioID || !rebalanceID) {
      return;
    }
    const timerID = window.setInterval(() => {
      void refreshStatus({ silent: true });
    }, STATUS_POLLING_MS);
    return () => {
      window.clearInterval(timerID);
    };
  }, [enabled, portfolioID, rebalanceID, refreshStatus]);

  return {
    status,
    statusLoading,
    statusError,
    refreshStatus,
    clearStatus,
  };
}
