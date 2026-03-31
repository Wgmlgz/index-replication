'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { PowerOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MoexIndex } from '@/api-client';
import type { PortfolioReplicationConfig } from '@/app/portfolio/use-portfolio';
import { usePortfolioDetailsContext } from '@/app/portfolio/components/portfolio-details-context';
import { ConfirmActionDialog } from '@/components/confirm-action-dialog';
import { ModeSettingsDialog } from '@/components/mode-settings-dialog';
import { MoexIndexSelectorDialog } from '@/components/moex-indexes/list/moex-index-selector-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { portfolioApi } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/error-utils';
import {
  EMPTY_FORM_STATE,
  REPLICATION_MODE_OPTIONS,
  type ReplicationFormState,
  toFormState,
} from '../replication-settings.types';

type ReplicationSettingsReadonlyProps = {
  portfolioID: number;
  onErrorChange: (error: string) => void;
};

export function ReplicationSettingsReadonly({
  portfolioID,
  onErrorChange,
}: ReplicationSettingsReadonlyProps) {
  const { t, i18n } = useTranslation();
  const { selectedProfile, refreshProfiles } = usePortfolioDetailsContext();
  const [form, setForm] = useState<ReplicationFormState>({ ...EMPTY_FORM_STATE });
  const [working, setWorking] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  useEffect(() => {
    setForm(toFormState(selectedProfile?.replication ?? null));
    onErrorChange('');
  }, [onErrorChange, selectedProfile?.id, selectedProfile?.replication]);

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

  const modeLabel = useMemo(() => {
    const modeKey = form.modeKey || 'full';
    if (REPLICATION_MODE_OPTIONS.includes(modeKey as (typeof REPLICATION_MODE_OPTIONS)[number])) {
      return t(`portfolio.replication.modeOptions.${modeKey}`);
    }
    return modeKey;
  }, [form.modeKey, t]);

  const saveConfig = useCallback(async (nextValues: Partial<ReplicationFormState>) => {
    const nextForm = {
      ...form,
      ...nextValues,
    };
    const modeKey = nextForm.modeKey.trim() || 'full';

    let modeParams: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(nextForm.modeParamsRaw || '{}') as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        onErrorChange(t('portfolio.replication.errors.modeParamsObject'));
        return false;
      }
      modeParams = parsed as Record<string, unknown>;
    } catch {
      onErrorChange(t('portfolio.replication.errors.modeParamsJson'));
      return false;
    }

    const payload = {
      is_enabled: nextForm.isEnabled,
      benchmark_secid: nextForm.benchmarkSecid.trim() || undefined,
      mode_key: modeKey,
      mode_params: modeParams,
    };

    setWorking(true);
    onErrorChange('');
    try {
      const response = await portfolioApi.mePortfoliosIdReplicationPut(portfolioID, payload);
      setForm(toFormState(response.data as PortfolioReplicationConfig));
      await refreshProfiles();
      return true;
    } catch (err) {
      onErrorChange(parseErrorMessage(err, t('portfolio.replication.errors.save')));
      return false;
    } finally {
      setWorking(false);
    }
  }, [form, onErrorChange, parseErrorMessage, portfolioID, refreshProfiles, t]);

  const onSelectBenchmark = useCallback((index: MoexIndex) => {
    if (!index.secid) {
      return;
    }
    void saveConfig({ benchmarkSecid: index.secid });
  }, [saveConfig]);

  return (
    <>
      <div className='grid gap-4'>
        {!form.isEnabled ? (
          <ConfirmActionDialog
            trigger={(
              <Button type='button' disabled={working}>
                {t('portfolio.replication.isEnabledLabel')}
              </Button>
            )}
            title={t('portfolio.replication.toggleConfirmTitle')}
            description={t('portfolio.replication.toggleConfirmEnableDescription')}
            cancelLabel={t('portfolio.replication.modeDialog.cancelButton')}
            actionLabel={t('portfolio.replication.toggleConfirmEnableAction')}
            disabled={working}
            onAction={() => saveConfig({ isEnabled: true })}
          />
        ) : (
          <>
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
                <ConfirmActionDialog
                  trigger={(
                    <Button
                      type='button'
                      variant='ghost'
                      disabled={working || !form.benchmarkSecid}
                    >
                      {t('portfolio.replication.clearBenchmarkButton')}
                    </Button>
                  )}
                  title={t('portfolio.replication.clearBenchmarkConfirmTitle')}
                  description={t('portfolio.replication.clearBenchmarkConfirmDescription')}
                  cancelLabel={t('portfolio.replication.modeDialog.cancelButton')}
                  actionLabel={t('portfolio.replication.clearBenchmarkConfirmAction')}
                  disabled={working}
                  onAction={() => saveConfig({ benchmarkSecid: '' })}
                />
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
              <Label>{t('portfolio.replication.modeKeyLabel')}</Label>
              <div className='rounded-md border bg-muted/35 px-3 py-2 text-sm'>
                {modeLabel}
              </div>
            </div>

            <div className='grid gap-2'>
              <Label>{t('portfolio.replication.modeParamsLabel')}</Label>
              <pre className='max-h-44 overflow-auto rounded-md border bg-muted/35 p-3 text-xs leading-5'>
                {form.modeParamsRaw || '{}'}
              </pre>
              <p className='text-xs text-muted-foreground'>
                {t('portfolio.replication.readonlyHint')}
              </p>
              <div>
                <ModeSettingsDialog
                  trigger={(
                    <Button type='button' variant='outline' disabled={working}>
                      {t('portfolio.replication.editModeButton')}
                    </Button>
                  )}
                  working={working}
                  initialModeKey={form.modeKey}
                  initialModeParamsRaw={form.modeParamsRaw}
                  modeOptions={REPLICATION_MODE_OPTIONS.map(mode => ({
                    value: mode,
                    label: t(`portfolio.replication.modeOptions.${mode}`),
                  }))}
                  title={t('portfolio.replication.modeDialog.title')}
                  description={t('portfolio.replication.modeDialog.description')}
                  modeKeyLabel={t('portfolio.replication.modeKeyLabel')}
                  modeParamsLabel={t('portfolio.replication.modeParamsLabel')}
                  cancelLabel={t('portfolio.replication.modeDialog.cancelButton')}
                  saveLabel={t('portfolio.replication.modeDialog.saveButton')}
                  modeParamsJsonError={t('portfolio.replication.errors.modeParamsJson')}
                  modeParamsObjectError={t('portfolio.replication.errors.modeParamsObject')}
                  onSave={saveConfig}
                />
              </div>
            </div>

            <div className='text-xs text-muted-foreground'>
              {t('portfolio.replication.updatedAtLabel')}: {formattedUpdatedAt}
            </div>
          </>
        )}
      </div>

      {form.isEnabled ? (
        <div className='flex flex-wrap gap-2'>
          <ConfirmActionDialog
            trigger={(
              <Button
                type='button'
                variant='destructive'
                disabled={working}
              >
                <PowerOff className='size-4' />
                {t('portfolio.replication.clearButton')}
              </Button>
            )}
            title={t('portfolio.replication.clearConfigConfirmTitle')}
            description={t('portfolio.replication.clearConfigConfirmDescription')}
            cancelLabel={t('portfolio.replication.modeDialog.cancelButton')}
            actionLabel={t('portfolio.replication.clearConfigConfirmAction')}
            disabled={working}
            onAction={() => saveConfig({ isEnabled: false })}
          />
        </div>
      ) : null}

      {selectorOpen && form.isEnabled ? (
        <MoexIndexSelectorDialog
          open={selectorOpen}
          value={form.benchmarkSecid || null}
          onOpenChange={setSelectorOpen}
          onSelect={onSelectBenchmark}
        />
      ) : null}
    </>
  );
}
