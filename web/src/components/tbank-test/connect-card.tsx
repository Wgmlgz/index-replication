'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useTBankConnectionContext,
  type TBankEnvironment,
} from '@/components/tbank-test/tbank-connection-context';
import {
  IntegrationConnectionCard,
  IntegrationConnectionStatus,
} from '@/components/integrations/integration-connection-card';
import { MarkdownArticle } from '@/components/content/markdown-article';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function TBankConnectCard() {
  const { t } = useTranslation();
  const {
    status,
    loadingStatus,
    working,
    error,
    availableAccounts,
    connect,
    disconnect,
    saveDefaultAccount,
    refreshStatus,
    clearError,
  } = useTBankConnectionContext();

  const [connectToken, setConnectToken] = useState('');
  const [environmentOverride, setEnvironmentOverride] =
    useState<TBankEnvironment | null>(null);
  const [defaultAccountIDOverride, setDefaultAccountIDOverride] =
    useState<string | null>(null);
  const environment: TBankEnvironment =
    environmentOverride ??
    (status?.environment === 'production' ? 'production' : 'sandbox');
  const defaultAccountID =
    defaultAccountIDOverride ?? status?.default_account_id ?? '';

  const onConnect = async () => {
    if (!connectToken.trim()) return;
    try {
      await connect({ token: connectToken, environment, defaultAccountID });
      setConnectToken('');
      setEnvironmentOverride(null);
      setDefaultAccountIDOverride(null);
    } catch {
      // handled in context error state
    }
  };

  const onDisconnect = async () => {
    try {
      await disconnect();
      setEnvironmentOverride(null);
      setDefaultAccountIDOverride('');
    } catch {
      // handled in context error state
    }
  };

  const onSaveDefaultAccount = async () => {
    try {
      await saveDefaultAccount(defaultAccountID);
      setDefaultAccountIDOverride(null);
    } catch {
      // handled in context error state
    }
  };

  return (
    <IntegrationConnectionCard
      title={t('tbankTest.connect.title')}
      description={t('tbankTest.connect.description')}
      loading={loadingStatus}
      loadingLabel={t('tbankTest.loading')}
      error={error}
    >
      <IntegrationConnectionStatus
        label={t('tbankTest.connect.statusLabel')}
        connected={Boolean(status?.connected)}
        connectedLabel={t('tbankTest.connect.connected')}
        notConnectedLabel={t('tbankTest.connect.notConnected')}
      >
        {status?.token_masked ? (
          <div className='text-muted-foreground'>
            {t('tbankTest.connect.maskedToken', { token: status.token_masked })}
          </div>
        ) : null}
        {status?.default_account_id ? (
          <div className='text-muted-foreground'>
            {t('tbankTest.connect.defaultAccountValue', {
              accountID: status.default_account_id,
            })}
          </div>
        ) : null}
        {status?.connection_error ? (
          <div className='text-red-600'>{status.connection_error}</div>
        ) : null}
      </IntegrationConnectionStatus>
      <MarkdownArticle articleID='integrations/tbank-integration' />

      <div className='grid gap-2'>
        <Label htmlFor='tbank-env'>
          {t('tbankTest.connect.environmentLabel')}
        </Label>
        <select
          id='tbank-env'
          className='border-input bg-background h-9 rounded-md border px-3 text-sm'
          value={environment}
          onChange={event =>
            setEnvironmentOverride(event.target.value as TBankEnvironment)
          }
        >
          <option value='sandbox'>
            {t('tbankTest.connect.environmentSandbox')}
          </option>
          <option value='production'>
            {t('tbankTest.connect.environmentProduction')}
          </option>
        </select>
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='tbank-token'>{t('tbankTest.connect.tokenLabel')}</Label>
        <Input
          id='tbank-token'
          type='password'
          value={connectToken}
          onChange={event => {
            setConnectToken(event.target.value);
            if (error) clearError();
          }}
          placeholder={t('tbankTest.connect.tokenPlaceholder')}
        />
      </div>

      <div className='grid gap-2'>
        <Label htmlFor='tbank-default-account'>
          {t('tbankTest.connect.defaultAccountLabel')}
        </Label>
        <select
          id='tbank-default-account'
          className='border-input bg-background h-9 rounded-md border px-3 text-sm'
          value={defaultAccountID}
          onChange={event => {
            setDefaultAccountIDOverride(event.target.value);
            if (error) clearError();
          }}
        >
          <option value=''>{t('tbankTest.connect.defaultAccountAuto')}</option>
          {availableAccounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.id}
            </option>
          ))}
        </select>
      </div>

      <div className='flex flex-wrap gap-2'>
        <Button
          type='button'
          onClick={onConnect}
          disabled={working || !connectToken.trim()}
        >
          {t('tbankTest.connect.connectButton')}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={onSaveDefaultAccount}
          disabled={working || !status?.connected || !defaultAccountID.trim()}
        >
          {t('tbankTest.connect.saveDefaultButton')}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={onDisconnect}
          disabled={working || !status?.connected}
        >
          {t('tbankTest.connect.disconnectButton')}
        </Button>
        <Button
          type='button'
          variant='ghost'
          onClick={() => {
            setEnvironmentOverride(null);
            setDefaultAccountIDOverride(null);
            void refreshStatus();
          }}
          disabled={working}
        >
          {t('tbankTest.connect.refreshButton')}
        </Button>
      </div>
    </IntegrationConnectionCard>
  );
}
