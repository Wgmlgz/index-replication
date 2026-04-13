'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UserHistory } from '@/components/user-history/user-history';
import { usersApi as api } from '@/lib/api';
import { User } from '@/components/users-table/columns';

interface UserHistoryViewProps {
  userId: string;
}

export default function UserHistoryView({ userId }: UserHistoryViewProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const uid = Number(userId);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!Number.isInteger(uid) || uid <= 0) {
      router.push('/users');
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.usersIdGet(uid);
      if (response.status === 200 && response.data) {
        setUser(response.data);
        return;
      }
      router.push('/users');
    } catch {
      router.push('/users');
    } finally {
      setIsLoading(false);
    }
  }, [router, uid]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  if (isLoading) {
    return (
      <div className='py-6'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold'>{t('auditLogs.userHistoryView.loading')}</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='py-6'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-destructive'>
            {t('auditLogs.userHistoryView.notFoundTitle')}
          </h1>
          <p className='mt-2 text-muted-foreground'>
            {t('auditLogs.userHistoryView.notFoundDescription')}
          </p>
          <Button
            className='mt-4'
            onClick={() => router.push('/users')}
            variant='outline'
          >
            <ArrowLeft className='mr-2' />
            {t('auditLogs.userHistoryView.backToUsers')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6 py-6'>
      <div>
        <div className='flex items-center justify-between gap-3'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold'>{t('auditLogs.userHistoryView.title')}</h1>
            <p className='text-muted-foreground'>
              {user.full_name} ({user.username})
            </p>
            <p className='text-sm text-muted-foreground'>
              {t('auditLogs.userHistoryView.description')}
            </p>
          </div>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => router.back()}
            className='flex items-center gap-2'
          >
            <ArrowLeft className='h-4 w-4' />
            {t('auditLogs.userHistoryView.back')}
          </Button>
        </div>
      </div>
      <UserHistory userId={uid} userName={user.full_name} />
    </div>
  );
}
