"use client";

import { useTranslation } from "react-i18next";

import { TBankBuyCard } from "@/components/tbank-test/buy-card";
import { TBankConnectCard } from "@/components/tbank-test/connect-card";
import { TBankInstrumentLookupCard } from "@/components/tbank-test/instrument-lookup-card";
import { TBankPortfolioCard } from "@/components/tbank-test/portfolio-card";
import { TBankConnectionProvider } from "@/components/tbank-test/tbank-connection-context";
import { TBankSetupInstructions } from "@/components/tbank-test/setup-instructions";

function TBankTestPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("tbankTest.title")}</h1>
        <p className="text-muted-foreground">{t("tbankTest.description")}</p>
      </div>

      <TBankSetupInstructions />

      <div className="grid gap-6 lg:grid-cols-2">
        <TBankConnectCard />
        <TBankBuyCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TBankPortfolioCard />
        <TBankInstrumentLookupCard />
      </div>
    </div>
  );
}

export default function TBankTestPage() {
  return (
    <TBankConnectionProvider>
      <TBankTestPageContent />
    </TBankConnectionProvider>
  );
}
