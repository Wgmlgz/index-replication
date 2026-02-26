'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArrowRight, ChartNoAxesCombined, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/components/user-context';
import { Button } from '@/components/ui/button';
import { DEFAULT_AUTHENTICATED_ROUTE } from '@/lib/routes';

type FeatureItem = {
  key: 'indexes' | 'audit' | 'access';
  icon: ComponentType<{ className?: string }>;
};

const features: FeatureItem[] = [
  { key: 'indexes', icon: ChartNoAxesCombined },
  { key: 'audit', icon: Users },
  { key: 'access', icon: ShieldCheck },
];

export default function LandingPage() {
  const { t } = useTranslation();
  const { authState } = useUser();
  const primaryHref =
    authState === 'authenticated' ? DEFAULT_AUTHENTICATED_ROUTE : '/login';
  const primaryLabel =
    authState === 'authenticated'
      ? t('landing.primaryAuthenticated')
      : t('landing.primaryGuest');
  const loginHref = `/login?next=${encodeURIComponent(DEFAULT_AUTHENTICATED_ROUTE)}`;

  return (
    <div className='min-h-svh bg-gradient-to-b from-background via-background to-muted/30'>
      <div className='mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 sm:py-24'>
        <div className='max-w-3xl space-y-6'>
          <p className='text-sm font-medium uppercase tracking-wider text-muted-foreground'>
            {t('landing.kicker')}
          </p>
          <h1 className='text-4xl font-bold leading-tight sm:text-5xl'>
            {t('landing.title')}
          </h1>
          <p className='text-lg text-muted-foreground'>{t('landing.description')}</p>
          <div className='flex flex-wrap gap-3'>
            <Button asChild size='lg'>
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className='ml-2 h-4 w-4' />
              </Link>
            </Button>
            {authState !== 'authenticated' ? (
              <Button asChild size='lg' variant='outline'>
                <Link href={loginHref}>{t('landing.secondaryGuest')}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-3'>
          {features.map(({ key, icon: Icon }) => (
            <div key={key} className='rounded-xl border bg-card p-5 shadow-sm'>
              <Icon className='mb-3 h-5 w-5 text-muted-foreground' />
              <h2 className='mb-2 text-lg font-semibold'>
                {t(`landing.features.${key}.title`)}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {t(`landing.features.${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
