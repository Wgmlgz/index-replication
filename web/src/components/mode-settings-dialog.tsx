'use client';

import type { IChangeEvent } from '@rjsf/core';
import Form from '@rjsf/shadcn';
import type { RJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { type ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getReplicationModeParamsSchema,
  normalizeReplicationModeParams,
  validateReplicationModeParamsShape,
} from '@/lib/replication-mode-params';

export type ModeSettingsDialogOption = {
  value: string;
  label: string;
};

type ModeSettingsDialogProps = {
  trigger: ReactNode;
  working: boolean;
  initialModeKey: string;
  initialModeParamsRaw: string;
  modeOptions: ModeSettingsDialogOption[];
  title: string;
  description: string;
  modeKeyLabel: string;
  modeParamsLabel: string;
  cancelLabel: string;
  saveLabel: string;
  modeParamsJsonError: string;
  modeParamsObjectError: string;
  onSave: (next: { modeKey: string; modeParamsRaw: string }) => Promise<boolean> | boolean;
};

export function ModeSettingsDialog({
  trigger,
  working,
  initialModeKey,
  initialModeParamsRaw,
  modeOptions,
  title,
  description,
  modeKeyLabel,
  modeParamsLabel,
  cancelLabel,
  saveLabel,
  modeParamsJsonError,
  modeParamsObjectError,
  onSave,
}: ModeSettingsDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [modeDraftKey, setModeDraftKey] = useState<string>('full');
  const [modeDraftParams, setModeDraftParams] = useState<Record<string, unknown>>({});
  const [modeDraftError, setModeDraftError] = useState('');
  const modeParamsSchema = useMemo<RJSFSchema>(() => getReplicationModeParamsSchema(
    modeDraftKey,
    {
      lotSize: t('portfolio.replication.modeParamsFields.lotSizeLabel'),
    },
  ), [modeDraftKey, t]);
  const modeParamsUiSchema = useMemo<UiSchema<Record<string, unknown>, RJSFSchema>>(() => ({
    'ui:submitButtonOptions': {
      norender: true,
    },
  }), []);

  const parseModeParamsRaw = (raw: string, modeKey: string): {
    params: Record<string, unknown>;
    error: string;
  } => {
    try {
      const parsed = JSON.parse(raw || '{}') as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        return {
          params: {},
          error: modeParamsObjectError,
        };
      }
      const parsedObject = parsed as Record<string, unknown>;
      const normalized = normalizeReplicationModeParams(modeKey, parsedObject);
      return {
        params: normalized,
        error: validateReplicationModeParamsShape(modeKey, parsedObject) ? '' : modeParamsObjectError,
      };
    } catch {
      return {
        params: {},
        error: modeParamsJsonError,
      };
    }
  };

  const handleModeParamsChange = ({ formData }: IChangeEvent<Record<string, unknown>>) => {
    if (!formData || Array.isArray(formData) || typeof formData !== 'object') {
      setModeDraftParams({});
      setModeDraftError(modeParamsObjectError);
      return;
    }
    const normalized = normalizeReplicationModeParams(modeDraftKey, formData);
    setModeDraftParams(normalized);
    if (modeDraftError) {
      setModeDraftError('');
    }
  };

  const onSaveRequest = async () => {
    if (!modeDraftParams || Array.isArray(modeDraftParams) || typeof modeDraftParams !== 'object') {
      setModeDraftError(modeParamsObjectError);
      return;
    }
    if (!validateReplicationModeParamsShape(modeDraftKey, modeDraftParams)) {
      setModeDraftError(modeParamsObjectError);
      return;
    }

    setModeDraftError('');
    const saved = await onSave({
      modeKey: modeDraftKey,
      modeParamsRaw: JSON.stringify(modeDraftParams, null, 2),
    });
    if (saved) {
      setOpen(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        if (nextOpen) {
          const nextModeKey = initialModeKey || 'full';
          setModeDraftKey(nextModeKey);
          const parsed = parseModeParamsRaw(initialModeParamsRaw || '{}', nextModeKey);
          setModeDraftParams(parsed.params);
          setModeDraftError(parsed.error);
        } else {
          setModeDraftError('');
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className='grid gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='mode-settings-dialog-mode'>
              {modeKeyLabel}
            </Label>
            <Select
              value={modeDraftKey || 'full'}
              onValueChange={nextModeKey => {
                setModeDraftKey(nextModeKey);
                setModeDraftParams(prev => normalizeReplicationModeParams(nextModeKey, prev));
                setModeDraftError('');
              }}
              disabled={working}
            >
              <SelectTrigger id='mode-settings-dialog-mode'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modeOptions.map(mode => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid gap-2'>
            <Label htmlFor='mode-settings-dialog-params'>
              {modeParamsLabel}
            </Label>
            <Form
              id='mode-settings-dialog-params'
              schema={modeParamsSchema}
              uiSchema={modeParamsUiSchema}
              formData={modeDraftParams}
              onChange={handleModeParamsChange}
              showErrorList={false}
              disabled={working}
              noHtml5Validate
              validator={validator}
            />
          </div>

          {modeDraftError ? (
            <Alert variant='destructive'>
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{modeDraftError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => setOpen(false)} disabled={working}>
            {cancelLabel}
          </Button>
          <Button type='button' onClick={() => void onSaveRequest()} disabled={working}>
            {saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
