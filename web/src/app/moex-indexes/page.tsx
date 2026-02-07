'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IndexChartCard } from '@/components/moex-indexes/index-chart-card';
import { IndexListCard } from '@/components/moex-indexes/index-list-card';
import { useMoexIndexes } from '@/components/moex-indexes/use-moex-indexes';

export default function MoexIndexesPage() {
  const {
    query,
    setQuery,
    selectedSecid,
    setSelectedSecid,
    showFavoritesOnly,
    setShowFavoritesOnly,
    pageIndex,
    setPageIndex,
    pageSize,
    setPageSize,
    pageCount,
    showPagination,
    collectionOptions,
    selectedCollections,
    setSelectedCollections,
    currencyOptions,
    selectedCurrencies,
    setSelectedCurrencies,
    boardOptions,
    selectedBoards,
    setSelectedBoards,
    calcModeOptions,
    selectedCalcModes,
    setSelectedCalcModes,
    sortKey,
    setSortKey,
    sortOptions,
    hasActiveFilters,
    clearFilters,
    foundCount,
    isEmpty,
    showNoFavoritesMessage,
    indexesLoading,
    collectionsLoading,
    historyLoading,
    error,
    favoriteIndexes,
    collectionGroups,
    indexCollectionsMap,
    favoritesSet,
    toggleFavorite,
    selectedIndex,
    selectedIndexCollections,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  } = useMoexIndexes();

  return (
    <div className='flex h-[calc(100svh-65px-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 flex-col gap-6 overflow-hidden'>
      <div>
        <h1 className='text-3xl font-bold'>Индексы MOEX</h1>
        <p className='text-muted-foreground mt-2'>
          Выберите индекс, чтобы посмотреть динамику за последние 12 месяцев.
        </p>
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='grid flex-1 min-h-0 grid-cols-1 gap-6 grid-rows-[minmax(0,1fr)] lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[480px_minmax(0,1fr)]'>
        <IndexListCard
          query={query}
          onQueryChange={setQuery}
          indexesLoading={indexesLoading}
          collectionsLoading={collectionsLoading}
          showFavoritesOnly={showFavoritesOnly}
          onShowFavoritesOnlyChange={setShowFavoritesOnly}
          collectionOptions={collectionOptions}
          selectedCollections={selectedCollections}
          onSelectedCollectionsChange={setSelectedCollections}
          currencyOptions={currencyOptions}
          selectedCurrencies={selectedCurrencies}
          onSelectedCurrenciesChange={setSelectedCurrencies}
          boardOptions={boardOptions}
          selectedBoards={selectedBoards}
          onSelectedBoardsChange={setSelectedBoards}
          calcModeOptions={calcModeOptions}
          selectedCalcModes={selectedCalcModes}
          onSelectedCalcModesChange={setSelectedCalcModes}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          sortOptions={sortOptions}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          foundCount={foundCount}
          isEmpty={isEmpty}
          showNoFavoritesMessage={showNoFavoritesMessage}
          favoriteIndexes={favoriteIndexes}
          collectionGroups={collectionGroups}
          indexCollectionsMap={indexCollectionsMap}
          favoritesSet={favoritesSet}
          selectedSecid={selectedSecid}
          onSelect={setSelectedSecid}
          onToggleFavorite={toggleFavorite}
          pageIndex={pageIndex}
          pageCount={pageCount}
          pageSize={pageSize}
          onPageIndexChange={setPageIndex}
          onPageSizeChange={setPageSize}
          showPagination={showPagination}
        />
        <IndexChartCard
          selectedIndex={selectedIndex}
          selectedCollections={selectedIndexCollections}
          latestValue={latestValue}
          change={change}
          changePercent={changePercent}
          numberFormatter={numberFormatter}
          historyLoading={historyLoading}
          chartData={chartData}
        />
      </div>
    </div>
  );
}
