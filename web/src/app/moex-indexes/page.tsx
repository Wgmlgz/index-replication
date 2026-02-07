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
    indexesLoading,
    historyLoading,
    error,
    filteredIndexes,
    favoriteIndexes,
    otherIndexes,
    favoritesSet,
    toggleFavorite,
    selectedIndex,
    chartData,
    latestValue,
    change,
    changePercent,
    numberFormatter,
  } = useMoexIndexes();

  return (
    <div className='space-y-6'>
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

      <div className='grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6'>
        <IndexListCard
          query={query}
          onQueryChange={setQuery}
          indexesLoading={indexesLoading}
          showFavoritesOnly={showFavoritesOnly}
          onShowFavoritesOnlyChange={setShowFavoritesOnly}
          filteredIndexes={filteredIndexes}
          favoriteIndexes={favoriteIndexes}
          otherIndexes={otherIndexes}
          favoritesSet={favoritesSet}
          selectedSecid={selectedSecid}
          onSelect={setSelectedSecid}
          onToggleFavorite={toggleFavorite}
        />
        <IndexChartCard
          selectedIndex={selectedIndex}
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
