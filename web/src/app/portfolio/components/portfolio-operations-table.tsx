'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

  const columns = useMemo<ColumnDef<PortfolioOperationHistoryItem>[]>(
    () => [
      {
        id: 'date',
        header: () => t('portfolio.card.operationDate'),
        cell: ({ row }) => formatDateTime(row.original.date),
      },
      {
        id: 'type',
        header: () => t('portfolio.card.operationType'),
        cell: ({ row }) => formatEnumLabel(row.original.type, 'OPERATION_TYPE_'),
      },
      {
        id: 'state',
        header: () => t('portfolio.card.operationState'),
        cell: ({ row }) => formatEnumLabel(row.original.state, 'OPERATION_STATE_'),
      },
      {
        id: 'instrument',
        header: () => t('portfolio.card.operationInstrument'),
        cell: ({ row }) =>
          row.original.name || row.original.instrument_id || row.original.figi || '-',
      },
      {
        id: 'quantity',
        header: () => t('portfolio.card.operationQuantity'),
        cell: ({ row }) =>
          formatNumber(row.original.quantity_done || row.original.quantity || 0),
      },
      {
        id: 'price',
        header: () => t('portfolio.card.operationPrice'),
        cell: ({ row }) =>
          `${formatNumber(row.original.price ?? 0)} ${row.original.price_currency || ''}`.trim(),
      },
      {
        id: 'payment',
        header: () => t('portfolio.card.operationPayment'),
        cell: ({ row }) =>
          `${formatNumber(row.original.payment ?? 0)} ${row.original.payment_currency || ''}`.trim(),
      },
      {
        id: 'commission',
        header: () => t('portfolio.card.operationCommission'),
        cell: ({ row }) =>
          `${formatNumber(row.original.commission ?? 0)} ${row.original.commission_currency || ''}`.trim(),
      },
      {
        id: 'description',
        header: () => t('portfolio.card.operationDescription'),
        cell: ({ row }) => row.original.description || '-',
      },
    ],
    [t],
  );

  const table = useReactTable({
    data: operations,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

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
            <Table>
              <TableHeader className='bg-muted/50'>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map(row => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className='text-muted-foreground' colSpan={columns.length}>
                      {t('portfolio.card.operationsEmpty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
