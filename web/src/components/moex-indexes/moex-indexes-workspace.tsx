'use client';

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoexIndexesChartsPanel } from '@/components/moex-indexes/charts-new/moex-indexes-charts-panel';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { isIndexInactive } from '@/components/moex-indexes/moex-indexes-activity';
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
  const { selectedIndex, selectedIndexCollections } = useMoexIndexDetailContext();
  const { t, i18n } = useTranslation();

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
  const headerTitle = selectedIndex ? `${selectedIndex.secid} - ${chartTitle}` : chartTitle;
  const isInactive =
    selectedIndex && selectedIndex.lastActiveDate
      ? isIndexInactive(selectedIndex.lastActiveDate)
      : false;
  const groupsLabel = useMemo(
    () =>
      selectedIndex
        ? selectedIndexCollections.length > 0
          ? t('moex.groups.list', { groups: selectedIndexCollections.join(', ') })
          : t('moex.groups.none')
        : '',
    [selectedIndex, selectedIndexCollections, t]
  );
  const headerNumberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language || 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [i18n.language]
  );

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
            <CardTitle className='flex min-w-0 items-center gap-2 overflow-x-auto pb-1 whitespace-nowrap'>
              <span className='shrink-0'>{headerTitle}</span>
              {selectedIndex && selectedIndex.currency ? (
                <Badge variant='secondary' className='shrink-0'>
                  {selectedIndex.currency}
                </Badge>
              ) : null}
              {selectedIndex && selectedIndex.boardId ? (
                <Badge variant='secondary' className='shrink-0'>
                  {t('moex.chart.board', { board: selectedIndex.boardId })}
                </Badge>
              ) : null}
              {selectedIndex && selectedIndex.calcMode ? (
                <Badge variant='secondary' className='shrink-0'>
                  {selectedIndex.calcMode}
                </Badge>
              ) : null}
              {selectedIndex && selectedIndex.annualHigh != null ? (
                <Badge variant='outline' className='shrink-0'>
                  {t('moex.chart.max', {
                    value: headerNumberFormatter.format(selectedIndex.annualHigh),
                  })}
                </Badge>
              ) : null}
              {selectedIndex && selectedIndex.annualLow != null ? (
                <Badge variant='outline' className='shrink-0'>
                  {t('moex.chart.min', {
                    value: headerNumberFormatter.format(selectedIndex.annualLow),
                  })}
                </Badge>
              ) : null}
              {selectedIndex && groupsLabel ? (
                <Badge variant='outline' className='shrink-0'>
                  {groupsLabel}
                </Badge>
              ) : null}
              {isInactive && selectedIndex?.lastActiveDate ? (
                <Badge
                  variant='outline'
                  className='shrink-0 border-amber-300/80 text-amber-700'
                >
                  {t('moex.status.inactiveSince', {
                    date: selectedIndex.lastActiveDate,
                  })}
                </Badge>
              ) : null}
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
