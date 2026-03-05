'use client';

import { useTranslation } from 'react-i18next';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { MoexSourceButton } from '@/components/moex-indexes/moex-source-button';
import { moexSourceLinks } from '@/components/moex-indexes/moex-sources';
import { IndexListBrowser } from './index-list-browser';

export function IndexListCard() {
  const { t } = useTranslation();
  const listSourceLabel = t('moex.sources.list');

  return (
    <Card className='flex h-full flex-col'>
      <CardHeader>
        <CardTitle>{t('moex.list.title')}</CardTitle>
        <CardAction>
          <MoexSourceButton
            href={moexSourceLinks.indexList}
            label={listSourceLabel}
            tooltip={listSourceLabel}
          />
        </CardAction>
      </CardHeader>
      <CardContent className='h-full min-h-0'>
        <IndexListBrowser />
      </CardContent>
    </Card>
  );
}
