'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio-v2';

export default function PortfolioV2EntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const href = query
      ? `${PORTFOLIO_V2_ROUTES.overview}?${query}`
      : PORTFOLIO_V2_ROUTES.overview;

    router.replace(href);
  }, [router, searchParams]);

  return null;
}
