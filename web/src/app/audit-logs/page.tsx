'use client';

import { useTranslation } from 'react-i18next';

import { AuditLogsTable } from '@/components/audit-logs-table/audit-logs-table';
import { useUser } from '@/components/user-context';

export default function AuditLogsPage() {
  const { t } = useTranslation();
  const { loading, hasPermission } = useUser();

  if (loading) {
    return <div>{t('common.loading')}</div>;
  }

  if (!hasPermission('audit_logs:view')) {
    return (
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('auditLogs.page.title')}</h1>
        <p className='text-muted-foreground'>
          {t('auditLogs.page.notAuthorized')}
        </p>
      </div>
    );
  }

  return (
    <div className='flex h-[calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-64px)] min-h-0 w-full flex-col gap-6 overflow-hidden'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('auditLogs.page.title')}</h1>
        <p className='text-muted-foreground'>
          {t('auditLogs.page.description')}
        </p>
      </div>
      <div className='grow relative'>
        <div className='absolute inset-0'>
          <AuditLogsTable />
        </div>
      </div>
    </div>
  );
}
