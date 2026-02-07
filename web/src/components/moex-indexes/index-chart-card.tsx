'use client';

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndexChart } from './index-chart';
import { useMoexIndexesContext } from './moex-indexes-context';

export function IndexChartCard() {
  const {
    selectedIndex,
    selectedIndexCollections,
    latestValue,
    change,
    changePercent,
    numberFormatter,
    historyLoading,
    chartData,
  } = useMoexIndexesContext();
  const { t } = useTranslation();

  const collectionPreview = selectedIndexCollections.slice(0, 3);
  const remainingCollections =
    selectedIndexCollections.length > 3
      ? selectedIndexCollections.length - 3
      : 0;

  const groupsLabel = selectedIndex
    ? selectedIndexCollections.length > 0
      ? remainingCollections > 0
        ? t('moex.groups.more', {
            groups: collectionPreview.join(', '),
            count: remainingCollections,
          })
        : t('moex.groups.list', {
            groups: collectionPreview.join(', '),
          })
      : t('moex.groups.none')
    : '';

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>{t('moex.chart.title')}</CardTitle>
      </CardHeader>
      <CardContent className='flex h-full min-h-0 flex-col gap-3'>
        {selectedIndex && (
          <div className='space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='text-lg font-semibold'>{selectedIndex.name}</div>
              <Badge variant='outline'>{selectedIndex.secid}</Badge>
            </div>
            <div className='text-sm text-muted-foreground'>
              {t('moex.chart.period', {
                months: 12,
                currency: selectedIndex.currency ?? '?',
              })}
            </div>
            <div className='flex flex-wrap gap-2'>
              {selectedIndex.boardId && (
                <Badge variant='secondary'>
                  {t('moex.chart.board', { board: selectedIndex.boardId })}
                </Badge>
              )}
              {selectedIndex.calcMode && (
                <Badge variant='secondary'>{selectedIndex.calcMode}</Badge>
              )}
              {selectedIndex.annualHigh !== null && (
                <Badge variant='outline'>
                  {t('moex.chart.max', {
                    value: numberFormatter.format(selectedIndex.annualHigh),
                  })}
                </Badge>
              )}
              {selectedIndex.annualLow !== null && (
                <Badge variant='outline'>
                  {t('moex.chart.min', {
                    value: numberFormatter.format(selectedIndex.annualLow),
                  })}
                </Badge>
              )}
            </div>
            {groupsLabel && (
              <div className='text-xs text-muted-foreground'>
                {groupsLabel}
              </div>
            )}
            {latestValue !== null && (
              <div className='text-sm'>
                <span className='font-medium'>
                  {numberFormatter.format(latestValue)}
                </span>
                {selectedIndex.currency ? ` ${selectedIndex.currency}` : ''}
                {change !== null && changePercent !== null && (
                  <span
                    className={`ml-2 text-sm font-medium ${
                      change > 0
                        ? 'text-emerald-600'
                        : change < 0
                          ? 'text-red-600'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {change > 0 ? '+' : ''}
                    {numberFormatter.format(change)} ({change > 0 ? '+' : ''}
                    {changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {historyLoading && (
          <div className='text-sm text-muted-foreground'>
            {t('moex.chart.loading')}
          </div>
        )}
        {!historyLoading && chartData.length === 0 && (
          <div className='text-sm text-muted-foreground'>
            {t('moex.chart.noData')}
          </div>
        )}
        {!historyLoading && chartData.length > 0 && (
          <div className='min-h-[240px] flex-1'>
            <IndexChart data={chartData} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
