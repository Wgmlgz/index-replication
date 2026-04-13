'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PaginationState, SortingState } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Download, Filter, X } from 'lucide-react';

import { AuditLogResponse } from '@/api-client';
import { auditLogsApi as api } from '@/lib/api';
import { downloadTextFile } from '@/lib/utils';
import {
  actionLabels,
  entityTypeLabels,
  getActionLabel,
  getEntityTypeLabel,
} from '@/lib/logs';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DataTable } from '@/components/ui/data-table/data-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserTable } from '@/components/users-table/user-table';
import { type User } from '@/components/users-table/columns';

import { useAuditLogColumns, type AuditLog } from './columns';
import { DetailsPopup } from './details-popup';

const ALL_FILTER_VALUE = '__all__';

type AuditLogFilters = {
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  startDate: string;
  endDate: string;
};

const defaultFilters: AuditLogFilters = {
  action: ALL_FILTER_VALUE,
  entityType: ALL_FILTER_VALUE,
  entityId: '',
  performedBy: '',
  startDate: '',
  endDate: '',
};

type AuditLogFilterOptions = {
  actions: string[];
  entityTypes: string[];
};

function normalizeFilterOptions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

async function fetchAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  const response = await api.auditLogsActionsGet();
  const payload = response.data as { actions?: unknown; entity_types?: unknown };
  return {
    actions: normalizeFilterOptions(payload.actions),
    entityTypes: normalizeFilterOptions(payload.entity_types),
  };
}

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const fetchAuditLogs = async (
  pagination: PaginationState,
  sorting: SortingState,
  search: string,
  filters: AuditLogFilters
) => {
  const sort = sorting[0];
  const response = await api.auditLogsGet(
    pagination.pageIndex + 1,
    pagination.pageSize,
    search || undefined,
    filters.action === ALL_FILTER_VALUE ? undefined : filters.action,
    filters.entityType === ALL_FILTER_VALUE ? undefined : filters.entityType,
    filters.entityId || undefined,
    filters.performedBy ? Number(filters.performedBy) : undefined,
    filters.startDate || undefined,
    filters.endDate || undefined,
    {
      params: {
        sort_by: sort?.id,
        sort_dir: sort?.desc ? 'desc' : 'asc',
      },
    }
  );

  if (response.status === 200 && response.data) {
    const data = response.data;
    return { data: data.logs ?? [], total: data.total ?? 0 };
  }

  return { data: [], total: 0 };
};

function UserFilterInput({
  value,
  onChange,
}: {
  value?: string;
  onChange: (user: User | null) => void;
}) {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <div className='flex w-full items-center gap-2'>
      <Input
        readOnly
        placeholder={t('auditLogs.filters.user.notSelected')}
        value={
          value && selectedUser
            ? `${selectedUser.full_name} (${selectedUser.username})`
            : ''
        }
      />
      <Dialog>
        <DialogTrigger asChild>
          <Button type='button' variant='outline'>
            {t('auditLogs.filters.user.selectButton')}
          </Button>
        </DialogTrigger>
        <DialogContent className='!max-w-6xl'>
          <DialogHeader>
            <DialogTitle>{t('auditLogs.filters.user.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? t('auditLogs.filters.user.selected', {
                    fullName: selectedUser.full_name,
                    username: selectedUser.username,
                  })
                : t('auditLogs.filters.user.dialogDescription')}
            </DialogDescription>
          </DialogHeader>
          <UserTable
            mode='select'
            onSelectionChange={user => {
              setSelectedUser(user);
              onChange(user);
            }}
            initialSelectedId={value ? Number(value) : undefined}
          />
        </DialogContent>
      </Dialog>
      {value && (
        <Button
          type='button'
          size='icon'
          variant='ghost'
          onClick={() => {
            setSelectedUser(null);
            onChange(null);
          }}
          aria-label={t('auditLogs.filters.user.clearButton')}
        >
          <X className='size-4' />
        </Button>
      )}
    </div>
  );
}

export function AuditLogsTable() {
  const { t } = useTranslation();
  const columns = useAuditLogColumns();
  const [filters, setFilters] = useState<AuditLogFilters>(defaultFilters);
  const [filterKey, setFilterKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [displayLogs, setDisplayLogs] = useState<AuditLogResponse[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filterOptionsQuery = useQuery({
    queryKey: ['audit-logs-filter-options'],
    queryFn: fetchAuditLogFilterOptions,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const actionFilterValues = useMemo(
    () =>
      uniqueSorted([
        ...Object.keys(actionLabels),
        ...(filterOptionsQuery.data?.actions ?? []),
      ]),
    [filterOptionsQuery.data?.actions]
  );
  const entityTypeFilterValues = useMemo(
    () =>
      uniqueSorted([
        ...Object.keys(entityTypeLabels),
        ...(filterOptionsQuery.data?.entityTypes ?? []),
      ]),
    [filterOptionsQuery.data?.entityTypes]
  );

  const fetchAuditLogsWithFilters = useCallback(
    async (
      pagination: PaginationState,
      sorting: SortingState,
      search: string
    ) => {
      const result = await fetchAuditLogs(pagination, sorting, search, filters);
      setDisplayLogs(result.data);
      const mappedLogs: AuditLog[] = result.data.map(auditLog => ({
        ...auditLog,
        onViewDetails: (log: AuditLog) => {
          setSelectedAuditLog(log);
          setDetailsOpen(true);
        },
      }));
      return {
        ...result,
        data: mappedLogs,
      };
    },
    [filters]
  );

  const hasActiveFilters =
    filters.action !== ALL_FILTER_VALUE ||
    filters.entityType !== ALL_FILTER_VALUE ||
    filters.entityId !== '' ||
    filters.performedBy !== '' ||
    filters.startDate !== '' ||
    filters.endDate !== '';

  const clearFilters = () => {
    setFilters(defaultFilters);
    setFilterKey(key => key + 1);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilterKey(k => k + 1);
  };

  const downloadLogs = () => {
    downloadTextFile('audit-logs.json', JSON.stringify(displayLogs, null, 2));
  };

  return (
    <div className='space-y-4'>
      <DetailsPopup
        auditLog={selectedAuditLog}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <Card>
        <CardHeader>
          <div className='flex items-center justify-between gap-3'>
            <CardTitle className='flex items-center gap-2'>
              <Filter className='h-5 w-5' />
              {t('auditLogs.filters.title')}
            </CardTitle>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowFilters(current => !current)}
              >
                {showFilters
                  ? t('auditLogs.filters.hideButton')
                  : t('auditLogs.filters.showButton')}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={clearFilters}
                  className='flex items-center gap-1'
                >
                  <X className='h-4 w-4' />
                  {t('auditLogs.filters.clearButton')}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent>
            <form
              className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'
              onSubmit={handleSubmit}
            >
              <div className='space-y-2'>
                <Label htmlFor='action-filter'>{t('auditLogs.filters.action')}</Label>
                <Select
                  value={filters.action}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, action: value }))
                  }
                >
                  <SelectTrigger id='action-filter'>
                    <SelectValue placeholder={t('auditLogs.filters.allActions')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>
                      {t('auditLogs.filters.allActions')}
                    </SelectItem>
                    {actionFilterValues.map(action => (
                      <SelectItem key={action} value={action}>
                        <Badge className='font-normal'>
                          {getActionLabel(action)}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='entity-type-filter'>{t('auditLogs.filters.entityType')}</Label>
                <Select
                  value={filters.entityType}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, entityType: value }))
                  }
                >
                  <SelectTrigger id='entity-type-filter'>
                    <SelectValue placeholder={t('auditLogs.filters.allEntityTypes')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>
                      {t('auditLogs.filters.allEntityTypes')}
                    </SelectItem>
                    {entityTypeFilterValues.map(type => (
                      <SelectItem key={type} value={type}>
                        {getEntityTypeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-2'>
                <Label htmlFor='entity-id'>{t('auditLogs.filters.entityId')}</Label>
                <Input
                  id='entity-id'
                  name='entityId'
                  type='text'
                  value={filters.entityId}
                  onChange={handleFilterChange}
                  placeholder={t('auditLogs.filters.entityIdPlaceholder')}
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='performed-by'>{t('auditLogs.filters.user.label')}</Label>
                <UserFilterInput
                  value={filters.performedBy}
                  onChange={user =>
                    setFilters(prev => ({
                      ...prev,
                      performedBy: user ? String(user.id) : '',
                    }))
                  }
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='start-date'>{t('auditLogs.filters.startDate')}</Label>
                <DatePicker
                  id='start-date'
                  value={filters.startDate}
                  placeholder='YYYY-MM-DD'
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, startDate: value }))
                  }
                />
              </div>

              <div className='space-y-2'>
                <Label htmlFor='end-date'>{t('auditLogs.filters.endDate')}</Label>
                <DatePicker
                  id='end-date'
                  value={filters.endDate}
                  placeholder='YYYY-MM-DD'
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, endDate: value }))
                  }
                />
              </div>

              <div className='col-span-full mt-2 flex justify-end'>
                <Button type='submit' variant='default'>
                  {t('auditLogs.filters.applyButton')}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      <DataTable
        filterPlaceholder={t('auditLogs.table.searchPlaceholder')}
        columns={columns}
        fetchData={fetchAuditLogsWithFilters}
        refetchKey={filterKey}
        extraTableOptions={{
          initialState: {
            sorting: [{ id: 'timestamp', desc: true }],
          },
        }}
        extraHeader={
          <Button onClick={downloadLogs}>
            <Download className='size-4' />
            {t('auditLogs.table.exportButton')}
          </Button>
        }
      />
    </div>
  );
}
