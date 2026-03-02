"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { PortfolioProfileCreateRequest } from "@/api-client";
import type { NormalizedPortfolioProfile } from "@/app/portfolio-v2/use-portfolio-v2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PortfolioProfileManagerProps = {
  selectedProfile: NormalizedPortfolioProfile | null;
  isCreating: boolean;
  onCreateProfile: (payload: PortfolioProfileCreateRequest) => Promise<boolean>;
  onValidationError: (message: string) => void;
};

export function PortfolioProfileManager({
  selectedProfile,
  isCreating,
  onCreateProfile,
  onValidationError,
}: PortfolioProfileManagerProps) {
  const { t } = useTranslation();
  const [newProvider, setNewProvider] = useState<"mock" | "tbank" | "virtual">(
    "mock",
  );
  const [newName, setNewName] = useState("");
  const [newAccountID, setNewAccountID] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(false);

  const selectedAccountID =
    typeof selectedProfile?.config?.account_id === "string"
      ? selectedProfile.config.account_id
      : "";

  const onSubmit = async () => {
    const normalizedName = newName.trim();
    if (!normalizedName) {
      onValidationError(t("portfolioV2.errors.profileNameRequired"));
      return;
    }

    const payload: PortfolioProfileCreateRequest = {
      provider: newProvider,
      name: normalizedName,
      is_default: newIsDefault,
      config:
        newProvider === "tbank" && newAccountID.trim()
          ? { account_id: newAccountID.trim() }
          : {},
    };

    const created = await onCreateProfile(payload);
    if (!created) {
      return;
    }

    setNewName("");
    setNewAccountID("");
    setNewIsDefault(false);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{t("portfolioV2.profiles.managerTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 text-sm space-y-2">
          <div className="font-medium">
            {t("portfolioV2.profiles.selectedConfigTitle")}
          </div>
          <div>
            <span className="font-medium">
              {t("portfolioV2.card.profileName")}{" "}
            </span>
            {selectedProfile?.name || "-"}
          </div>
          <div>
            <span className="font-medium">
              {t("portfolioV2.card.provider")}{" "}
            </span>
            {selectedProfile?.provider || "-"}
          </div>
          <div>
            <span className="font-medium">
              {t("portfolioV2.profiles.defaultLabel")}{" "}
            </span>
            {selectedProfile?.is_default
              ? t("portfolioV2.profiles.defaultYes")
              : t("portfolioV2.profiles.defaultNo")}
          </div>
          <div>
            <span className="font-medium">
              {t("portfolioV2.profiles.accountIDLabel")}{" "}
            </span>
            {selectedAccountID || "-"}
          </div>
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div className="text-sm font-medium">
            {t("portfolioV2.selector.createTitle")}
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="portfolio-v2-provider">
                {t("portfolioV2.selector.provider")}
              </Label>
              <select
                id="portfolio-v2-provider"
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={newProvider}
                onChange={(event) =>
                  setNewProvider(
                    event.target.value as "mock" | "tbank" | "virtual",
                  )
                }
              >
                <option value="mock">mock</option>
                <option value="tbank">tbank</option>
                <option value="virtual">virtual</option>
              </select>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="portfolio-v2-name">
                {t("portfolioV2.selector.name")}
              </Label>
              <Input
                id="portfolio-v2-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t("portfolioV2.selector.namePlaceholder")}
              />
            </div>

            <label className="flex items-end gap-2 text-sm">
              <input
                type="checkbox"
                checked={newIsDefault}
                onChange={(event) => setNewIsDefault(event.target.checked)}
              />
              {t("portfolioV2.selector.isDefault")}
            </label>
          </div>

          {newProvider === "tbank" ? (
            <div className="grid gap-2">
              <Label htmlFor="portfolio-v2-account-id">
                {t("portfolioV2.selector.accountID")}
              </Label>
              <Input
                id="portfolio-v2-account-id"
                value={newAccountID}
                onChange={(event) => setNewAccountID(event.target.value)}
                placeholder={t("portfolioV2.selector.accountIDPlaceholder")}
              />
            </div>
          ) : null}

          <div>
            <Button
              type="button"
              onClick={() => void onSubmit()}
              disabled={isCreating}
            >
              {t("portfolioV2.selector.createButton")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
