"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import { verificationClient, type TelegramConnectResponse, type TelegramStatusResponse } from "@/lib/verification-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function TelegramVerificationCard() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TelegramStatusResponse | null>(null);
  const [connectInfo, setConnectInfo] = useState<TelegramConnectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = async () => {
    try {
      const data = await verificationClient.getTelegramStatus();
      setStatus(data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t("settings.telegram.errors.load"));
      } else {
        setError(t("settings.telegram.errors.load"));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const onGenerateConnectLink = async () => {
    setWorking(true);
    setError("");
    try {
      const data = await verificationClient.createTelegramConnectLink();
      setConnectInfo(data);
      await loadStatus();
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t("settings.telegram.errors.connectLink"));
      } else {
        setError(t("settings.telegram.errors.connectLink"));
      }
    } finally {
      setWorking(false);
    }
  };

  const onToggle2FA = async (enabled: boolean) => {
    setWorking(true);
    setError("");
    try {
      const data = await verificationClient.patchTelegramSettings({
        login_2fa_enabled: enabled,
      });
      setStatus(data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t("settings.telegram.errors.update"));
      } else {
        setError(t("settings.telegram.errors.update"));
      }
    } finally {
      setWorking(false);
    }
  };

  const onUnlinkTelegram = async () => {
    if (!window.confirm(t("settings.telegram.unlinkConfirm"))) {
      return;
    }
    setWorking(true);
    setError("");
    try {
      const data = await verificationClient.unlinkTelegram();
      setStatus(data);
      setConnectInfo(null);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t("settings.telegram.errors.unlink"));
      } else {
        setError(t("settings.telegram.errors.unlink"));
      }
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>{t("settings.telegram.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? <div className="text-sm text-muted-foreground">{t("settings.telegram.loading")}</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="text-sm">
          <div>
            <span className="font-medium">{t("settings.telegram.connectionLabel")} </span>
            {status?.connected ? t("settings.telegram.connected") : t("settings.telegram.notConnected")}
          </div>
          {status?.telegram_username ? (
            <div className="text-muted-foreground">
              {t("settings.telegram.username", { username: status.telegram_username })}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <div>{t("settings.telegram.instructions.step1")}</div>
          <div>{t("settings.telegram.instructions.step2")}</div>
          <div>{t("settings.telegram.instructions.step3")}</div>
          <div>{t("settings.telegram.instructions.step4")}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onGenerateConnectLink} disabled={working}>
            {t("settings.telegram.generateLink")}
          </Button>
          {status?.bot_username ? (
            <Button
              type="button"
              variant="outline"
              asChild
            >
              <a href={`https://t.me/${status.bot_username}`} target="_blank" rel="noreferrer">
                {t("settings.telegram.openBot")}
              </a>
            </Button>
          ) : null}
          {status?.connected ? (
            <Button
              type="button"
              variant="destructive"
              onClick={onUnlinkTelegram}
              disabled={working}
            >
              {t("settings.telegram.unlink")}
            </Button>
          ) : null}
        </div>

        {connectInfo ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <div>{t("settings.telegram.connectLinkReady")}</div>
            <a className="break-all text-primary underline" href={connectInfo.connect_url} target="_blank" rel="noreferrer">
              {connectInfo.connect_url}
            </a>
            <div className="text-muted-foreground">
              {t("settings.telegram.expiresAt", {
                time: new Date(connectInfo.expires_at).toLocaleString(),
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-md border p-3">
          <div className="space-y-1">
            <Label htmlFor="telegram-login-2fa">{t("settings.telegram.enableLogin2FA")}</Label>
            <div className="text-xs text-muted-foreground">{t("settings.telegram.enableLogin2FADescription")}</div>
          </div>
          <Switch
            id="telegram-login-2fa"
            checked={Boolean(status?.login_2fa_enabled)}
            onCheckedChange={onToggle2FA}
            disabled={working || !status?.connected}
          />
        </div>
      </CardContent>
    </Card>
  );
}
