"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Account, HistoryTransaction, Loan, LoanRepayment, Person } from "@/lib/finance";
import { t, type Language } from "@/lib/i18n";

export type TrackerData = {
  accounts: Account[];
  people: Person[];
  loans: Loan[];
  repayments: LoanRepayment[];
  transactions?: HistoryTransaction[];
};

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  // The session expired or was signed out elsewhere; a wrong password on /api/session is shown in place.
  if (response.status === 401 && path !== "/api/session") {
    // A full reload drops the loaded data; this helper runs outside components, so no router.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

const burmeseErrors: Record<string, string> = {
  "Amount cannot be less than what has already been repaid":
    "ပြန်ဆပ်ပြီးသားငွေထက် နည်းအောင် ပြင်လို့မရပါ။",
  "Repayment cannot exceed the outstanding balance":
    "ပြန်ဆပ်ငွေက ကျန်ငွေထက် များလို့မရပါ။",
  "Repayment must be positive and cannot exceed the outstanding balance":
    "ပြန်ဆပ်ငွေက ကျန်ငွေထက် များလို့မရပါ။",
  "Selected account is unavailable": "ရွေးထားသော အကောင့်ကို သုံးလို့မရပါ။",
  "Record was not found": "မှတ်တမ်း မတွေ့ပါ။ Page ကို refresh လုပ်ပါ။",
  "Database update needed: run the latest SQL file in Supabase.":
    "Supabase မှာ SQL ဖိုင်အသစ်ကို run ရန် လိုပါသည်။",
  "Wrong password.": "စကားဝှက် မှားနေပါသည်။",
  "Sign-in is not set up. Follow the setup instructions.":
    "ဝင်ရန်စနစ်ကို မတပ်ဆင်ရသေးပါ။ README ရှိ လမ်းညွှန်ကို လိုက်နာပါ။",
};

export function displayError(error: string, language: Language) {
  if (language !== "my") return error;
  if (error.startsWith("Database setup is incomplete.")) return t(language, "apiNotConfigured");
  return burmeseErrors[error] ?? error;
}

type TrackerContextValue = {
  data: TrackerData;
  loading: boolean;
  refresh: () => Promise<void>;
  language: Language;
  setLanguage: (language: Language) => void;
  dark: boolean;
  setDark: (dark: boolean) => void;
  /** Shared error message, shown at the top of every page. */
  error: string;
  setError: (error: string) => void;
};

const TrackerContext = createContext<TrackerContextValue | null>(null);

/** Loads the tracker data once and keeps language and theme preferences for every page. */
export function TrackerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TrackerData>({
    accounts: [],
    people: [],
    loans: [],
    repayments: [],
  });
  const [language, setLanguage] = useState<Language>("my");
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const result = await requestJson<TrackerData>("/api/dashboard");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const languageSetting = localStorage.getItem("cashflow-language");
        const themeSetting = localStorage.getItem("cashflow-theme");
        if (languageSetting === "my" || languageSetting === "en") setLanguage(languageSetting);
        setDark(themeSetting === "dark");
      } catch {
        setError("Browser storage is unavailable; language and theme preferences will not persist.");
      } finally {
        setPreferencesReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.lang = language;
    if (!preferencesReady) return;
    try {
      localStorage.setItem("cashflow-theme", dark ? "dark" : "light");
      localStorage.setItem("cashflow-language", language);
    } catch {
      window.setTimeout(
        () => setError("Browser storage is unavailable; language and theme preferences will not persist."),
        0,
      );
    }
  }, [dark, language, preferencesReady]);

  useEffect(() => {
    let mounted = true;
    const timer = window.setTimeout(() => {
      void refresh()
        .catch((cause) => {
          if (mounted) setError(cause instanceof Error ? cause.message : t(language, "dataLoadError"));
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 0);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
    // Load once; language only affects the fallback error text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return (
    <TrackerContext.Provider
      value={{ data, loading, refresh, language, setLanguage, dark, setDark, error, setError }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const value = useContext(TrackerContext);
  if (!value) throw new Error("useTracker must be used inside TrackerProvider.");
  return value;
}
