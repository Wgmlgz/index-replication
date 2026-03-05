'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import type { MoexIndex } from '@/api-client';
import type { NormalizedPortfolioProfile, PortfolioReplicationConfig } from '@/app/portfolio/use-portfolio';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { MoexIndexSelectorDialog } from '@/components/moex-indexes/list/moex-index-selector-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { getApiUrl, axiosClient } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';

type PortfolioReplicationPanelProps = {
  portfolioID: number | null;
  profile: NormalizedPortfolioProfile | null;
  refreshProfiles: () => Promise<void>;
};

type ReplicationFormState = {
  isEnabled: boolean;
  benchmarkSecid: string;
  modeKey: string;
  modeParamsRaw: string;
  updatedAt: string;
};

const EMPTY_FORM_STATE: ReplicationFormState = {
  isEnabled: false,
  benchmarkSecid: '',
  modeKey: 'full',
  modeParamsRaw: '{}',
  updatedAt: '',
};

const REPLICATION_MODE_OPTIONS = ['full', 'sampled'] as const;

function toFormState(config: PortfolioReplicationConfig | null): ReplicationFormState {
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

export function PortfolioReplicationPanel({
  portfolioID,
  profile,
  refreshProfiles,
}: PortfolioReplicationPanelProps) {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState<ReplicationFormState>({ ...EMPTY_FORM_STATE });
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    setForm(toFormState(profile?.replication ?? null));
    setError('');
  }, [profile?.id, profile?.replication]);

  const parseErrorMessage = useCallback((err: unknown, fallback: string) => {
    if (axios.isAxiosError(err)) {
      const apiError = getApiErrorMessage(err.response?.data as unknown);
      if (apiError) {
        return apiError;
      }
    }

    return fallback;
  }, []);

  const formattedUpdatedAt = useMemo(() => {
    if (!form.updatedAt) {
      return t('portfolio.replication.updatedAtEmpty');
    }

    const date = new Date(form.updatedAt);
    if (Number.isNaN(date.getTime())) {
      return t('portfolio.replication.updatedAtEmpty');
    }

    return new Intl.DateTimeFormat(i18n.language || 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }, [form.updatedAt, i18n.language, t]);

  const onSave = useCallback(async () => {
    if (!portfolioID) {
      return;
    }

    const modeKey = form.modeKey.trim() || 'full';

    let modeParams: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(form.modeParamsRaw || '{}') as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        setError(t('portfolio.replication.errors.modeParamsObject'));
        return;
      }
      modeParams = parsed as Record<string, unknown>;
    } catch {
      setError(t('portfolio.replication.errors.modeParamsJson'));
      return;
    }

    const payload = {
      is_enabled: form.isEnabled,
      benchmark_secid: form.benchmarkSecid.trim() || null,
      mode_key: modeKey,
      mode_params: modeParams,
    };

    setWorking(true);
    setError('');
    try {
      const response = await axiosClient.put(
        `${getApiUrl()}/me/portfolios/${portfolioID}/replication`,
        payload,
      );
      const data = response.data as PortfolioReplicationConfig;
      setForm(toFormState(data));
      await refreshProfiles();
    } catch (err) {
      setError(parseErrorMessage(err, t('portfolio.replication.errors.save')));
    } finally {
      setWorking(false);
    }
  }, [form, parseErrorMessage, portfolioID, refreshProfiles, t]);

  const onClear = useCallback(async () => {
    if (!portfolioID) {
      return;
    }

    setWorking(true);
    setError('');
    try {
      await axiosClient.delete(`${getApiUrl()}/me/portfolios/${portfolioID}/replication`);
      setForm({ ...EMPTY_FORM_STATE });
      await refreshProfiles();
    } catch (err) {
      setError(parseErrorMessage(err, t('portfolio.replication.errors.clear')));
    } finally {
      setWorking(false);
    }
  }, [parseErrorMessage, portfolioID, refreshProfiles, t]);

  const onSelectBenchmark = useCallback((index: MoexIndex) => {
    setForm(prev => ({
      ...prev,
      benchmarkSecid: index.secid ?? '',
    }));
  }, []);

  if (!portfolioID) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('portfolio.replication.title')}</CardTitle>
          <CardDescription>{t('portfolio.replication.description')}</CardDescription>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground'>
          {t('portfolio.replication.selectPrompt')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='h-full min-h-0 overflow-hidden'>
      <CardHeader>
        <CardTitle>{t('portfolio.replication.title')}</CardTitle>
        <CardDescription>{t('portfolio.replication.description')}</CardDescription>
      </CardHeader>

      <CardContent className='flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-sm'>
        {error ? (
          <Alert variant='destructive'>
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className='grid gap-4 rounded-md border p-4'>
          <div className='flex items-center justify-between gap-3'>
            <Label htmlFor='portfolio-replication-enabled'>
              {t('portfolio.replication.isEnabledLabel')}
            </Label>
            <Switch
              id='portfolio-replication-enabled'
              checked={form.isEnabled}
              onCheckedChange={checked => setForm(prev => ({ ...prev, isEnabled: checked }))}
              disabled={working}
            />
          </div>

          <div className='grid gap-2'>
            <Label>
              {t('portfolio.replication.benchmarkLabel')}
            </Label>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => setSelectorOpen(true)}
                disabled={working}
              >
                {form.benchmarkSecid
                  ? t('portfolio.replication.changeBenchmarkButton')
                  : t('portfolio.replication.selectBenchmarkButton')}
              </Button>
              <Button
                type='button'
                variant='ghost'
                onClick={() => setForm(prev => ({ ...prev, benchmarkSecid: '' }))}
                disabled={working || !form.benchmarkSecid}
              >
                {t('portfolio.replication.clearBenchmarkButton')}
              </Button>
            </div>
            <div className='text-xs text-muted-foreground'>
              {form.benchmarkSecid
                ? t('portfolio.replication.selectedBenchmarkValue', {
                    secid: form.benchmarkSecid,
                  })
                : t('portfolio.replication.selectedBenchmarkEmpty')}
            </div>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='portfolio-replication-mode'>
              {t('portfolio.replication.modeKeyLabel')}
            </Label>
            <Select
              value={form.modeKey || 'full'}
              onValueChange={value => setForm(prev => ({ ...prev, modeKey: value }))}
              disabled={working}
            >
              <SelectTrigger id='portfolio-replication-mode'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPLICATION_MODE_OPTIONS.map(mode => (
                  <SelectItem key={mode} value={mode}>
                    {t(`portfolio.replication.modeOptions.${mode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='portfolio-replication-mode-params'>
              {t('portfolio.replication.modeParamsLabel')}
            </Label>
            <Textarea
              id='portfolio-replication-mode-params'
              value={form.modeParamsRaw}
              onChange={event => setForm(prev => ({ ...prev, modeParamsRaw: event.target.value }))}
              placeholder='{}'
              rows={6}
              disabled={working}
            />
          </div>

          <div className='text-xs text-muted-foreground'>
            {t('portfolio.replication.updatedAtLabel')}: {formattedUpdatedAt}
          </div>
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button type='button' onClick={() => void onSave()} disabled={working}>
            {t('portfolio.replication.saveButton')}
          </Button>
          <Button type='button' variant='outline' onClick={() => void onClear()} disabled={working}>
            {t('portfolio.replication.clearButton')}
          </Button>
        </div>
      </CardContent>

      {selectorOpen ? (
        <MoexIndexSelectorDialog
          open={selectorOpen}
          value={form.benchmarkSecid || null}
          onOpenChange={setSelectorOpen}
          onSelect={onSelectBenchmark}
        />
      ) : null}
    </Card>
  );
}
