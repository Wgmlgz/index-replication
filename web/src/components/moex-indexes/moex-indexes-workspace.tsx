'use client';

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoexIndexesChartsPanel } from '@/components/moex-indexes/charts-new/moex-indexes-charts-panel';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { useMoexIndexDetailContext } from '@/components/moex-indexes/detail/moex-indexes-detail-context';
import { IndexListCard } from '@/components/moex-indexes/list/index-list-card';
import { cn } from '@/lib/utils';

type MoexIndexesWorkspaceProps = {
  className?: string;
  leftPanel?: ReactNode;
  rightAction?: ReactNode;
  showHistorySourceButton?: boolean;
};

export function MoexIndexesWorkspace({
  className,
  leftPanel,
  rightAction,
  showHistorySourceButton = true,
}: MoexIndexesWorkspaceProps) {
  const { selectedIndex } = useMoexIndexDetailContext();
  const { t } = useTranslation();

  const historySourceLabel = selectedIndex
    ? t('moex.sources.indexPage', { secid: selectedIndex.secid })
    : t('moex.sources.selectIndex');
  const chartTitle = selectedIndex
    ? `${selectedIndex.name || selectedIndex.shortName || selectedIndex.secid}${
        selectedIndex.currency ? ` ${selectedIndex.currency}` : ''
      }`
    : t('moex.chart.title');
  const historyHref =
    selectedIndex && selectedIndex.secid
      ? moexSourceLinks.indexPage(selectedIndex.secid)
      : undefined;

  return (
    <div
      className={cn(
        'grid flex-1 min-h-0 grid-cols-1 gap-6 grid-rows-[minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]',
        className,
      )}
    >
      {leftPanel ?? <IndexListCard />}
      <div className='min-h-0'>
        <Card className='h-full min-h-0'>
          <CardHeader>
            <CardTitle>
              {selectedIndex && selectedIndex.secid} - {chartTitle}
            </CardTitle>
            <CardAction>
              {rightAction ??
                (showHistorySourceButton ? (
                  <MoexSourceButton
                    href={historyHref}
                    label={historySourceLabel}
                    tooltip={historySourceLabel}
                    disabledTooltip={t('moex.sources.selectIndex')}
                  />
                ) : null)}
            </CardAction>
          </CardHeader>
          <CardContent className='h-full min-h-0'>
            <MoexIndexesChartsPanel />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
