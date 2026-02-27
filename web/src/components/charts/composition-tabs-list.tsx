'use client';

import { useTranslation } from 'react-i18next';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type CompositionTabsListProps = {
  translationKeyPrefix: string;
  className?: string;
};

export function CompositionTabsList({
  translationKeyPrefix,
  className,
}: CompositionTabsListProps) {
  const { t } = useTranslation();

  return (
    <TabsList className={cn('w-full justify-start', className)}>
      <TabsTrigger value='snapshot'>
        {t(`${translationKeyPrefix}.tabs.snapshot`)}
      </TabsTrigger>
      <TabsTrigger value='trend'>
        {t(`${translationKeyPrefix}.tabs.trend`)}
      </TabsTrigger>
      <TabsTrigger value='stacked'>
        {t(`${translationKeyPrefix}.tabs.stacked`)}
      </TabsTrigger>
    </TabsList>
  );
}
