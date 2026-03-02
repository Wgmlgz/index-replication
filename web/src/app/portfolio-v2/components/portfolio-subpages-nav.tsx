'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  buildPortfolioHref,
  PORTFOLIO_V2_ROUTES,
} from '@/lib/portfolio-v2';

type PortfolioSubpagesNavProps = {
  portfolioID: number | null;
};

const SUBPAGE_ITEMS = [
  {
    key: 'overview',
    href: PORTFOLIO_V2_ROUTES.overview,
    labelKey: 'portfolioV2.subpages.overview',
  },
  {
    key: 'analytics',
    href: PORTFOLIO_V2_ROUTES.analytics,
    labelKey: 'portfolioV2.subpages.analytics',
  },
  {
    key: 'operations',
    href: PORTFOLIO_V2_ROUTES.operations,
    labelKey: 'portfolioV2.subpages.operations',
  },
  {
    key: 'profiles',
    href: PORTFOLIO_V2_ROUTES.profiles,
    labelKey: 'portfolioV2.subpages.profiles',
  },
] as const;

export function PortfolioSubpagesNav({ portfolioID }: PortfolioSubpagesNavProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className='flex flex-wrap gap-2'>
      {SUBPAGE_ITEMS.map(item => (
        <Button
          key={item.key}
          asChild
          variant={pathname === item.href ? 'default' : 'outline'}
          size='sm'
        >
          <Link href={buildPortfolioHref(item.href, portfolioID)}>{t(item.labelKey)}</Link>
        </Button>
      ))}
    </div>
  );
}
