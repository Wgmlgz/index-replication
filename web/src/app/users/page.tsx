'use client';

import { useSearchParams } from 'next/navigation';
import { UserTable } from '@/components/users-table/user-table';
import { Card, CardContent } from '@/components/ui/card';
import UserHistoryView from '@/components/users-table/user-history-view';
import { Suspense } from 'react';

function UsersPageContent() {
  const searchParams = useSearchParams();
  const historyUserId = searchParams?.get('history');

  if (historyUserId) {
    return <UserHistoryView userId={historyUserId} />;
  }

  return (
    <Card>
      <CardContent>
        <UserTable />
      </CardContent>
    </Card>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    }>
      <UsersPageContent />
    </Suspense>
  );
}