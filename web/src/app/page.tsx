import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <main className="flex w-full max-w-3xl flex-col gap-8 rounded-3xl bg-white p-12 shadow-sm">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
            App123
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
            Auth + account demo
          </h1>
          <p className="text-lg text-zinc-600">
            Register, sign in, and view your account info through the Go API.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/auth">Go to auth</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/account">View account</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
