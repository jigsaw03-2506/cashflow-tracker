import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { TrackerProvider } from "@/components/tracker-provider";

export default function TrackerLayout({ children }: { children: ReactNode }) {
  return (
    <TrackerProvider>
      <AppShell>{children}</AppShell>
    </TrackerProvider>
  );
}
