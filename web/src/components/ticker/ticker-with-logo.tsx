'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TICKER_LOGO_CACHE_MS,
  normalizeTicker,
  resolveTickerLogoUrl,
  tickerLogoQueryKey,
} from '@/lib/ticker-logo';
import { cn } from '@/lib/utils';

type TickerWithLogoProps = {
  ticker?: string | null;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  placeholder?: string;
};

export function TickerWithLogo({
  ticker,
  className,
  iconClassName,
  textClassName,
  placeholder = '-',
}: TickerWithLogoProps) {
  const normalizedTicker = useMemo(
    () => normalizeTicker(ticker ?? ''),
    [ticker],
  );
  const [failedTickers, setFailedTickers] = useState<Record<string, true>>({});
  const isTickerValid = normalizedTicker.length > 0;

  const logoQuery = useQuery({
    queryKey: tickerLogoQueryKey(normalizedTicker),
    queryFn: () => resolveTickerLogoUrl(normalizedTicker),
    enabled: isTickerValid,
    staleTime: TICKER_LOGO_CACHE_MS,
    gcTime: TICKER_LOGO_CACHE_MS,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const logoUrl = failedTickers[normalizedTicker]
    ? null
    : (logoQuery.data ?? null);

  if (!normalizedTicker) {
    return <span className={cn(textClassName)}>{placeholder}</span>;
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <span
        aria-hidden='true'
        className={cn(
          'relative inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-muted',
          iconClassName,
        )}
      >
        <span className='text-[10px] font-semibold uppercase text-muted-foreground leading-none'>
          {normalizedTicker.charAt(0)}
        </span>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=''
            width={20}
            height={20}
            className='absolute inset-0 block size-full object-contain'
            loading='lazy'
            decoding='async'
            referrerPolicy='no-referrer'
            onError={() =>
              setFailedTickers(prev => (
                prev[normalizedTicker]
                  ? prev
                  : { ...prev, [normalizedTicker]: true }
              ))
            }
          />
        ) : null}
      </span>
      <span className={cn('truncate', textClassName)}>{normalizedTicker}</span>
    </span>
  );
}
