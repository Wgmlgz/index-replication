'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '../ui/data-table/data-table-column-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { Time } from '../ui/time';
import {
  actionColors,
  getActionLabel,
  getEntityTypeLabel,
} from '@/lib/logs';
import { AuditLogResponse } from '@/api-client';

export type AuditLog = {
  onViewDetails?: (auditLog: AuditLog) => void;
} & AuditLogResponse;

export function useAuditLogColumns(): ColumnDef<AuditLog>[] {
  const { t } = useTranslation();

  return useMemo<ColumnDef<AuditLog>[]>(
    () => [
      {
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('auditLogs.table.columns.action')}
          />
        ),
        accessorKey: 'action',
        cell: ({ row }) => {
          const action = row.original.action;
          const label = getActionLabel(action);
          const color = actionColors[action] ?? 'bg-slate-100 text-slate-800';

          return <Badge className={color}>{label}</Badge>;
        },
      },
      {
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('auditLogs.table.columns.entity')}
          />
        ),
        accessorKey: 'entity_type',
        cell: ({ row }) => {
          const entityType = row.original.entity_type;
          const entityID = row.original.entity_id;
          const label = entityID
            ? `${getEntityTypeLabel(entityType)}, ${entityID}`
            : getEntityTypeLabel(entityType);
          return <Badge variant='outline'>{label}</Badge>;
        },
      },
      {
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('auditLogs.table.columns.performedBy')}
          />
        ),
        accessorKey: 'performed_by',
        cell: ({ row }) => {
          const performedBy = row.original.performed_by;
          if (!performedBy) {
            return t('auditLogs.common.notAvailableShort');
          }

          return (
            <div className='flex flex-col'>
              <span className='font-medium'>{performedBy.full_name}</span>
              <span className='text-sm text-muted-foreground'>@{performedBy.username}</span>
            </div>
          );
        },
      },
      {
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('auditLogs.table.columns.timestamp')}
          />
        ),
        accessorKey: 'timestamp',
        cell: ({ row }) => <Time time={row.original.timestamp} />,
      },
      {
        id: 'actions',
        header: () => <span></span>,
        cell: ({ row }) => (
          <div className='flex items-center gap-4'>
            <Button
              size='icon'
              variant='ghost'
              onClick={() => row.original.onViewDetails?.(row.original)}
              className='h-8 w-8'
            >
              <Eye className='h-4 w-4' />
              <span className='sr-only'>{t('auditLogs.table.viewDetails')}</span>
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [t]
  );
}
