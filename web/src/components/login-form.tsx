"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import axios from "axios"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useUser } from "@/components/user-context";
import { authApi as auth_api, usersApi } from "@/lib/api";
import { getApiErrorMessage } from "@/lib/error-utils";
import { useTranslation } from "react-i18next";
import { DEFAULT_AUTHENTICATED_ROUTE, getSafeNextPath } from "@/lib/routes";
import { type AuthMode, getAuthMode, setAuthMode } from "@/lib/auth-mode";
import {
  beginKeycloakLogin,
  clearKeycloakTokens,
  consumeKeycloakLoginCallback,
  isKeycloakAuthConfigured,
} from "@/lib/keycloak-auth";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type LoginResponseData = {
  verification_required?: boolean;
  challenge_id?: string;
  expires_at?: string;
  error?: string;
};

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { t } = useTranslation();
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [challengeID, setChallengeID] = useState("")
  const [verificationExpiresAt, setVerificationExpiresAt] = useState("")
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [authMode, setAuthModeState] = useState<AuthMode>(() => getAuthMode())
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useUser();
  const searchParamsString = searchParams.toString();

  const onLoginSuccess = useCallback(async (): Promise<boolean> => {
    setIsFinalizing(true)
    setError("")
    const nextPath = getSafeNextPath(searchParams.get("next"))
    const redirectTarget = nextPath ?? DEFAULT_AUTHENTICATED_ROUTE

    // In some browsers/cross-origin setups Set-Cookie visibility can lag slightly.
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

    setError(t("auth.login.sessionNotReady"))
    setIsFinalizing(false)
    return false
  }, [refreshUser, router, searchParams, t]);

  const setLoginMode = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setAuthModeState(mode);
    setError("");
    setChallengeID("");
    setVerificationExpiresAt("");
    if (mode === "session") {
      clearKeycloakTokens();
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const hasKeycloakCallbackParams =
      params.has("code") || params.has("state") || params.has("error");
    if (!hasKeycloakCallbackParams) {
      return;
    }

    if (authMode !== "keycloak") {
      setLoginMode("keycloak");
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
  }, [authMode, onLoginSuccess, router, searchParamsString, setLoginMode, t]);

  const pollVerification = useCallback(async () => {
    if (!challengeID) {
      return;
    }

    try {
      const response = await auth_api.loginVerifyPost({
        challenge_id: challengeID,
      });
      if (response.status === 200) {
        setChallengeID("")
        setVerificationExpiresAt("")
        await onLoginSuccess();
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const apiError = getApiErrorMessage(err.response?.data as unknown);
        setError(apiError ?? t("auth.login.verification.genericError"))
        return
      }
      setError(t("auth.login.verification.genericError"))
    }
  }, [challengeID, onLoginSuccess, t]);

  useEffect(() => {
    if (!challengeID) {
      return;
    }
    const interval = setInterval(() => {
      void pollVerification();
    }, 3000);
    return () => clearInterval(interval);
  }, [challengeID, pollVerification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (authMode === "keycloak") {
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
      return;
    }

    if (challengeID) {
      setIsLoading(true)
      setError("")
      await pollVerification()
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await auth_api.loginPost({
        username,
        password,
        remember_me: rememberMe,
      });
      const responseData = response.data as LoginResponseData | undefined;

      if (response.status === 200) {
        await onLoginSuccess()
      } else if (
        response.status === 202 &&
        responseData?.verification_required &&
        responseData?.challenge_id
      ) {
        setChallengeID(responseData.challenge_id)
        setVerificationExpiresAt(responseData.expires_at || "")
      } else {
        setError(responseData?.error || t("auth.login.genericError"))
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const apiError = getApiErrorMessage(err.response?.data as unknown);
        setError(apiError ?? t("auth.login.genericError"))
      } else {
        setError(t("auth.login.genericError"))
      }
      console.error("Login error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>{t("auth.login.title")}</CardTitle>
          <CardDescription>
            {challengeID
              ? t("auth.login.verification.description")
              : authMode === "keycloak"
                ? t("auth.login.keycloak.description")
                : t("auth.login.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={event => {
              void handleSubmit(event);
            }}
          >
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label>{t("auth.login.modeLabel")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={authMode === "session" ? "default" : "outline"}
                    onClick={() => setLoginMode("session")}
                    disabled={isLoading || isFinalizing}
                  >
                    {t("auth.login.modeSession")}
                  </Button>
                  <Button
                    type="button"
                    variant={authMode === "keycloak" ? "default" : "outline"}
                    onClick={() => setLoginMode("keycloak")}
                    disabled={isLoading || isFinalizing}
                  >
                    {t("auth.login.modeKeycloak")}
                  </Button>
                </div>
              </div>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              {authMode === "session" && !challengeID ? (
                <>
                  <div className="grid gap-3">
                    <Label htmlFor="username">{t("auth.login.usernameLabel")}</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder={t("auth.login.usernamePlaceholder")}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="grid gap-3">
                    <div className="flex items-center">
                      <Label htmlFor="password">{t("auth.login.passwordLabel")}</Label>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder={t("auth.login.passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={isLoading}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="remember" className="text-sm">
                      {t("auth.login.rememberMe")}
                    </Label>
                  </div>
                </>
              ) : authMode === "session" ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div>{t("auth.login.verification.waiting")}</div>
                  {verificationExpiresAt ? (
                    <div className="text-muted-foreground">
                      {t("auth.login.verification.expiresAt", { time: new Date(verificationExpiresAt).toLocaleString() })}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {t("auth.login.keycloak.description")}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isLoading || isFinalizing}>
                  {authMode === "keycloak"
                    ? (isLoading ? t("auth.login.keycloak.submitting") : t("auth.login.keycloak.submit"))
                    : challengeID
                      ? (isLoading ? t("auth.login.verification.checking") : t("auth.login.verification.checkNow"))
                      : (isLoading ? t("auth.login.submitting") : t("auth.login.submit"))}
                </Button>
                {authMode === "session" && challengeID ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setChallengeID("")
                      setVerificationExpiresAt("")
                      setError("")
                    }}
                    disabled={isLoading || isFinalizing}
                  >
                    {t("auth.login.verification.back")}
                  </Button>
                ) : null}
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
