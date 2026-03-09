'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_OPERATIONS_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type PortfolioOperationsTableProps = {
  portfolioID: number | null;
};

export function PortfolioOperationsTable({
  portfolioID,
}: PortfolioOperationsTableProps) {
  const { t } = useTranslation();
  const [operations, setOperations] = useState<PortfolioOperationHistoryItem[]>([]);
  const [pageSize, setPageSize] = useState(DEFAULT_OPERATIONS_PAGE_SIZE);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<string[]>(['']);
  const [currentHasNextPage, setCurrentHasNextPage] = useState(false);
  const [currentNextCursor, setCurrentNextCursor] = useState('');
  const [loadingOperations, setLoadingOperations] = useState(false);
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
    getRowId: (row, index) => `${row.id || 'op'}:${row.cursor || index}:${row.date || '-'}`,
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

  const loadOperationsPage = useCallback(
    async (
      targetPortfolioID: number,
      targetPageIndex: number,
      targetPageSize: number,
      cursor: string,
    ) => {
      setLoadingOperations(true);
      setOperationsError('');
      try {
        const response = (
          await portfolioApi.mePortfoliosIdOperationsGet(
            targetPortfolioID,
            cursor || undefined,
            targetPageSize,
          )
        ).data;

        const items = response.items ?? [];
        const hasNext = Boolean(response.has_next);
        const nextCursor = response.next_cursor || '';

        setOperations(items);
        setCurrentPageIndex(targetPageIndex);
        setCurrentHasNextPage(hasNext);
        setCurrentNextCursor(nextCursor);
        setPageCursors(prev => {
          const next = [...prev.slice(0, targetPageIndex + 1)];
          next[targetPageIndex] = cursor;
          if (hasNext && nextCursor) {
            next[targetPageIndex + 1] = nextCursor;
          }
          return next;
        });
      } catch (err) {
        setOperationsError(parseErrorMessage(err, t('portfolio.errors.operations')));
        setOperations([]);
        setCurrentHasNextPage(false);
        setCurrentNextCursor('');
      } finally {
        setLoadingOperations(false);
      }
    },
    [parseErrorMessage, t],
  );

  useEffect(() => {
    if (!portfolioID) {
      setOperations([]);
      setCurrentHasNextPage(false);
      setCurrentNextCursor('');
      setCurrentPageIndex(0);
      setPageCursors(['']);
      setPageSize(DEFAULT_OPERATIONS_PAGE_SIZE);
      setOperationsError('');
      return;
    }

    setCurrentPageIndex(0);
    setPageCursors(['']);
    void loadOperationsPage(portfolioID, 0, pageSize, '');
  }, [loadOperationsPage, pageSize, portfolioID]);

  const onPreviousPage = () => {
    if (!portfolioID || currentPageIndex <= 0 || loadingOperations) {
      return;
    }
    const prevPageIndex = currentPageIndex - 1;
    const prevCursor = pageCursors[prevPageIndex] || '';
    void loadOperationsPage(portfolioID, prevPageIndex, pageSize, prevCursor);
  };

  const onNextPage = () => {
    if (!portfolioID || !currentHasNextPage || loadingOperations) {
      return;
    }

    const nextPageIndex = currentPageIndex + 1;
    const nextCursor = pageCursors[nextPageIndex] || currentNextCursor;
    if (!nextCursor) {
      return;
    }

    void loadOperationsPage(portfolioID, nextPageIndex, pageSize, nextCursor);
  };

  const onPageSizeChange = (value: string) => {
    const nextPageSize = Number.parseInt(value, 10);
    if (!Number.isFinite(nextPageSize) || nextPageSize < 1) {
      return;
    }

    setPageSize(nextPageSize);
    setCurrentPageIndex(0);
    setPageCursors(['']);
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
      <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden text-sm'>
        {operationsError ? (
          <Alert variant='destructive'>
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{operationsError}</AlertDescription>
          </Alert>
        ) : null}

        {loadingOperations ? (
          <div className='text-muted-foreground'>{t('portfolio.card.operationsLoading')}</div>
        ) : (
          <div className='min-h-0 flex-1 overflow-auto rounded-md border'>
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

        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>
              {t('portfolio.operations.pagination.rowsPerPage')}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={onPageSizeChange}
              disabled={loadingOperations}
            >
              <SelectTrigger className='h-8 w-[90px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent side='top'>
                {PAGE_SIZE_OPTIONS.map(option => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-3'>
            <span className='text-muted-foreground text-sm'>
              {currentPageIndex + 1}
            </span>
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={onPreviousPage}
                disabled={loadingOperations || currentPageIndex === 0}
                aria-label={t('portfolio.operations.pagination.previous')}
              >
                <ChevronLeft className='size-4' />
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                onClick={onNextPage}
                disabled={loadingOperations || !currentHasNextPage}
                aria-label={t('portfolio.operations.pagination.next')}
              >
                <ChevronRight className='size-4' />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
