import { useState } from "react";
import { kcSanitize } from "keycloakify/lib/kcSanitize";
import type { PageProps } from "keycloakify/login/pages/PageProps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KcContext } from "../KcContext";
import type { I18n } from "../i18n";

type LoginKcContext = Extract<KcContext, { pageId: "login.ftl" }>;

export default function LoginPage(
  props: PageProps<LoginKcContext, I18n>
) {
  const { kcContext, i18n, Template } = props;

  const {
    social,
    realm,
    url,
    usernameHidden,
    login,
    auth,
    registrationDisabled,
    messagesPerField,
    enableWebAuthnConditionalUI
  } = kcContext;

  const { msg, msgStr } = i18n;

  const [isLoginButtonDisabled, setIsLoginButtonDisabled] = useState(false);

  const fieldError = messagesPerField.existsError("username", "password")
    ? messagesPerField.getFirstError("username", "password")
    : undefined;

  const usernameLabel = !realm.loginWithEmailAllowed
    ? msgStr("username")
    : !realm.registrationEmailAsUsername
      ? msgStr("usernameOrEmail")
      : msgStr("email");

  return (
    <Template
      kcContext={kcContext}
      i18n={i18n}
      doUseDefaultCss={false}
      classes={{}}
      headerNode={msg("loginAccountTitle")}
      displayMessage={!fieldError}
      displayInfo={false}
    >
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{msg("loginAccountTitle")}</CardTitle>
            <CardDescription>{msg("doLogIn")}</CardDescription>
          </CardHeader>
          <CardContent>
            {fieldError && (
              <div
                className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                dangerouslySetInnerHTML={{ __html: kcSanitize(fieldError) }}
              />
            )}

            {realm.password && (
              <form
                id="kc-form-login"
                action={url.loginAction}
                method="post"
                className="space-y-4"
                onSubmit={() => {
                  setIsLoginButtonDisabled(true);
                  return true;
                }}
              >
                {!usernameHidden && (
                  <div className="grid gap-2">
                    <Label htmlFor="username">{usernameLabel}</Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      defaultValue={login.username ?? ""}
                      autoFocus
                      autoComplete={
                        enableWebAuthnConditionalUI ? "username webauthn" : "username"
                      }
                      aria-invalid={fieldError ? true : undefined}
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="password">{msg("password")}</Label>
                    {realm.resetPasswordAllowed && (
                      <a
                        className="text-sm underline-offset-4 hover:underline"
                        href={url.loginResetCredentialsUrl}
                      >
                        {msg("doForgotPassword")}
                      </a>
                    )}
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={fieldError ? true : undefined}
                  />
                </div>

                {realm.rememberMe && !usernameHidden && (
                  <div className="flex items-center gap-2">
                    <input
                      id="rememberMe"
                      name="rememberMe"
                      type="checkbox"
                      defaultChecked={!!login.rememberMe}
                      className="size-4 rounded border"
                    />
                    <Label htmlFor="rememberMe">{msg("rememberMe")}</Label>
                  </div>
                )}

                <input
                  type="hidden"
                  id="id-hidden-input"
                  name="credentialId"
                  value={auth.selectedCredential}
                />

                <Button
                  id="kc-login"
                  name="login"
                  type="submit"
                  className="w-full"
                  disabled={isLoginButtonDisabled}
                >
                  {msg("doLogIn")}
                </Button>
              </form>
            )}

            {social?.providers !== undefined && social.providers.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="text-muted-foreground text-center text-xs uppercase tracking-wide">
                  {msg("identity-provider-login-label")}
                </div>
                <div className="grid gap-2">
                  {social.providers.map((provider) => (
                    <Button
                      key={provider.alias}
                      variant="outline"
                      className="w-full justify-center"
                      asChild
                    >
                      <a id={`social-${provider.alias}`} href={provider.loginUrl}>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: kcSanitize(provider.displayName)
                          }}
                        />
                      </a>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {realm.password && realm.registrationAllowed && !registrationDisabled && (
              <div className="mt-6 text-center text-sm">
                {msg("noAccount")}{" "}
                <a className="underline underline-offset-4" href={url.registrationUrl}>
                  {msg("doRegister")}
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Template>
  );
}
