'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import JsonView from '@uiw/react-json-view';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { Eye } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Time } from '../ui/time';
import { AuditLogResponse } from '@/api-client';
import {
  getActionLabel,
  getEntityTypeLabel,
  getSeverityColor,
} from '@/lib/logs';

interface DetailsPopupProps {
  auditLog: AuditLogResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetailsPopup({
  auditLog,
  open,
  onOpenChange,
}: DetailsPopupProps) {
  const { t } = useTranslation();

  const details = auditLog?.details ?? null;
  const parsedDetails = useMemo(() => {
    if (!details) {
      return null;
    }
    try {
      return JSON.parse(details) as unknown;
    } catch {
      return null;
    }
  }, [details]);

  const parsedDetailsObject = useMemo(() => {
    if (!parsedDetails || typeof parsedDetails !== 'object') {
      return null;
    }
    return parsedDetails as Record<string, unknown>;
  }, [parsedDetails]);

  const diffStrings = useMemo(() => {
    if (
      !parsedDetails ||
      typeof parsedDetails !== 'object' ||
      !('old' in parsedDetails) ||
      !('new' in parsedDetails)
    ) {
      return null;
    }
    const detailsWithDiff = parsedDetails as { old: unknown; new: unknown };
    return {
      old: JSON.stringify(detailsWithDiff.old, null, 2),
      new: JSON.stringify(detailsWithDiff.new, null, 2),
    };
  }, [parsedDetails]);

  if (!auditLog) {
    return null;
  }

  const action = auditLog.action;
  const label = getActionLabel(action, t);
  const color = getSeverityColor(auditLog.severity);
  const entityTypeLabel = getEntityTypeLabel(auditLog.entity_type, t);
  const entityID = auditLog.entity_id ?? t('auditLogs.common.notAvailableShort');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='!max-w-5xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Eye className='h-5 w-5' />
            {t('auditLogs.details.title')}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div className='space-y-3'>
              <div>
                <label className='text-sm font-medium'>
                  {t('auditLogs.details.action')}
                </label>
                <div className='mt-1'>
                  <Badge className={color}>{label}</Badge>
                </div>
              </div>

              <div>
                <label className='text-sm font-medium'>
                  {t('auditLogs.details.entity')}
                </label>
                <div className='mt-1 text-sm'>
                  {entityTypeLabel}, {entityID}
                </div>
              </div>
            </div>

            <div className='space-y-3'>
              {auditLog.performed_by && (
                <div>
                  <label className='text-sm font-medium'>
                    {t('auditLogs.details.performedBy')}
                  </label>
                  <div className='mt-1'>
                    <div className='text-sm font-medium'>
                      {auditLog.performed_by.full_name}
                    </div>
                    <div className='text-sm text-muted-foreground'>
                      @{auditLog.performed_by.username} (ID: {auditLog.performed_by.id})
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className='text-sm font-medium'>
                  {t('auditLogs.details.timestamp')}
                </label>
                <div>
                  <Time className='inline' time={auditLog.timestamp} />
                </div>
              </div>
            </div>
          </div>

          {diffStrings && (
            <div>
              <label className='mb-2 block text-sm font-medium'>
                {t('auditLogs.details.changes')}
              </label>
              <ReactDiffViewer
                oldValue={diffStrings.old}
                newValue={diffStrings.new}
                splitView={true}
                leftTitle={t('auditLogs.details.previous')}
                rightTitle={t('auditLogs.details.current')}
                showDiffOnly={false}
                styles={{
                  variables: {
                    light: {
                      diffViewerBackground: '#f8fafc',
                      addedBackground: '#e6ffed',
                      removedBackground: '#ffeef0',
                      wordAddedBackground: '#acf2bd',
                      wordRemovedBackground: '#fdb8c0',
                    },
                  },
                }}
              />
            </div>
          )}

          {!diffStrings && parsedDetailsObject && (
            <div>
              <label className='mb-2 block text-sm font-medium'>
                {t('auditLogs.details.changes')}
              </label>
              <JsonView value={parsedDetailsObject} title={t('auditLogs.details.rawJson')} />
            </div>
          )}

          {!parsedDetails && auditLog.details && (
            <div>
              <label className='mb-2 block text-sm font-medium'>
                {t('auditLogs.details.rawData')}
              </label>
              <div className='rounded-lg border bg-muted p-3'>
                <pre className='whitespace-pre-wrap break-all text-sm'>
                  {auditLog.details}
                </pre>
              </div>
            </div>
          )}

          {!auditLog.details && (
            <div className='py-8 text-center text-muted-foreground'>
              {t('auditLogs.details.noDetails')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
