"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

/**
 * Sign-in and sign-up share one component because they share one flow: after
 * a successful registration the user is signed straight in rather than being
 * bounced to a login form to retype what they just entered.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/account";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const isSignup = mode === "signup";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    if (isSignup) {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? ""),
          email,
          password,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? "Could not create the account.");
        setFieldErrors(body?.error?.details ?? {});
        setSubmitting(false);
        return;
      }
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      // Deliberately vague: saying which half was wrong would let someone
      // check whether an email is registered.
      setError("That email and password combination did not work.");
      setSubmitting(false);
      return;
    }

    // callbackUrl comes from the query string, so it cannot be statically typed.
    router.push(callbackUrl as Route);
    router.refresh();
  }

  return (
    <Container width="prose" className="py-20 lg:py-28">
      <div className="mx-auto max-w-md">
        <p className="eyebrow text-muted">
          {isSignup ? "Create account" : "Welcome back"}
        </p>
        <h1 className="mt-5 text-title">
          {isSignup ? "Join TRENDTIE" : "Sign in"}
        </h1>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
          {error && (
            <p role="alert" className="border border-ink p-4 text-sm">
              {error}
            </p>
          )}

          {isSignup && (
            <Field
              label="Name"
              name="name"
              required
              autoComplete="name"
              error={fieldErrors.name?.[0]}
            />
          )}

          <Field
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            error={fieldErrors.email?.[0]}
          />

          <Field
            label="Password"
            name="password"
            type="password"
            required
            autoComplete={isSignup ? "new-password" : "current-password"}
            hint={isSignup ? "At least 8 characters" : undefined}
            error={fieldErrors.password?.[0]}
          />

          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting
              ? isSignup
                ? "Creating account…"
                : "Signing in…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        <p className="mt-8 text-sm text-muted">
          {isSignup ? "Already have an account? " : "No account yet? "}
          <Link
            href={isSignup ? "/login" : "/signup"}
            className="underline-draw text-ink"
          >
            {isSignup ? "Sign in" : "Create one"}
          </Link>
        </p>
      </div>
    </Container>
  );
}
