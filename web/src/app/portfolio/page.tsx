"use client";

import { Suspense } from "react";
import { useTranslation } from "react-i18next";

import { PortfolioAnalyticsSection } from "@/components/portfolio/portfolio-analytics-section";
import { TBankPortfolioCard } from "@/components/tbank-test/portfolio-card";
import { TBankConnectionProvider } from "@/components/tbank-test/tbank-connection-context";
import { Skeleton } from "@/components/ui/skeleton";

function PortfolioPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{t("portfolio.title")}</h1>
        <p className="text-muted-foreground">{t("portfolio.description")}</p>
      </div>

      <PortfolioAnalyticsSection />
      <TBankPortfolioCard />
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <TBankConnectionProvider>
      <Suspense
        fallback={
          <div className="mx-auto grid max-w-6xl gap-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-60" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-[420px] w-full" />
            <Skeleton className="h-[320px] w-full" />
          </div>
        }
      >
        <PortfolioPageContent />
      </Suspense>
    </TBankConnectionProvider>
  );
}
