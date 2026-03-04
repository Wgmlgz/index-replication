'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import type { PortfolioOperationHistoryItem } from '@/api-client';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  formatDateTime,
  formatEnumLabel,
  formatNumber,
} from '@/app/portfolio/components/portfolio-formatting';

const OPERATIONS_PAGE_SIZE = 50;

type PortfolioOperationsTableProps = {
  portfolioID: number | null;
};

export function PortfolioOperationsTable({
  portfolioID,
}: PortfolioOperationsTableProps) {
  const { t } = useTranslation();
  const [operations, setOperations] = useState<PortfolioOperationHistoryItem[]>([]);
  const [operationsHasNext, setOperationsHasNext] = useState(false);
  const [operationsNextCursor, setOperationsNextCursor] = useState('');
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [loadingMoreOperations, setLoadingMoreOperations] = useState(false);
  const [operationsError, setOperationsError] = useState('');

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }
    return fallback;
  }, []);

  const loadOperations = useCallback(
    async (targetPortfolioID: number, cursor?: string, append = false) => {
      if (append) {
        setLoadingMoreOperations(true);
      } else {
        setLoadingOperations(true);
        setOperationsError('');
      }

      try {
        const response = (
          await portfolioApi.mePortfoliosIdOperationsGet(
            targetPortfolioID,
            cursor || undefined,
            OPERATIONS_PAGE_SIZE,
          )
        ).data;

        const items = response.items ?? [];
        setOperations(currentItems => (append ? [...currentItems, ...items] : items));
        setOperationsHasNext(Boolean(response.has_next));
        setOperationsNextCursor(response.next_cursor || '');
      } catch (err) {
        setOperationsError(parseErrorMessage(err, t('portfolio.errors.operations')));
        if (!append) {
          setOperations([]);
          setOperationsHasNext(false);
          setOperationsNextCursor('');
        }
      } finally {
        if (append) {
          setLoadingMoreOperations(false);
        } else {
          setLoadingOperations(false);
        }
      }
    },
    [parseErrorMessage, t],
  );

  useEffect(() => {
    if (!portfolioID) {
      setOperations([]);
      setOperationsHasNext(false);
      setOperationsNextCursor('');
      setOperationsError('');
      return;
    }

    void loadOperations(portfolioID);
  }, [loadOperations, portfolioID]);

  const onLoadMoreOperations = () => {
    if (!portfolioID || !operationsHasNext || !operationsNextCursor) {
      return;
    }

    void loadOperations(portfolioID, operationsNextCursor, true);
  };

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.operations.title')}</CardTitle>
          <CardDescription>{t('portfolio.operations.description')}</CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.card.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='h-full min-h-0 overflow-hidden'>
      <CardHeader>
        <CardTitle>{t('portfolio.operations.title')}</CardTitle>
        <CardDescription>{t('portfolio.operations.description')}</CardDescription>
      </CardHeader>
      <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
        {operationsError ? (
          <Alert variant='destructive'>
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{operationsError}</AlertDescription>
          </Alert>
        ) : null}

        {loadingOperations ? (
          <div className='text-muted-foreground'>{t('portfolio.card.operationsLoading')}</div>
        ) : (
          <div className='overflow-auto rounded-md border'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='p-2'>{t('portfolio.card.operationDate')}</th>
                  <th className='p-2'>{t('portfolio.card.operationType')}</th>
                  <th className='p-2'>{t('portfolio.card.operationState')}</th>
                  <th className='p-2'>{t('portfolio.card.operationInstrument')}</th>
                  <th className='p-2'>{t('portfolio.card.operationQuantity')}</th>
                  <th className='p-2'>{t('portfolio.card.operationPrice')}</th>
                  <th className='p-2'>{t('portfolio.card.operationPayment')}</th>
                  <th className='p-2'>{t('portfolio.card.operationCommission')}</th>
                  <th className='p-2'>{t('portfolio.card.operationDescription')}</th>
                </tr>
              </thead>
              <tbody>
                {operations.length === 0 ? (
                  <tr>
                    <td className='p-2 text-muted-foreground' colSpan={9}>
                      {t('portfolio.card.operationsEmpty')}
                    </td>
                  </tr>
                ) : (
                  operations.map((operation, index) => (
                    <tr
                      key={`${operation.id || 'op'}:${operation.cursor || index}:${operation.date || '-'}`}
                      className='border-t'
                    >
                      <td className='p-2'>{formatDateTime(operation.date)}</td>
                      <td className='p-2'>
                        {formatEnumLabel(operation.type, 'OPERATION_TYPE_')}
                      </td>
                      <td className='p-2'>
                        {formatEnumLabel(operation.state, 'OPERATION_STATE_')}
                      </td>
                      <td className='p-2'>
                        {operation.name || operation.instrument_id || operation.figi || '-'}
                      </td>
                      <td className='p-2'>
                        {formatNumber(operation.quantity_done || operation.quantity || 0)}
                      </td>
                      <td className='p-2'>
                        {formatNumber(operation.price ?? 0)} {operation.price_currency || ''}
                      </td>
                      <td className='p-2'>
                        {formatNumber(operation.payment ?? 0)} {operation.payment_currency || ''}
                      </td>
                      <td className='p-2'>
                        {formatNumber(operation.commission ?? 0)} {operation.commission_currency || ''}
                      </td>
                      <td className='p-2'>{operation.description || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {operationsHasNext ? (
          <Button
            type='button'
            variant='outline'
            onClick={onLoadMoreOperations}
            disabled={loadingMoreOperations}
          >
            {loadingMoreOperations
              ? t('portfolio.card.operationsLoadingMore')
              : t('portfolio.card.operationsLoadMore')}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
