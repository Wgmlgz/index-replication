'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MoexIndex } from '@/lib/moex-client';
import { IndexChart, type ChartPoint } from './index-chart';

type IndexChartCardProps = {
  selectedIndex: MoexIndex | null;
  latestValue: number | null;
  change: number | null;
  changePercent: number | null;
  numberFormatter: Intl.NumberFormat;
  historyLoading: boolean;
  chartData: ChartPoint[];
};

export function IndexChartCard({
  selectedIndex,
  latestValue,
  change,
  changePercent,
  numberFormatter,
  historyLoading,
  chartData,
}: IndexChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>График</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {selectedIndex && (
          <div className='space-y-1'>
            <div className='text-lg font-semibold'>
              {selectedIndex.name} ({selectedIndex.secid})
            </div>
            <div className='text-sm text-muted-foreground'>
              Период: последние 12 месяцев · Валюта:{' '}
              {selectedIndex.currency ?? '—'}
            </div>
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
            Загрузка графика...
          </div>
        )}
        {!historyLoading && chartData.length === 0 && (
          <div className='text-sm text-muted-foreground'>
            Нет данных для отображения.
          </div>
        )}
        {!historyLoading && chartData.length > 0 && (
          <IndexChart data={chartData} />
        )}
      </CardContent>
    </Card>
  );
}
