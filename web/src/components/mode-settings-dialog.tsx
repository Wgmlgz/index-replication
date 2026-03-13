'use client';

import { type ReactNode, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';

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
  const [modeDraftParamsRaw, setModeDraftParamsRaw] = useState<string>('{}');
  const [modeDraftError, setModeDraftError] = useState('');

  const onSaveRequest = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(modeDraftParamsRaw || '{}');
    } catch {
      setModeDraftError(modeParamsJsonError);
      return;
    }

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      setModeDraftError(modeParamsObjectError);
      return;
    }

    setModeDraftError('');
    const saved = await onSave({
      modeKey: modeDraftKey,
      modeParamsRaw: modeDraftParamsRaw,
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
          setModeDraftKey(initialModeKey || 'full');
          setModeDraftParamsRaw(initialModeParamsRaw || '{}');
          setModeDraftError('');
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
              onValueChange={setModeDraftKey}
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
            <Textarea
              id='mode-settings-dialog-params'
              value={modeDraftParamsRaw}
              onChange={event => setModeDraftParamsRaw(event.target.value)}
              placeholder='{}'
              rows={8}
              disabled={working}
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
