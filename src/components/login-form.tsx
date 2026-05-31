"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type LoginFormProps = {
  callbackUrl: string;
};

export function LoginForm({ callbackUrl }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("admin@mindhatch.local");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const csrfResponse = await fetch("/api/auth/csrf");
    const csrfPayload = (await csrfResponse.json()) as { csrfToken?: string };

    if (!csrfResponse.ok || !csrfPayload.csrfToken) {
      setIsSubmitting(false);
      setError("Unable to start sign in.");
      return;
    }

    const response = await fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Auth-Return-Redirect": "1",
      },
      body: new URLSearchParams({
        csrfToken: csrfPayload.csrfToken,
        email,
        password,
        callbackUrl,
        json: "true",
      }),
    });

    const payload = (await response.json()) as { url?: string };

    setIsSubmitting(false);

    if (!response.ok || !payload.url) {
      setError("Invalid email or password.");
      return;
    }

    router.push(payload.url);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-12">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">Authentication</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Login</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">Use your staff account to open the terminal and view role-based screens.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
              required
            />
          </label>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Continue"}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          Need an account?{" "}
          <Link href="/auth/signup" className="font-semibold text-cyan-700">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}