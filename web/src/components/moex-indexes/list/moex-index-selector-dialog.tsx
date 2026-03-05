'use client';

import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MoexIndex } from '@/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoexIndexListProvider } from './moex-indexes-list-context';
import { useMoexIndexListState } from './use-moex-indexes-list-state';
import { useMoexIndexesData } from '../use-moex-indexes-data';
import { MoexIndexDetailProvider } from '../detail/moex-indexes-detail-context';
import { useMoexSelectedIndex } from '../detail/use-moex-selected-index';
import { MoexIndexesWorkspace } from '../moex-indexes-workspace';

type MoexIndexSelectorDialogProps = {
  open: boolean;
  value: string | null;
  onOpenChange: (open: boolean) => void;
  onSelect: (index: MoexIndex) => void;
};

export function MoexIndexSelectorDialog({
  open,
  value,
  onOpenChange,
  onSelect,
}: MoexIndexSelectorDialogProps) {
  const { t } = useTranslation();
  const dataState = useMoexIndexesData();
  const listState = useMoexIndexListState({
    indexes: dataState.indexes,
    indexesLoading: dataState.indexesLoading,
    indexesError: dataState.indexesError,
    settingsError: dataState.settingsError,
    collectionMemberships: dataState.collectionMemberships,
    groupingCollections: dataState.groupingCollections,
    indexCollectionsMap: dataState.indexCollectionsMap,
    collectionOptions: dataState.collectionOptions,
    collectionsLoading: dataState.collectionsLoading,
    collectionsError: dataState.collectionsError,
    favoritesSet: dataState.favoritesSet,
    toggleFavorite: dataState.toggleFavorite,
    initial: {
      selectedSecid: value,
    },
  });
  const detailState = useMoexSelectedIndex({
    indexes: dataState.indexes,
    favorites: dataState.favorites,
    favoritesBySecid: dataState.favoritesBySecid,
    selectedSecid: listState.selectedSecid,
    indexCollectionsMap: dataState.indexCollectionsMap,
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    listState.setSelectedSecid(value ?? null);
    // list state uses local mutable controls, reset selected row whenever dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const selectedIndex = useMemo(
    () =>
      dataState.indexes.find(
        index => index.secid === listState.selectedSecid,
      ) ?? null,
    [dataState.indexes, listState.selectedSecid],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='h-[90svh] w-[95vw]! max-w-[95vw]! max-h-[90svh]! '>
        <DialogHeader className='px-6 pt-6'>
          <DialogTitle>{t('portfolio.replication.selector.title')}</DialogTitle>
          <DialogDescription>
            {t('portfolio.replication.selector.description')}
          </DialogDescription>
        </DialogHeader>

        {listState.error ? (
          <Alert variant='destructive' className='mb-3'>
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{listState.error}</AlertDescription>
          </Alert>
        ) : null}

        <MoexIndexListProvider value={listState}>
          <MoexIndexDetailProvider value={detailState}>
            <MoexIndexesWorkspace showHistorySourceButton={false} />
          </MoexIndexDetailProvider>
        </MoexIndexListProvider>

        <DialogFooter className='px-6 pb-6'>
          <div className='mr-auto text-xs text-muted-foreground'>
            {selectedIndex?.secid
              ? t('portfolio.replication.selector.selectedValue', {
                  secid: selectedIndex.secid,
                })
              : t('portfolio.replication.selector.noSelection')}
          </div>

          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('portfolio.replication.selector.cancelButton')}
          </Button>
          <Button
            type='button'
            disabled={!selectedIndex?.secid}
            onClick={() => {
              if (!selectedIndex?.secid) {
                return;
              }
              onSelect(selectedIndex);
              onOpenChange(false);
            }}
          >
            {t('portfolio.replication.selector.selectButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
