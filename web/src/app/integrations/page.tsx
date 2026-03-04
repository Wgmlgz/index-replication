"use client";

import { useTranslation } from "react-i18next";

import { TelegramVerificationCard } from "@/components/telegram-verification-card";
import { TBankConnectCard } from "@/components/tbank/connect-card";
import { TBankConnectionProvider } from "@/components/tbank/tbank-connection-context";
import { useUser } from "@/components/user-context";

export default function IntegrationsPage() {
  const { t } = useTranslation();
  const { user, loading } = useUser();

  if (loading) {
    return <div>{t("integrations.loading")}</div>;
  }

  if (!user) {
    return <div>{t("integrations.notAuthorized")}</div>;
  }

  return (
    <div className="grid w-full gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("integrations.title")}</h1>
        <p className="text-muted-foreground">{t("integrations.description")}</p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <TelegramVerificationCard />
        <TBankConnectionProvider>
          <TBankConnectCard />
        </TBankConnectionProvider>
      </div>
    </div>
  );
}
