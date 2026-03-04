'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { PORTFOLIO_V2_ROUTES } from '@/lib/portfolio';

export default function PortfolioEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const href = query
      ? `${PORTFOLIO_V2_ROUTES.profiles}?${query}`
      : PORTFOLIO_V2_ROUTES.profiles;

    router.replace(href);
  }, [router, searchParams]);

  return null;
}
