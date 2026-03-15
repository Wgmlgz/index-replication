"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useUser } from "@/components/user-context";
import { usersApi } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { DEFAULT_AUTHENTICATED_ROUTE, getSafeNextPath } from "@/lib/routes";
import {
  beginKeycloakLogin,
  consumeKeycloakLoginCallback,
  isKeycloakAuthConfigured,
} from "@/lib/keycloak-auth";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isFinalizing, setIsFinalizing] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useUser();
  const searchParamsString = searchParams.toString();

  const onLoginSuccess = useCallback(async (): Promise<boolean> => {
    setIsFinalizing(true)
    setError("")
    const nextPath = getSafeNextPath(searchParams.get("next"))
    const redirectTarget = nextPath ?? DEFAULT_AUTHENTICATED_ROUTE

    // Wait for /me to succeed before navigating.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await usersApi.meGet()
        await refreshUser()
        router.replace(redirectTarget)
        return true
      } catch {
      }
      await sleep(250)
    }

    setError(t("auth.login.keycloak.profileNotReady"))
    setIsFinalizing(false)
    return false
  }, [refreshUser, router, searchParams, t]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const hasKeycloakCallbackParams =
      params.has("code") || params.has("state") || params.has("error");
    if (!hasKeycloakCallbackParams) {
      return;
    }

    let cancelled = false;
    let keepCallbackParams = false;

    const run = async () => {
      setIsLoading(true);
      setError("");
      try {
        const handled = await consumeKeycloakLoginCallback(params);
        if (handled) {
          const success = await onLoginSuccess();
          keepCallbackParams = success;
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const fallback = t("auth.login.keycloak.callbackError");
        if (err instanceof Error && err.message) {
          setError(err.message);
        } else {
          setError(fallback);
        }
      } finally {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
        if (!keepCallbackParams) {
          const nextPath = getSafeNextPath(params.get("next"));
          const target = nextPath
            ? `/login?next=${encodeURIComponent(nextPath)}`
            : "/login";
          router.replace(target);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [onLoginSuccess, router, searchParamsString, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isKeycloakAuthConfigured()) {
      setError(t("auth.login.keycloak.configError"));
      return;
    }

    setIsLoading(true);
    setError("");
    const nextPath = getSafeNextPath(searchParams.get("next"));
    const redirectTarget = nextPath ?? DEFAULT_AUTHENTICATED_ROUTE;
    try {
      await beginKeycloakLogin(redirectTarget);
    } catch (err) {
      if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError(t("auth.login.keycloak.callbackError"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.login.title")}</CardTitle>
          <CardDescription>{t("auth.login.keycloak.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={event => {
              void handleSubmit(event);
            }}
          >
            <div className="flex flex-col gap-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isLoading || isFinalizing}>
                  {isLoading ? t("auth.login.keycloak.submitting") : t("auth.login.keycloak.submit")}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
