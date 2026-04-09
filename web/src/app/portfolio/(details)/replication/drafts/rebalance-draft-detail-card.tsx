'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  PortfolioRebalanceDetailResponse,
  PortfolioRebalanceStatusResponse,
  PortfolioRebalanceInput,
  PortfolioRebalanceOutput,
  PortfolioRebalanceSummary,
  PortfolioRebalanceTransaction,
} from '@/api-client';
import { SortableDataTable } from '@/app/portfolio/components/sortable-data-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  buildBenchmarkColumns,
  buildExecutionItemsColumns,
  buildExecutionLinksColumns,
  buildHoldingsColumns,
  buildInstrumentsColumns,
  buildItemColumns,
  buildMoneyColumns,
  buildTransactionsColumns,
} from './rebalance-draft-detail-columns';
import { formatDateTime, formatNumber } from './rebalance-draft-detail-helpers';
import {
  runStatusPhaseLabelKey,
  statusStageLabelKey,
} from './rebalance-status-utils';

type RebalanceDraftDetailCardProps = {
  detail: PortfolioRebalanceDetailResponse;
  status: PortfolioRebalanceStatusResponse | null;
  statusLoading: boolean;
  language: string;
};

export function RebalanceDraftDetailCard({
  detail,
  status,
  statusLoading,
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
  const statusProgress = status?.progress;
  const statusItems = status?.items ?? [];
  const statusLinks = status?.links ?? [];
  const completionPercent = statusProgress?.completion_percent ?? 0;
  const runStatus = status?.run?.status || run?.status;
  const stageKey = statusStageLabelKey(statusProgress?.stage_code);
  const stageLabel = statusProgress?.stage_message || (stageKey ? t(stageKey) : '-');

  const itemColumns = useMemo(() => buildItemColumns(t), [t]);
  const executionItemsColumns = useMemo(
    () => buildExecutionItemsColumns(t, language),
    [language, t],
  );
  const executionLinksColumns = useMemo(
    () => buildExecutionLinksColumns(t, language),
    [language, t],
  );
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

      <div className='grid auto-rows-max rounded border text-xs text-muted-foreground md:grid-cols-2'>
        <div className='grid gap-1 p-3'>
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

        <div className='grid gap-1 border-t p-3 md:border-t-0 md:border-l'>
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
        <div className='grid gap-2 border-t p-3'>
          <div className='flex items-center justify-between gap-2'>
            <p className='font-medium text-foreground'>
              {t('portfolio.replication.rebalances.statusTitle')}
            </p>
            <p className='text-[11px]'>
              {statusLoading
                ? t('portfolio.replication.rebalances.statusRefreshing')
                : t('portfolio.replication.rebalances.statusReady')}
            </p>
          </div>
          <Progress value={completionPercent} />
          <p>
            {t('portfolio.replication.rebalances.statusPhaseLabel')}:{' '}
            {t(runStatusPhaseLabelKey(runStatus))}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusStageLabel')}:{' '}
            {stageLabel}
            {(statusProgress?.stage_index || statusProgress?.stage_total)
              ? ` (${formatNumber(statusProgress?.stage_index, 0)}/${formatNumber(statusProgress?.stage_total, 0)})`
              : ''}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCompletion')}:{' '}
            {formatNumber(completionPercent, 2)}%
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusLastEventAt')}:{' '}
            {formatDateTime(statusProgress?.last_event_at, language)}
          </p>
        </div>

        <div className='grid gap-1 border-t p-3 md:border-l'>
          <p className='font-medium text-foreground'>
            {t('portfolio.replication.rebalances.statusCountersTitle')}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCounters.total')}:{' '}
            {formatNumber(statusProgress?.total_items, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCounters.actionable')}:{' '}
            {formatNumber(statusProgress?.actionable_items, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCounters.pending')}:{' '}
            {formatNumber(statusProgress?.pending_items, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCounters.executing')}:{' '}
            {formatNumber(statusProgress?.executing_items, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCounters.completed')}:{' '}
            {formatNumber(statusProgress?.completed_items, 0)}
          </p>
          <p>
            {t('portfolio.replication.rebalances.statusCounters.failed')}:{' '}
            {formatNumber(statusProgress?.failed_items, 0)}
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
          <TabsTrigger value='execution-items'>
            {t('portfolio.replication.rebalances.tabs.executionItems')}
          </TabsTrigger>
          <TabsTrigger value='execution-events'>
            {t('portfolio.replication.rebalances.tabs.executionEvents')}
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

            <TabsContent value='execution-items'>
              <SortableDataTable
                data={statusItems}
                columns={executionItemsColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyExecutionItems')}
                getRowKey={(row, index) =>
                  `${index}-${row.id ?? 0}-${row.instrument_id ?? ''}-${row.side ?? ''}`
                }
              />
            </TabsContent>

            <TabsContent value='execution-events'>
              <SortableDataTable
                data={statusLinks}
                columns={executionLinksColumns}
                emptyLabel={t('portfolio.replication.rebalances.emptyExecutionEvents')}
                getRowKey={(row, index) =>
                  `${index}-${row.id ?? 0}-${row.rebalance_item_id ?? 0}`
                }
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
