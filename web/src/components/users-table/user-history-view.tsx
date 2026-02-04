'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserHistory } from '@/components/user-history/user-history';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { usersApi as api } from '@/lib/api';
import { User } from '@/components/users-table/columns';

interface UserHistoryViewProps {
  userId: string;
}

export default function UserHistoryView({ userId }: UserHistoryViewProps) {
  const router = useRouter();
  const uid = parseInt(userId);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!uid || isNaN(uid)) {
      router.push('/users');
      return;
    }
    fetchUser();
  }, [uid]);

  async function fetchUser() {
    try {
      setIsLoading(true);
      const response = await api.usersGet(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      if (response.status === 200 && response.data.users) {
        const found = response.data.users.find(u => u.id === uid);
        setUser(found || null);
        if (!found) {
          router.push('/users');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className='container mx-auto py-6'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold'>Загрузка...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='container mx-auto py-6'>
        <div className='text-center'>
          <h1 className='text-2xl font-bold text-red-600'>
            Пользователь не найден
          </h1>
          <p className='text-gray-600 mt-2'>
            Предоставленный ID пользователя не существует.
          </p>
          <Button
            className='mt-4'
            onClick={() => router.push('/users')}
            variant='outline'
          >
            <ArrowLeft className='mr-2' />
            Назад к пользователям
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto py-6'>
      <div className='mb-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold'>История пользователя</h1>
            <p className='text-gray-600 mt-2'>
              {user.full_name} ({user.username})
            </p>
            <p className='text-sm text-gray-500'>
              Просмотрите подробную историю действий, выполненных в отношении
              этого пользователя
            </p>
          </div>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => router.back()}
            className='flex items-center gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Назад
          </Button>
        </div>
      </div>
      <UserHistory userId={uid} userName={user.full_name} />
    </div>
  );
}
