'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

import {
  verificationClient,
  type TelegramConnectResponse,
  type TelegramStatusResponse,
} from '@/lib/verification-client';
import { Button } from '@/components/ui/button';
import {
  IntegrationConnectionCard,
  IntegrationConnectionStatus,
} from '@/components/integrations/integration-connection-card';
import { MarkdownArticle } from '@/components/content/markdown-article';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function TelegramVerificationCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [connectInfo, setConnectInfo] =
    useState<TelegramConnectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const getErrorMessage = useCallback((err: unknown, fallbackKey: string) => {
    if (axios.isAxiosError(err)) {
      return err.response?.data?.error || t(fallbackKey);
    }
    return t(fallbackKey);
  }, [t]);

  const loadStatus = useCallback(async () => {
    try {
      const data = await verificationClient.getTelegramStatus();
      setStatus(data);
    } catch (err) {
      setError(getErrorMessage(err, 'settings.telegram.errors.load'));
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onGenerateConnectLink = async () => {
    setWorking(true);
    setError('');
    try {
      const data = await verificationClient.createTelegramConnectLink();
      setConnectInfo(data);
      await loadStatus();
    } catch (err) {
      setError(getErrorMessage(err, 'settings.telegram.errors.connectLink'));
    } finally {
      setWorking(false);
    }
  };

  const onToggle2FA = async (enabled: boolean) => {
    setWorking(true);
    setError('');
    try {
      const data = await verificationClient.patchTelegramSettings({
        login_2fa_enabled: enabled,
      });
      setStatus(data);
    } catch (err) {
      setError(getErrorMessage(err, 'settings.telegram.errors.update'));
    } finally {
      setWorking(false);
    }
  };

  const onUnlinkTelegram = async () => {
    if (!window.confirm(t('settings.telegram.unlinkConfirm'))) {
      return;
    }
    setWorking(true);
    setError('');
    try {
      const data = await verificationClient.unlinkTelegram();
      setStatus(data);
      setConnectInfo(null);
    } catch (err) {
      setError(getErrorMessage(err, 'settings.telegram.errors.unlink'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <IntegrationConnectionCard
      title={t('settings.telegram.title')}
      description={t('settings.telegram.description')}
      loading={loading}
      loadingLabel={t('settings.telegram.loading')}
      error={error}
    >
      <IntegrationConnectionStatus
        label={t('settings.telegram.connectionLabel')}
        connected={Boolean(status?.connected)}
        connectedLabel={t('settings.telegram.connected')}
        notConnectedLabel={t('settings.telegram.notConnected')}
      >
        {status?.telegram_username ? (
          <div className='text-muted-foreground'>
            {t('settings.telegram.username', {
              username: status.telegram_username,
            })}
          </div>
        ) : null}
      </IntegrationConnectionStatus>
      <MarkdownArticle articleID='integrations/telegram-verification' />

      <div className='flex items-center justify-between rounded-md border p-3'>
        <div className='space-y-1'>
          <Label htmlFor='telegram-login-2fa'>
            {t('settings.telegram.enableLogin2FA')}
          </Label>
          <div className='text-xs text-muted-foreground'>
            {t('settings.telegram.enableLogin2FADescription')}
          </div>
        </div>
        <Switch
          id='telegram-login-2fa'
          checked={Boolean(status?.login_2fa_enabled)}
          onCheckedChange={onToggle2FA}
          disabled={working || !status?.connected}
        />
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          onClick={onGenerateConnectLink}
          disabled={working}
        >
          {t('settings.telegram.generateLink')}
        </Button>
        {status?.bot_username ? (
          <Button type='button' variant='outline' asChild>
            <a
              href={`https://t.me/${status.bot_username}`}
              target='_blank'
              rel='noreferrer'
            >
              {t('settings.telegram.openBot')}
            </a>
          </Button>
        ) : null}
        {status?.connected ? (
          <Button
            type='button'
            variant='destructive'
            onClick={onUnlinkTelegram}
            disabled={working}
          >
            {t('settings.telegram.unlink')}
          </Button>
        ) : null}
      </div>

      {connectInfo ? (
        <div className='space-y-2 rounded-md border p-3 text-sm'>
          <div>{t('settings.telegram.connectLinkReady')}</div>
          <a
            className='break-all text-primary underline'
            href={connectInfo.connect_url}
            target='_blank'
            rel='noreferrer'
          >
            {connectInfo.connect_url}
          </a>
          <div className='text-muted-foreground'>
            {t('settings.telegram.expiresAt', {
              time: new Date(connectInfo.expires_at).toLocaleString(),
            })}
          </div>
        </div>
      ) : null}
    </IntegrationConnectionCard>
  );
}
