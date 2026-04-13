"use client"

import { useEffect, useState } from "react";
import { useUser } from "@/components/user-context";
import { Time } from "@/components/ui/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { H3 } from "@/components/ui/typography";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalStorage } from 'react-use';
import { LOCAL_STORAGE_BASE_URL } from "@/lib/api";
import { LOCAL_STORAGE_DEFAULT_THRESHOLD, LOCAL_STORAGE_ONE_OTHER_THRESHOLD, LOCAL_STORAGE_ONE_THRESHOLD } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { userSettingsClient } from "@/lib/user-settings-client";
import { setLanguage } from "@/lib/i18n";

const USER_SETTING_LANGUAGE_KEY = "preferences.language";

const normalizePreferredLanguage = (value: string | undefined) => {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized.startsWith("en")) return "en";
  return "en";
};

const ChangeServerUrl = () => {
  const { t } = useTranslation();
  const [apiUrl, setApiUrl] = useLocalStorage(LOCAL_STORAGE_BASE_URL, "");
  const [defaultThreshold, setDefaultThreshold] = useLocalStorage<number>(LOCAL_STORAGE_DEFAULT_THRESHOLD, 0.75);
  const [oneThreshold, setOneThreshold] = useLocalStorage<number>(LOCAL_STORAGE_ONE_THRESHOLD, 0.8);
  const [oneOtherThreshold, setOneOtherThreshold] = useLocalStorage<number>(LOCAL_STORAGE_ONE_OTHER_THRESHOLD, 0.8);

  return <>
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>
          <H3>
            {t("settings.page.appSettingsTitle")}
          </H3>
        </CardTitle>
      </CardHeader>

      <CardContent className="gap-4 grid lg:grid-cols-2">
        <div className="grid gap-3">
          <Label htmlFor="api-url">{t("settings.page.apiUrlLabel")}</Label>
          <Input
            id="api-url"
            type="text"
            placeholder={t("settings.page.apiUrlPlaceholder")}
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="default-threshold">{t("settings.page.defaultThresholdLabel")}</Label>
          <Input
            id="default-threshold"
            type="number"
            placeholder="0.75"
            value={defaultThreshold}
            onChange={(e) => setDefaultThreshold(Number(e.target.value))}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="one-threshold">{t("settings.page.oneThresholdLabel")}</Label>
          <Input
            id="one-threshold"
            type="number"
            placeholder="0.8"
            value={oneThreshold}
            onChange={(e) => setOneThreshold(Number(e.target.value))}
            required
          />
        </div>
        <div className="grid gap-3">
          <Label htmlFor="one-other-threshold">{t("settings.page.oneOtherThresholdLabel")}</Label>
          <Input
            id="one-other-threshold"
            type="number"
            placeholder="0.8"
            value={oneOtherThreshold}
            onChange={(e) => setOneOtherThreshold(Number(e.target.value))}
            required
          />
        </div>
      </CardContent>
    </Card>
  </>
}

const LanguagePreferences = () => {
  const { t } = useTranslation();
  const [language, setLanguageValue] = useState("en");
  const [savedLanguage, setSavedLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [hasPersistedLanguage, setHasPersistedLanguage] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const settings = await userSettingsClient.getSettings();
        const hasLanguageKey = Boolean(
          settings.values &&
          Object.prototype.hasOwnProperty.call(settings.values, USER_SETTING_LANGUAGE_KEY)
        );
        const loaded = normalizePreferredLanguage(settings.values?.[USER_SETTING_LANGUAGE_KEY]);
        if (!mounted) return;
        setLanguageValue(loaded);
        setSavedLanguage(loaded);
        setHasPersistedLanguage(hasLanguageKey);
        setLanguage(loaded);
      } catch {
        if (!mounted) return;
        setError(t("settings.page.languageLoadError"));
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
  }, [t]);

  const saveLanguage = async () => {
    setSaving(true);
    setError("");
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
      setError(t("settings.page.languageSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = language !== savedLanguage || !hasPersistedLanguage;

  return (
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>
          <H3>{t("settings.page.languageTitle")}</H3>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("settings.page.languageDescription")}
        </p>
        <div className="grid gap-2">
          <Label htmlFor="preferred-language">{t("settings.page.languageLabel")}</Label>
          <Select
            value={language}
            onValueChange={(value) => {
              setSaved(false);
              setLanguageValue(normalizePreferredLanguage(value));
            }}
            disabled={loading || saving}
          >
            <SelectTrigger id="preferred-language" className="w-full">
              <SelectValue placeholder={t("settings.page.languageLoading")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("settings.page.languageEnglish")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("settings.page.languageEnglishOnlyHint")}
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">{t("settings.page.languageSaved")}</p> : null}
        <Button onClick={saveLanguage} disabled={loading || saving || !hasChanges}>
          {saving ? t("settings.page.languageSaving") : t("settings.page.languageSave")}
        </Button>
      </CardContent>
    </Card>
  );
};


export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, loading } = useUser();

  return (
    <>
      {loading ? <div>{t("settings.page.loading")}</div> :
        <div className="grid items-center justify-items-center">
          <div className="grid lg:grid-cols-3 gap-4 max-w-[1000px]">
            <div className="col-span-3 lg:col-span-3">
              <ChangeServerUrl></ChangeServerUrl>
            </div>
            <div className="col-span-3 lg:col-span-3">
              <LanguagePreferences />
            </div>
            <Card className="h-full w-full col-span-3">
              <CardHeader>
                <CardTitle>
                  <H3>
                    {t("settings.page.currentUserTitle")}
                  </H3>
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 grid grid-cols-2">
                <>
                  {user ?
                    <>
                      <div className="space-y-4">
                        <div><b>{t("settings.page.loginLabel")}:</b> {user.username}</div>
                        <div><b>{t("settings.page.fullNameLabel")}:</b> {user.full_name}</div>
                        <div><b>{t("settings.page.roleLabel")}:</b> {user.role_key}</div>
                      </div>
                      <div className="space-y-4">
                        <div><b>{t("settings.page.blockedLabel")}:</b> {user.is_blocked ? t("settings.page.yes") : t("settings.page.no")}</div>
                        <div><b>{t("settings.page.createdLabel")}:</b> <Time className="inline" time={user.created_at} /></div>
                        <div><b>{t("settings.page.lastActiveLabel")}:</b> <Time className="inline" time={user.last_active} fallback={t("settings.page.never")} /></div>
                      </div>
                    </> : <div>{t("settings.page.notAuthorized")}</div>
                  }
                </>

              </CardContent>
            </Card>
          </div>
        </div >}
    </>

  );
}
