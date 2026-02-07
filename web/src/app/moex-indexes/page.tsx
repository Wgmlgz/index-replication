'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IndexChartCard } from '@/components/moex-indexes/index-chart-card';
import { IndexListCard } from '@/components/moex-indexes/index-list-card';
import {
  MoexIndexesProvider,
  useMoexIndexesContext,
} from '@/components/moex-indexes/moex-indexes-context';

function MoexIndexesContent() {
  const { error } = useMoexIndexesContext();

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
        <IndexListCard />
        <IndexChartCard />
      </div>
    </div>
  );
}

export default function MoexIndexesPage() {
  return (
    <MoexIndexesProvider>
      <MoexIndexesContent />
    </MoexIndexesProvider>
  );
}
