"use client";

import {
  CircleDollarSign,
  Home,
  LogOut,
  Moon,
  ReceiptText,
  RefreshCw,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { displayError, requestJson, useTracker } from "@/components/tracker-provider";

const navItems = [
  { href: "/", icon: Home, my: "ပင်မ", en: "Home" },
  { href: "/people", icon: Users, my: "လူများ", en: "People" },
  { href: "/spending", icon: ReceiptText, my: "အသုံးစာရင်း", en: "Spending" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { language, setLanguage, dark, setDark, refresh, error, setError } = useTracker();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-card bg-accent text-accent-foreground">
              <CircleDollarSign className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">
                {language === "my" ? "ငွေစာရင်း" : "My money"}
              </span>
              <span className="hidden text-xs text-muted sm:block">
                {language === "my" ? "ကိုယ်ပိုင်ငွေနှင့် အကြွေးစာရင်း" : "Balances and debts"}
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              aria-label={language === "my" ? "Switch to English" : "မြန်မာဘာသာ"}
              onClick={() => setLanguage(language === "my" ? "en" : "my")}
            >
              {language === "my" ? "EN" : "မြန်မာ"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? t(language, "light") : t(language, "dark")}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={language === "my" ? "ပြန်လည်ဖတ်ရန်" : "Refresh"}
              onClick={() => {
                setError("");
                void refresh().catch((cause) =>
                  setError(cause instanceof Error ? cause.message : t(language, "dataLoadError")),
                );
              }}
            >
              <RefreshCw className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t(language, "signOut")}
              title={t(language, "signOut")}
              onClick={() => {
                void requestJson("/api/session", { method: "DELETE" })
                  .catch(() => undefined)
                  .finally(() => router.replace("/login"));
              }}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <nav
          aria-label={language === "my" ? "စာမျက်နှာများ" : "Pages"}
          className="mx-auto flex max-w-7xl gap-1 px-4 sm:px-6"
        >
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors duration-fast",
                  active
                    ? "border-accent font-semibold text-accent"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                {language === "my" ? item.my : item.en}
              </Link>
            );
          })}
        </nav>
      </header>

      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
          <div
            role="alert"
            className="flex items-start justify-between gap-4 rounded-card border border-negative/25 bg-negative/5 px-4 py-3 text-sm text-negative"
          >
            <span>{displayError(error, language)}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setError("")}>
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
