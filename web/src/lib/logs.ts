import type { TFunction } from 'i18next';

export type AuditSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

const AUDIT_SEVERITY_COLORS: Record<AuditSeverity, string> = {
  debug: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-100 text-blue-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  critical: 'bg-rose-200 text-rose-900',
};

export const defaultAuditEntityTypes = [
  'user',
  'system',
  'portfolio',
  'tbank',
  'telegram',
  'rebalance',
  'auth',
];

export function formatAuditToken(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

export function normalizeAuditSeverity(severity?: string | null): AuditSeverity {
  switch ((severity ?? '').trim().toLowerCase()) {
    case 'debug':
      return 'debug';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    case 'critical':
      return 'critical';
    default:
      return 'info';
  }
}

export function getSeverityColor(severity?: string | null): string {
  return AUDIT_SEVERITY_COLORS[normalizeAuditSeverity(severity)];
}

export function getActionLabel(action: string, t?: TFunction): string {
  if (t) {
    return t(`auditLogs.actions.${action}`, {
      defaultValue: formatAuditToken(action),
    });
  }
  return formatAuditToken(action);
}

export function getEntityTypeLabel(entityType: string, t?: TFunction): string {
  if (t) {
    return t(`auditLogs.entityTypes.${entityType}`, {
      defaultValue: formatAuditToken(entityType),
    });
  }
  return formatAuditToken(entityType);
}
