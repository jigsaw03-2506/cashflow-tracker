import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ငွေစာရင်း | Debt Tracker",
  description: "A private Myanmar-first tracker for account balances and personal debts.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="my" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
