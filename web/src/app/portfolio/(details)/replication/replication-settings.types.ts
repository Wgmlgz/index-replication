import type { PortfolioReplicationConfig } from '@/app/portfolio/use-portfolio';

export type ReplicationFormState = {
  isEnabled: boolean;
  benchmarkSecid: string;
  modeKey: string;
  modeParamsRaw: string;
  updatedAt: string;
};

export const EMPTY_FORM_STATE: ReplicationFormState = {
  isEnabled: false,
  benchmarkSecid: '',
  modeKey: 'full',
  modeParamsRaw: '{}',
  updatedAt: '',
};

export const REPLICATION_MODE_OPTIONS = ['full'] as const;

export function toFormState(config: PortfolioReplicationConfig | null): ReplicationFormState {
  if (!config) {
    return { ...EMPTY_FORM_STATE };
  }

  return {
    isEnabled: config.is_enabled,
    benchmarkSecid: config.benchmark_secid ?? '',
    modeKey: config.mode_key || 'full',
    modeParamsRaw: JSON.stringify(config.mode_params ?? {}, null, 2),
    updatedAt: config.updated_at || '',
  };
}
