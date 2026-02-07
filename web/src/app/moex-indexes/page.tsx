'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  createChart,
  ColorType,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
} from 'lightweight-charts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  moexClient,
  type MoexIndex,
} from '@/lib/moex-client';
import {
  userSettingsClient,
  type UserSettings,
} from '@/lib/user-settings-client';


const CHART_HEIGHT = 360;

type ChartPoint = LineData;

function IndexChart({ data }: { data: ChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: CHART_HEIGHT,
      layout: {
        textColor: '#64748b',
        background: { type: ColorType.Solid, color: 'transparent' },
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.2)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(148, 163, 184, 0.5)' },
        horzLine: { color: 'rgba(148, 163, 184, 0.5)' },
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: '#2563eb',
      lineWidth: 2,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
        height: CHART_HEIGHT,
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    seriesRef.current.setData(data);
    if (data.length > 0) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data]);

  return <div ref={containerRef} className="w-full" style={{ height: CHART_HEIGHT }} />;
}

const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

export default function MoexIndexesPage() {
  const [query, setQuery] = useState('');
  const [selectedSecid, setSelectedSecid] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const queryClient = useQueryClient();

  const dateRange = useMemo(() => {
    const today = new Date();
    return {
      from: formatDate(subDays(today, 365)),
      till: formatDate(today),
    };
  }, []);

  const indexesQuery = useQuery({
    queryKey: ['moex-indexes'],
    queryFn: () => moexClient.getIndexes(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const indexes = indexesQuery.data ?? [];

  const settingsQuery = useQuery({
    queryKey: ['user-settings'],
    queryFn: () => userSettingsClient.getSettings(),
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const favorites = settingsQuery.data?.favorites ?? [];
  const favoritesSet = useMemo(
    () => new Set(favorites.map((item) => item.toUpperCase())),
    [favorites]
  );

  const updateFavorites = useMutation({
    mutationFn: (nextFavorites: string[]) =>
      userSettingsClient.patchSettings({ favorites: nextFavorites }),
    onMutate: async (nextFavorites: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['user-settings'] });
      const previous = queryClient.getQueryData<UserSettings>(['user-settings']);
      queryClient.setQueryData<UserSettings>(['user-settings'], (current) => ({
        favorites: nextFavorites,
        values: current?.values ?? previous?.values,
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['user-settings'], context.previous);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user-settings'], data);
    },
  });

  const selectedIndex = useMemo<MoexIndex | null>(() => {
    if (indexes.length === 0) return null;
    if (selectedSecid) {
      return (
        indexes.find(
          (item) => item.secid.toUpperCase() === selectedSecid.toUpperCase()
        ) ?? null
      );
    }
    const favoriteMatch = favorites.find((secid) =>
      indexes.some(
        (index) => index.secid.toUpperCase() === secid.toUpperCase()
      )
    );
    if (favoriteMatch) {
      return (
        indexes.find(
          (item) =>
            item.secid.toUpperCase() === favoriteMatch.toUpperCase()
        ) ?? null
      );
    }
    return indexes.find((item) => item.secid === 'IMOEX') ?? indexes[0] ?? null;
  }, [indexes, selectedSecid, favorites]);

  const historyQuery = useQuery({
    queryKey: ['moex-index-history', selectedIndex?.secid, dateRange.from, dateRange.till],
    queryFn: () =>
      moexClient.getIndexHistory(selectedIndex!.secid, {
        from: dateRange.from,
        till: dateRange.till,
      }),
    enabled: Boolean(selectedIndex?.secid),
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const history = historyQuery.data ?? [];
  const indexesLoading = indexesQuery.isLoading;
  const historyLoading = historyQuery.isLoading;
  const error = indexesQuery.error
    ? 'Не удалось загрузить список индексов.'
    : historyQuery.error
      ? 'Не удалось загрузить историю индекса.'
      : settingsQuery.error
        ? 'Не удалось загрузить пользовательские настройки.'
      : null;

  const filteredIndexes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return indexes;
    return indexes.filter((index) => {
      const haystack = `${index.secid} ${index.shortName} ${index.name}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [indexes, query]);

  const favoriteIndexes = useMemo(
    () =>
      filteredIndexes.filter((index) =>
        favoritesSet.has(index.secid.toUpperCase())
      ),
    [filteredIndexes, favoritesSet]
  );

  const otherIndexes = useMemo(
    () =>
      filteredIndexes.filter(
        (index) => !favoritesSet.has(index.secid.toUpperCase())
      ),
    [filteredIndexes, favoritesSet]
  );

  const toggleFavorite = (secid: string) => {
    const key = secid.toUpperCase();
    const isFavorite = favoritesSet.has(key);
    const nextFavorites = isFavorite
      ? favorites.filter((item) => item.toUpperCase() !== key)
      : [...favorites, secid];
    updateFavorites.mutate(nextFavorites);
  };

  const normalizedHistory = useMemo(() => {
    return history
      .filter((point) => point.tradeDate && point.close !== null)
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
  }, [history]);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      normalizedHistory.map((point) => ({
        time: point.tradeDate,
        value: point.close as number,
      })),
    [normalizedHistory]
  );

  const latestPoint = normalizedHistory[normalizedHistory.length - 1];
  const previousPoint = normalizedHistory[normalizedHistory.length - 2];
  const latestValue = latestPoint?.close ?? null;
  const previousValue = previousPoint?.close ?? null;
  const change =
    latestValue !== null && previousValue !== null ? latestValue - previousValue : null;
  const changePercent =
    change !== null && previousValue
      ? (change / previousValue) * 100
      : null;

  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: selectedIndex?.decimals ?? 2,
    });
  }, [selectedIndex?.decimals]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Индексы MOEX</h1>
        <p className="text-muted-foreground mt-2">
          Выберите индекс, чтобы посмотреть динамику за последние 12 месяцев.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Ошибка</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Список индексов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию или коду"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {indexesLoading
                  ? 'Загрузка списка...'
                  : `Найдено: ${showFavoritesOnly ? favoriteIndexes.length : filteredIndexes.length}`}
              </span>
              <label className="flex items-center gap-2">
                <span>Только избранное</span>
                <Switch
                  checked={showFavoritesOnly}
                  onCheckedChange={setShowFavoritesOnly}
                />
              </label>
            </div>
            <ScrollArea className="h-[420px] pr-3">
              <div className="space-y-4">
                {favoriteIndexes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Избранное
                    </div>
                    <div className="space-y-2">
                      {favoriteIndexes.map((index) => {
                        const isActive = index.secid === selectedIndex?.secid;
                        const isFavorite = favoritesSet.has(
                          index.secid.toUpperCase()
                        );
                        return (
                          <div
                            key={index.secid}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedSecid(index.secid)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                setSelectedSecid(index.secid);
                              }
                            }}
                            className={`w-full rounded-md border px-3 py-2 text-left transition ${
                              isActive
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {index.shortName || index.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {index.secid} · {index.name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(index.secid);
                                }}
                                className="rounded-full p-1 text-muted-foreground transition hover:text-amber-500"
                                title="В избранное"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    isFavorite ? 'fill-amber-400 text-amber-500' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!showFavoritesOnly && (
                  <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Все индексы
                    </div>
                    <div className="space-y-2">
                      {otherIndexes.map((index) => {
                        const isActive = index.secid === selectedIndex?.secid;
                        const isFavorite = favoritesSet.has(
                          index.secid.toUpperCase()
                        );
                        return (
                          <div
                            key={index.secid}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedSecid(index.secid)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                setSelectedSecid(index.secid);
                              }
                            }}
                            className={`w-full rounded-md border px-3 py-2 text-left transition ${
                              isActive
                                ? 'border-primary/60 bg-primary/10'
                                : 'border-border hover:bg-muted'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-medium">
                                  {index.shortName || index.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {index.secid} · {index.name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleFavorite(index.secid);
                                }}
                                className="rounded-full p-1 text-muted-foreground transition hover:text-amber-500"
                                title="В избранное"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    isFavorite ? 'fill-amber-400 text-amber-500' : ''
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!indexesLoading &&
                  filteredIndexes.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Ничего не найдено.
                    </div>
                  )}
                {!indexesLoading &&
                  showFavoritesOnly &&
                  filteredIndexes.length > 0 &&
                  favoriteIndexes.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      Нет избранных индексов по вашему запросу.
                    </div>
                  )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>График</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedIndex && (
              <div className="space-y-1">
                <div className="text-lg font-semibold">
                  {selectedIndex.name} ({selectedIndex.secid})
                </div>
                <div className="text-sm text-muted-foreground">
                  Период: последние 12 месяцев · Валюта:{' '}
                  {selectedIndex.currency ?? '—'}
                </div>
                {latestValue !== null && (
                  <div className="text-sm">
                    <span className="font-medium">
                      {numberFormatter.format(latestValue)}
                    </span>
                    {selectedIndex.currency ? ` ${selectedIndex.currency}` : ''}
                    {change !== null && changePercent !== null && (
                      <span
                        className={`ml-2 text-sm font-medium ${
                          change > 0 ? 'text-emerald-600' : change < 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}
                      >
                        {change > 0 ? '+' : ''}
                        {numberFormatter.format(change)} (
                        {change > 0 ? '+' : ''}
                        {changePercent.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {historyLoading && (
              <div className="text-sm text-muted-foreground">Загрузка графика...</div>
            )}
            {!historyLoading && chartData.length === 0 && (
              <div className="text-sm text-muted-foreground">Нет данных для отображения.</div>
            )}
            {!historyLoading && chartData.length > 0 && (
              <IndexChart data={chartData} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
