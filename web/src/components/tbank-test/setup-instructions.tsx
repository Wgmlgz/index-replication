"use client";

import { useTranslation } from "react-i18next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TBankSetupInstructions() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tbankTest.instructions.title")}</CardTitle>
        <CardDescription>{t("tbankTest.instructions.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t("tbankTest.instructions.step1")}</li>
          <li>{t("tbankTest.instructions.step2")}</li>
          <li>{t("tbankTest.instructions.step3")}</li>
          <li>{t("tbankTest.instructions.step4")}</li>
          <li>{t("tbankTest.instructions.step5")}</li>
          <li>{t("tbankTest.instructions.step6")}</li>
        </ol>

        <div className="space-y-1 text-xs text-muted-foreground">
          <div>
            <a
              className="underline"
              href="https://developer.tbank.ru/invest/intro/intro/token"
              target="_blank"
              rel="noreferrer"
            >
              {t("tbankTest.instructions.tokenDocs")}
            </a>
          </div>
          <div>
            <a
              className="underline"
              href="https://developer.tbank.ru/invest/intro/developer/sandbox/"
              target="_blank"
              rel="noreferrer"
            >
              {t("tbankTest.instructions.sandboxDocs")}
            </a>
          </div>
          <div>
            <a
              className="underline"
              href="https://www.tbank.ru/invest/settings/"
              target="_blank"
              rel="noreferrer"
            >
              {t("tbankTest.instructions.settingsLink")}
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

