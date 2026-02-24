"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
import { verificationClient } from "@/lib/verification-client";
import { useTranslation } from "react-i18next";

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
  const router = useRouter()
  const { refreshUser } = useUser();

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const onLoginSuccess = async () => {
    setIsFinalizing(true)
    setError("")

    // In some browsers/cross-origin setups Set-Cookie visibility can lag slightly.
    // Wait for /me to succeed before navigating.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        await usersApi.meGet()
        await refreshUser()
        router.push("/dashboard")
        return
      } catch {
      }
      await sleep(250)
    }

    setError(t("auth.login.sessionNotReady"))
    setIsFinalizing(false)
  };

  const pollVerification = async () => {
    if (!challengeID) {
      return;
    }

    try {
      const response = await verificationClient.verifyLogin(challengeID);
      if (response.status === 200) {
        setChallengeID("")
        setVerificationExpiresAt("")
        await onLoginSuccess();
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t("auth.login.verification.genericError"))
        return
      }
      setError(t("auth.login.verification.genericError"))
    }
  };

  useEffect(() => {
    if (!challengeID) {
      return;
    }
    const interval = setInterval(() => {
      void pollVerification();
    }, 3000);
    return () => clearInterval(interval);
  }, [challengeID]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

      if (response.status === 200) {
        await onLoginSuccess()
      } else if (
        response.status === 202 &&
        response.data?.verification_required &&
        response.data?.challenge_id
      ) {
        setChallengeID(response.data.challenge_id)
        setVerificationExpiresAt(response.data.expires_at || "")
      } else {
        setError(response.data?.error || t("auth.login.genericError"))
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || t("auth.login.genericError"))
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
              : t("auth.login.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}
              {!challengeID ? (
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
              ) : (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div>{t("auth.login.verification.waiting")}</div>
                  {verificationExpiresAt ? (
                    <div className="text-muted-foreground">
                      {t("auth.login.verification.expiresAt", { time: new Date(verificationExpiresAt).toLocaleString() })}
                    </div>
                  ) : null}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={isLoading || isFinalizing}>
                  {challengeID
                    ? (isLoading ? t("auth.login.verification.checking") : t("auth.login.verification.checkNow"))
                    : (isLoading ? t("auth.login.submitting") : t("auth.login.submit"))}
                </Button>
                {challengeID ? (
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
