"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import api from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountPage() {
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/me");
      if (error) {
        throw new Error(error.message ?? "Not authenticated");
      }
      return data.user;
    },
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/v1/auth/logout");
      if (error) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Not signed in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-600">
              Please sign in to view your account details.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth">Go to auth</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Email</p>
            <p className="text-sm font-medium text-zinc-900">
              {meQuery.data.email}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">User ID</p>
            <p className="text-sm font-medium text-zinc-900">
              {meQuery.data.id}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Created
            </p>
            <p className="text-sm font-medium text-zinc-900">
              {new Date(meQuery.data.createdAt).toLocaleString()}
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Signing out..." : "Sign out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
