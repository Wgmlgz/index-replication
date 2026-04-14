'use client';

import { useCallback, useState } from 'react';
import { PaginationState, SortingState } from '@tanstack/react-table';
import { User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { auditLogsApi as api } from '@/lib/api';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailsPopup } from '@/components/audit-logs-table/details-popup';
import {
  useAuditLogColumns,
  type AuditLog,
} from '@/components/audit-logs-table/columns';
import type { AuditLogResponse } from '@/api-client';

const fetchUserHistory = async (
  userId: number,
  pagination: PaginationState,
  sorting: SortingState,
  search: string
) => {
  const sort = sorting[0];
  const sortBy = sort?.id ?? 'timestamp';
  const sortDir = (sort?.desc ?? true) ? 'desc' : 'asc';
  const response = await api.auditLogsGet(
    pagination.pageIndex + 1,
    pagination.pageSize,
    search || undefined,
    undefined,
    'user',
    String(userId),
    undefined,
    undefined,
    undefined,
    sortBy,
    sortDir,
  );

  if (response.status === 200 && response.data) {
    const data = response.data;
    return { data: data.logs ?? [], total: data.total ?? 0 };
  }
  return { data: [], total: 0 };
};

export type UserHistoryProps = {
  userId: number;
  userName?: string;
};

export function UserHistory({ userId, userName }: UserHistoryProps) {
  const { t } = useTranslation();
  const columns = useAuditLogColumns();
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchUserHistoryWithId = useCallback(
    async (
      pagination: PaginationState,
      sorting: SortingState,
      search: string
    ) => {
      const result = await fetchUserHistory(userId, pagination, sorting, search);
      return {
        ...result,
        data: result.data.map((auditLog: AuditLogResponse) => ({
          ...auditLog,
          onViewDetails: (log: AuditLog) => {
            setSelectedAuditLog(log);
            setDetailsOpen(true);
          },
        })),
      };
    },
    [userId]
  );

  return (
    <div className='space-y-4'>
      <DetailsPopup
        auditLog={selectedAuditLog}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <User className='h-5 w-5' />
            {t('auditLogs.userHistory.title')}
            {userName && (
              <span className='text-lg font-normal text-muted-foreground'>
                - {userName}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            filterPlaceholder={t('auditLogs.userHistory.searchPlaceholder')}
            columns={columns}
            fetchData={fetchUserHistoryWithId}
            extraTableOptions={{
              initialState: {
                sorting: [{ id: 'timestamp', desc: true }],
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
