"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type IntegrationConnectionCardProps = {
  title: string;
  description?: string;
  loading?: boolean;
  loadingLabel?: string;
  error?: string;
  children: ReactNode;
};

type IntegrationConnectionStatusProps = {
  label: string;
  connected: boolean;
  connectedLabel: string;
  notConnectedLabel: string;
  children?: ReactNode;
};

export function IntegrationConnectionCard({
  title,
  description,
  loading = false,
  loadingLabel,
  error,
  children,
}: IntegrationConnectionCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && loadingLabel ? <div className="text-sm text-muted-foreground">{loadingLabel}</div> : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>{t("common.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {children}
      </CardContent>
    </Card>
  );
}

export function IntegrationConnectionStatus({
  label,
  connected,
  connectedLabel,
  notConnectedLabel,
  children,
}: IntegrationConnectionStatusProps) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <div>
        <span className="font-medium">{label} </span>
        {connected ? connectedLabel : notConnectedLabel}
      </div>
      {children}
    </div>
  );
}
