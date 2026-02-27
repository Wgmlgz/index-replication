"use client";

import { useTranslation } from "react-i18next";

import { TBankBuyCard } from "@/components/tbank-test/buy-card";
import { TBankInstrumentLookupCard } from "@/components/tbank-test/instrument-lookup-card";
import { TBankConnectionProvider } from "@/components/tbank-test/tbank-connection-context";

function TBankTestPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("tbankTest.title")}</h1>
        <p className="text-muted-foreground">{t("tbankTest.description")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TBankBuyCard />
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
