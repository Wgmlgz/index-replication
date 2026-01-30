"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api/types";

const emptyForm: components["schemas"]["AuthRequest"] = {
  email: "",
  password: "",
};

export default function AuthPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loginForm, setLoginForm] = useState(emptyForm);
  const [registerForm, setRegisterForm] = useState(emptyForm);

  const loginMutation = useMutation({
    mutationFn: async (body: components["schemas"]["AuthRequest"]) => {
      const { data, error } = await api.POST("/api/v1/auth/login", { body });
      if (error) {
        throw new Error(error.message ?? "Login failed");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/account");
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (body: components["schemas"]["AuthRequest"]) => {
      const { data, error } = await api.POST("/api/v1/auth/register", { body });
      if (error) {
        throw new Error(error.message ?? "Registration failed");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/account");
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Log in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={loginForm.email}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, email: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm({ ...loginForm, password: event.target.value })
                }
              />
            </div>
            {loginMutation.isError && (
              <p className="text-sm text-red-600">
                {loginMutation.error.message}
              </p>
            )}
            <Button
              className="w-full"
              disabled={loginMutation.isPending}
              onClick={() => loginMutation.mutate(loginForm)}
            >
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm({ ...registerForm, email: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm({
                    ...registerForm,
                    password: event.target.value,
                  })
                }
              />
            </div>
            {registerMutation.isError && (
              <p className="text-sm text-red-600">
                {registerMutation.error.message}
              </p>
            )}
            <Button
              className="w-full"
              disabled={registerMutation.isPending}
              onClick={() => registerMutation.mutate(registerForm)}
            >
              {registerMutation.isPending ? "Creating..." : "Create account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
