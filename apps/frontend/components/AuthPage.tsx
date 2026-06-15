"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { AxiosError } from "axios";
import { getPasswordRequirementResults } from "@repo/common/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signin, signup } from "@/draw/http";

type ApiError = {
  message?: string;
  errors?: string[];
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getApiErrorMessage(error: unknown) {
  const apiError = error as AxiosError<ApiError>;
  return apiError.response?.data?.message ?? "Something went wrong. Try again.";
}

export function AuthPage({ isSignin }: { isSignin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const passwordRequirements = useMemo(
    () => getPasswordRequirementResults(password),
    [password]
  );
  const emailIsValid = isValidEmail(email);
  const nameIsValid = isSignin || name.trim().length > 0;
  const passwordIsValid = isSignin
    ? password.length > 0
    : passwordRequirements.every((requirement) => requirement.isMet);
  const formIsValid = emailIsValid && nameIsValid && passwordIsValid;
  const showEmailError = submitted || email.length > 0;
  const showNameError = !isSignin && (submitted || name.length > 0);
  const showSigninPasswordError = isSignin && submitted;

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setSubmitted(true);

    if (!formIsValid) {
      setError("Fix the highlighted fields before continuing.");
      return;
    }

    setLoading(true);
    try {
      const token = isSignin
        ? await signin(email, password)
        : await signup(email, password, name);
      localStorage.setItem("token", token);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-secondary-background border-2 border-border shadow-shadow rounded-base p-8 w-full max-w-md"
      >
        <h1 className="text-2xl font-heading mb-1">
          {isSignin ? "Welcome back" : "Create an account"}
        </h1>
        <p className="text-sm font-base text-foreground/60 mb-6">
          {isSignin
            ? "Sign in to access your rooms."
            : "Sign up and start drawing for free."}
        </p>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {!isSignin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!nameIsValid}
              />
              {showNameError && !nameIsValid ? (
                <p className="text-xs font-base text-red-600">
                  Name is required. It does not need to be unique.
                </p>
              ) : (
                <p className="text-xs font-base text-foreground/50">
                  Names can be shared by multiple people.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!emailIsValid}
            />
            {showEmailError && !emailIsValid ? (
                <p className="text-xs font-base text-red-600">
                  Enter a valid email address.
                </p>
            ) : (
                <p className="text-xs font-base text-foreground/50">
                  Email must be a valid address.
                </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!passwordIsValid}
            />
            {isSignin ? (
                <p className={`text-xs font-base ${
                  showSigninPasswordError && !passwordIsValid
                    ? "text-red-600"
                    : "text-foreground/50"
                }`}>
                  Password is required.
                </p>
            ) : (
              <div className="rounded-base border-2 border-border bg-background px-3 py-2">
                <p className="mb-1 text-xs font-heading">Password requirements</p>
                <ul className="space-y-1">
                  {passwordRequirements.map((requirement) => (
                    <li
                      key={requirement.id}
                      className={`text-xs font-base ${
                        requirement.isMet ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {requirement.isMet ? "Met: " : "Missing: "}
                      {requirement.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm font-base text-red-600 border-2 border-red-600 rounded-base px-3 py-2 bg-red-50">
              {error}
            </p>
          )}

          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              className="w-full"
              type="submit"
              disabled={loading || !formIsValid}
            >
              {loading
                ? "Please wait..."
                : isSignin
                ? "Sign in"
                : "Create account"}
            </Button>
          </motion.div>
        </form>

        <p className="text-sm font-base text-foreground/60 mt-6 text-center">
          {isSignin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            className="font-heading underline underline-offset-2 text-foreground hover:text-main transition-colors"
            onClick={() => router.push(isSignin ? "/signup" : "/signin")}
          >
            {isSignin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
