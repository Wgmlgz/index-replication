'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/components/user-context';
import { Time } from '@/components/ui/time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { H3 } from '@/components/ui/typography';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from 'react-i18next';
import { userSettingsClient } from '@/lib/user-settings-client';
import { setLanguage } from '@/lib/i18n';
import { TelegramVerificationCard } from '@/components/telegram-verification-card';
import { TBankConnectCard } from '@/components/tbank/connect-card';
import { TBankConnectionProvider } from '@/components/tbank/tbank-connection-context';

const USER_SETTING_LANGUAGE_KEY = 'preferences.language';

const normalizePreferredLanguage = (value: string | undefined) => {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return 'en';
};

const LanguagePreferences = () => {
  const { t, i18n } = useTranslation();
  const [language, setLanguageValue] = useState('en');
  const [savedLanguage, setSavedLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasPersistedLanguage, setHasPersistedLanguage] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const settings = await userSettingsClient.getSettings();
        const hasLanguageKey = Boolean(
          settings.values &&
          Object.prototype.hasOwnProperty.call(
            settings.values,
            USER_SETTING_LANGUAGE_KEY,
          ),
        );
        const loaded = normalizePreferredLanguage(
          settings.values?.[USER_SETTING_LANGUAGE_KEY],
        );
        if (!mounted) return;
        setLanguageValue(loaded);
        setSavedLanguage(loaded);
        setHasPersistedLanguage(hasLanguageKey);
        setLanguage(loaded);
      } catch {
        if (!mounted) return;
        setError(i18n.t('settings.page.languageLoadError'));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [i18n]);

  const saveLanguage = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const nextLanguage = normalizePreferredLanguage(language);
      await userSettingsClient.patchSettings({
        values: {
          [USER_SETTING_LANGUAGE_KEY]: nextLanguage,
        },
      });
      setSavedLanguage(nextLanguage);
      setHasPersistedLanguage(true);
      setLanguage(nextLanguage);
      setSaved(true);
    } catch {
      setError(t('settings.page.languageSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = language !== savedLanguage || !hasPersistedLanguage;

  return (
    <Card className='h-full w-full'>
      <CardHeader>
        <CardTitle>
          <H3>{t('settings.page.languageTitle')}</H3>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <div className='grid gap-2'>
          <Label htmlFor='preferred-language'>
            {t('settings.page.languageLabel')}
          </Label>
          <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'>
            <Select
              value={language}
              onValueChange={value => {
                setSaved(false);
                setLanguageValue(normalizePreferredLanguage(value));
              }}
              disabled={loading || saving}
            >
              <SelectTrigger id='preferred-language' className='w-full'>
                <SelectValue placeholder={t('settings.page.languageLoading')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='en'>
                  {t('settings.page.languageEnglish')}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              className='w-full sm:w-auto'
              onClick={() => void saveLanguage()}
              disabled={loading || saving || !hasChanges}
            >
              {saving
                ? t('settings.page.languageSaving')
                : t('settings.page.languageSave')}
            </Button>
          </div>
        </div>
        {error ? <p className='text-sm text-destructive'>{error}</p> : null}
        {saved ? (
          <p className='text-sm text-emerald-600'>
            {t('settings.page.languageSaved')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, loading } = useUser();

  if (loading) {
    return <div>{t('settings.page.loading')}</div>;
  }

  if (!user) {
    return <div>{t('settings.page.notAuthorized')}</div>;
  }

  return (
    <div className='grid w-full gap-6'>
      <div className='space-y-2'>
        <h1 className='text-3xl font-bold'>{t('settings.page.title')}</h1>
        <p className='text-muted-foreground'>
          {t('settings.page.description')}
        </p>
      </div>

      <div className='grid items-stretch gap-6 lg:grid-cols-3'>
        <div className='h-full lg:col-span-1'>
          <LanguagePreferences />
        </div>
        <Card className='h-full w-full lg:col-span-2'>
          <CardHeader>
            <CardTitle>
              <H3>{t('settings.page.currentUserTitle')}</H3>
            </CardTitle>
          </CardHeader>

          <CardContent className='grid gap-4 md:grid-cols-2'>
            <div className='space-y-4'>
              <div>
                <b>{t('settings.page.loginLabel')}:</b> {user.username}
              </div>
              <div>
                <b>{t('settings.page.fullNameLabel')}:</b> {user.full_name}
              </div>
              <div>
                <b>{t('settings.page.roleLabel')}:</b> {user.role_key}
              </div>
            </div>
            <div className='space-y-4'>
              <div>
                <b>{t('settings.page.blockedLabel')}:</b>{' '}
                {user.is_blocked
                  ? t('settings.page.yes')
                  : t('settings.page.no')}
              </div>
              <div>
                <b>{t('settings.page.createdLabel')}:</b>{' '}
                <Time className='inline' time={user.created_at} />
              </div>
              <div>
                <b>{t('settings.page.lastActiveLabel')}:</b>{' '}
                <Time
                  className='inline'
                  time={user.last_active}
                  fallback={t('settings.page.never')}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className='grid items-start gap-6 md:grid-cols-2'>
        <TelegramVerificationCard />
        <TBankConnectionProvider>
          <TBankConnectCard />
        </TBankConnectionProvider>
      </div>
    </div>
  );
}
