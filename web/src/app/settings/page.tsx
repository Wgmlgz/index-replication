"use client"

import { useUser } from "@/components/user-context";
import { Time } from "@/components/ui/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { H3 } from "@/components/ui/typography";
import { ChangePasswordForm } from "@/components/change-password-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from 'react-use';
import { LOCAL_STORAGE_BASE_URL } from "@/lib/api";
import { LOCAL_STORAGE_DEFAULT_THRESHOLD, LOCAL_STORAGE_ONE_OTHER_THRESHOLD, LOCAL_STORAGE_ONE_THRESHOLD } from "@/lib/utils";
import { useTranslation } from "react-i18next";

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
            <Card className="h-full w-full col-span-2">
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
                        <div><b>{t("settings.page.emailLabel")}:</b> {user.email || <span className="text-muted-foreground">{t("settings.page.none")}</span>}</div>
                        <div><b>{t("settings.page.roleLabel")}:</b> {user.role_key}</div>
                      </div>
                      <div className="space-y-4">
                        <div><b>{t("settings.page.phoneLabel")}:</b> {user.phone || <span className="text-muted-foreground">{t("settings.page.none")}</span>}</div>
                        <div><b>{t("settings.page.blockedLabel")}:</b> {user.is_blocked ? t("settings.page.yes") : t("settings.page.no")}</div>
                        <div><b>{t("settings.page.createdLabel")}:</b> <Time className="inline" time={user.created_at} /></div>
                        <div><b>{t("settings.page.lastActiveLabel")}:</b> <Time className="inline" time={user.last_active} fallback={t("settings.page.never")} /></div>
                      </div>
                    </> : <div>{t("settings.page.notAuthorized")}</div>
                  }
                </>

              </CardContent>
            </Card>
            {user &&
              <div className="col-span-2 lg:col-span-1">
                <ChangePasswordForm />
              </div>}
          </div>
        </div >}
    </>

  );
}
