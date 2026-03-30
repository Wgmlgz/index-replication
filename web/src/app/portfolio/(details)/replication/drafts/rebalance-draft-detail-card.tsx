'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceInput,
  PortfolioRebalanceOutput,
  PortfolioRebalanceSummary,
  PortfolioRebalanceTransaction,
} from '@/api-client';
import { SortableDataTable } from '@/app/portfolio/components/sortable-data-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildBenchmarkColumns,
  buildHoldingsColumns,
  buildInstrumentsColumns,
  buildItemColumns,
  buildMoneyColumns,
  buildTransactionsColumns,
} from './rebalance-draft-detail-columns';
import { formatDateTime, formatNumber } from './rebalance-draft-detail-helpers';

type RebalanceDraftDetailCardProps = {
  detail: PortfolioRebalanceDetailResponse;
  language: string;
};

export function RebalanceDraftDetailCard({
  detail,
  language,
}: RebalanceDraftDetailCardProps) {
  const { t } = useTranslation();
  const run = detail.run;
  const input: PortfolioRebalanceInput | undefined = detail.input;
  const output: PortfolioRebalanceOutput | undefined = detail.output;
  const summary: PortfolioRebalanceSummary | undefined = detail.summary;
  const transactions: PortfolioRebalanceTransaction[] = detail.transactions ?? [];

  const warnings = output?.warnings ?? [];
  const inputHoldings = input?.holdings ?? [];
  const inputBenchmark = input?.benchmark ?? [];
  const inputInstruments = input?.instruments ?? [];
  const inputMoney = input?.money ?? [];
  const outputItems = output?.items ?? [];
  const outputMoney = output?.money ?? [];
  const inputInvestableCapital: number | undefined = input?.investable_capital;
  const summaryItemsTotal: number | undefined = summary?.items_total;
  const summaryActionableItems: number | undefined = summary?.actionable_items;
  const summaryUnresolvedItems: number | undefined = summary?.unresolved_items;
  const summaryEstimatedTurnover: number | undefined =
    summary?.estimated_turnover_abs;

  const itemColumns = useMemo(() => buildItemColumns(t), [t]);
  const holdingsColumns = useMemo(() => buildHoldingsColumns(t), [t]);
  const benchmarkColumns = useMemo(() => buildBenchmarkColumns(t), [t]);
  const instrumentsColumns = useMemo(
    () => buildInstrumentsColumns(t, language),
    [language, t],
  );
  const moneyColumns = useMemo(() => buildMoneyColumns(t), [t]);
  const transactionColumns = useMemo(() => buildTransactionsColumns(t), [t]);

  return (
    <div className='flex flex-col min-w-0 gap-3 h-full'>
      <div className='grid gap-1 text-xs text-muted-foreground'>
        <p>
          {t('portfolio.replication.rebalances.detailModeLabel')}:{' '}
          {run?.mode_key || '-'}
        </p>
        <p>
          {t('portfolio.replication.rebalances.detailExecutionLabel')}:{' '}
          {run?.execution_mode || '-'}
        </p>
        <p>
          {t('portfolio.replication.rebalances.detailAsOfLabel')}:{' '}
          {run?.as_of_date || '-'}
        </p>
        <p>
          {t('portfolio.replication.rebalances.detailCreatedLabel')}:{' '}
          {formatDateTime(run?.created_at, language)}
        </p>
      </div>

      {warnings.length > 0 ? (
        <Alert>
          <AlertTitle>
            {t('portfolio.replication.rebalances.warningsTitle')}
          </AlertTitle>
          <AlertDescription>{warnings.join(', ')}</AlertDescription>
        </Alert>
      ) : null}

      <div className='grid gap-3 text-xs text-muted-foreground md:grid-cols-2'>
        <div className='grid gap-1 rounded border p-3'>
          <p className='font-medium text-foreground'>
            {t('portfolio.replication.rebalances.inputTitle')}
          </p>
          <p>
            {t('portfolio.replication.rebalances.inputInvestableCapital')}:{' '}
            {formatNumber(inputInvestableCapital, 2)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.inputHoldingsCount')}:{' '}
            {formatNumber(inputHoldings.length, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.inputBenchmarkCount')}:{' '}
            {formatNumber(inputBenchmark.length, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.inputInstrumentsCount')}:{' '}
            {formatNumber(inputInstruments.length, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.inputMoneyCount')}:{' '}
            {formatNumber(inputMoney.length, 0)}
          </p>
        </div>

        <div className='grid gap-1 rounded border p-3'>
          <p className='font-medium text-foreground'>
            {t('portfolio.replication.rebalances.summaryTitle')}
          </p>
          <p>
            {t('portfolio.replication.rebalances.summaryItemsTotal')}:{' '}
            {formatNumber(summaryItemsTotal, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.summaryActionable')}:{' '}
            {formatNumber(summaryActionableItems, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.summaryUnresolved')}:{' '}
            {formatNumber(summaryUnresolvedItems, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.summaryTurnover')}:{' '}
            {formatNumber(summaryEstimatedTurnover, 2)}
          </p>
        </div>
      </div>

      <Tabs defaultValue='input-holdings' className='grow min-w-0 gap-3 h-full flex flex-col'>
        <TabsList className='h-auto w-full justify-start overflow-x-auto'>
          <TabsTrigger value='input-holdings'>
            {t('portfolio.replication.rebalances.tabs.inputHoldings')}
          </TabsTrigger>
          <TabsTrigger value='input-benchmark'>
            {t('portfolio.replication.rebalances.tabs.inputBenchmark')}
          </TabsTrigger>
          <TabsTrigger value='input-instruments'>
            {t('portfolio.replication.rebalances.tabs.inputInstruments')}
          </TabsTrigger>
          <TabsTrigger value='input-money'>
            {t('portfolio.replication.rebalances.tabs.inputMoney')}
          </TabsTrigger>
          <TabsTrigger value='output-items'>
            {t('portfolio.replication.rebalances.tabs.outputItems')}
          </TabsTrigger>
          <TabsTrigger value='output-money'>
            {t('portfolio.replication.rebalances.tabs.outputMoney')}
          </TabsTrigger>
          <TabsTrigger value='transactions'>
            {t('portfolio.replication.rebalances.tabs.transactions')}
          </TabsTrigger>
        </TabsList>

        <div className='grow  relative w-full'>
          <div className='absolute inset-0 overflow-auto'>
            <TabsContent value='input-holdings'>
              <SortableDataTable
                data={inputHoldings}
                columns={holdingsColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyInputHoldings')}
                getRowKey={(row, index) =>
                  `${index}-${row.instrument_id ?? ''}-${row.ticker ?? ''}`
                }
              />
            </TabsContent>

            <TabsContent value='input-benchmark'>
              <SortableDataTable
                data={inputBenchmark}
                columns={benchmarkColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyInputBenchmark')}
                getRowKey={(row, index) =>
                  `${index}-${row.instrument_id ?? ''}-${row.ticker ?? ''}`
                }
              />
            </TabsContent>

            <TabsContent value='input-instruments'>
              <SortableDataTable
                data={inputInstruments}
                columns={instrumentsColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyInputInstruments')}
                getRowKey={(row, index) =>
                  `${index}-${row.instrument_id ?? ''}-${row.ticker ?? ''}`
                }
              />
            </TabsContent>

            <TabsContent value='input-money'>
              <SortableDataTable
                data={inputMoney}
                columns={moneyColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyMoney')}
                getRowKey={(row, index) => `${index}-${row.currency ?? ''}`}
              />
            </TabsContent>

            <TabsContent value='output-items'>
              <SortableDataTable
                data={outputItems}
                columns={itemColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyItems')}
                getRowKey={(row, index) =>
                  `${index}-${row.ticker ?? ''}-${row.instrument_id ?? ''}-${row.side ?? ''}`
                }
              />
            </TabsContent>

            <TabsContent value='output-money'>
              <SortableDataTable
                data={outputMoney}
                columns={moneyColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyMoney')}
                getRowKey={(row, index) => `${index}-${row.currency ?? ''}`}
              />
            </TabsContent>

            <TabsContent value='transactions'>
              <SortableDataTable
                data={transactions}
                columns={transactionColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyTransactions')}
                getRowKey={(row, index) =>
                  `${index}-${row.instrument_id ?? ''}-${row.side ?? ''}-${row.sequence ?? 0}`
                }
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
