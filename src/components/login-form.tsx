"use client";

import { CircleDollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { t, type Language } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { displayError, requestJson } from "@/components/tracker-provider";

/** Password screen shown before the tracker; reuses the tracker's saved language and theme. */
export function LoginForm({ next }: { next: string }) {
  const [language, setLanguage] = useState<Language>("my");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const languageSetting = localStorage.getItem("cashflow-language");
        if (languageSetting === "my" || languageSetting === "en") setLanguage(languageSetting);
        document.documentElement.classList.toggle(
          "dark",
          localStorage.getItem("cashflow-theme") === "dark",
        );
      } catch {
        // Preferences are a convenience; the defaults work without storage.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const switchLanguage = () => {
    const nextLanguage = language === "my" ? "en" : "my";
    setLanguage(nextLanguage);
    try {
      localStorage.setItem("cashflow-language", nextLanguage);
    } catch {
      // Preferences are a convenience; the defaults work without storage.
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestJson("/api/session", { method: "POST", body: JSON.stringify({ password }) });
      router.replace(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(language, "dataLoadError"));
      setPassword("");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-canvas text-ink">
      <div className="flex justify-end px-4 pt-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          aria-label={language === "my" ? "Switch to English" : "မြန်မာဘာသာ"}
          onClick={switchLanguage}
        >
          {language === "my" ? "EN" : "မြန်မာ"}
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-sm p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-card bg-accent text-accent-foreground">
              <CircleDollarSign className="size-5" />
            </span>
            <h1 className="font-semibold">{language === "my" ? "ငွေစာရင်း" : "My money"}</h1>
          </div>
          <p className="mt-4 text-sm text-muted">{t(language, "signInPrompt")}</p>

          <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
            <label className="flex flex-col gap-2 text-sm">
              {t(language, "password")}
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "login-error" : undefined}
              />
            </label>
            {error && (
              <p id="login-error" role="alert" className="text-sm text-negative">
                {displayError(error, language)}
              </p>
            )}
            <Button type="submit" disabled={submitting || !password}>
              {submitting ? t(language, "signingIn") : t(language, "signIn")}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
