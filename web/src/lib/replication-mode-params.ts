import type { RJSFSchema } from '@rjsf/utils';

export type ReplicationModeParamsLabels = {
  lotSize: string;
};

export function normalizeReplicationModeParams(
  modeKey: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (modeKey === 'full') {
    const normalized: Record<string, unknown> = {};
    const lotSizeRaw = value.lot_size;
    const lotSize = typeof lotSizeRaw === 'number'
      ? lotSizeRaw
      : typeof lotSizeRaw === 'string' && lotSizeRaw.trim() !== ''
        ? Number(lotSizeRaw)
        : Number.NaN;
    if (Number.isInteger(lotSize) && lotSize >= 1) {
      normalized.lot_size = lotSize;
    }
    return normalized;
  }

  return {};
}

export function validateReplicationModeParamsShape(
  modeKey: string,
  value: Record<string, unknown>,
): boolean {
  if (modeKey === 'full') {
    const keys = Object.keys(value);
    if (keys.some(key => key !== 'lot_size')) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'lot_size')) {
      return true;
    }
    const lotSize = value.lot_size;
    return typeof lotSize === 'number' && Number.isInteger(lotSize) && lotSize >= 1;
  }

  return Object.keys(value).length === 0;
}

export function getReplicationModeParamsSchema(
  modeKey: string,
  labels: ReplicationModeParamsLabels,
): RJSFSchema {
  if (modeKey === 'full') {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        lot_size: {
          type: 'integer',
          minimum: 1,
          title: labels.lotSize,
        },
      },
    };
  }

  return {
    type: 'object',
    additionalProperties: false,
    properties: {},
  };
}

export function formatReplicationModeParams(
  modeKey: string,
  value: Record<string, unknown>,
  labels: ReplicationModeParamsLabels,
  emptyLabel: string,
): string {
  if (modeKey === 'full') {
    const lotSize = value.lot_size;
    if (typeof lotSize === 'number' && Number.isInteger(lotSize) && lotSize >= 1) {
      return `${labels.lotSize}: ${lotSize}`;
    }
    return emptyLabel;
  }

  return emptyLabel;
}
