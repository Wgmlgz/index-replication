'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  normalizeTicker,
  resolveTickerLogoUrl,
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
  const [resolved, setResolved] = useState<{ ticker: string; url: string | null }>({
    ticker: '',
    url: null,
  });

  useEffect(() => {
    if (!normalizedTicker) return;

    let cancelled = false;
    void resolveTickerLogoUrl(normalizedTicker).then(url => {
      if (cancelled) return;
      setResolved({ ticker: normalizedTicker, url });
    });

    return () => {
      cancelled = true;
    };
  }, [normalizedTicker]);

  const logoUrl = resolved.ticker === normalizedTicker ? resolved.url : null;

  if (!normalizedTicker) {
    return <span className={cn(textClassName)}>{placeholder}</span>;
  }

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=''
          aria-hidden='true'
          className={cn(
            'size-5 shrink-0 rounded-[4px] bg-background object-contain',
            iconClassName,
          )}
          loading='lazy'
          decoding='async'
          referrerPolicy='no-referrer'
          onError={() => setResolved({ ticker: normalizedTicker, url: null })}
        />
      ) : (
        <span
          aria-hidden='true'
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-muted text-[10px] font-semibold uppercase text-muted-foreground',
            iconClassName,
          )}
        >
          {normalizedTicker.charAt(0)}
        </span>
      )}
      <span className={cn('truncate', textClassName)}>{normalizedTicker}</span>
    </span>
  );
}
