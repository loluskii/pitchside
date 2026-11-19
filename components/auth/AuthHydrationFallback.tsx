"use client";

import { Loader2 } from "lucide-react";

export function AuthHydrationFallback() {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-center" aria-busy="true">
      <Loader2 className="size-7 animate-spin text-[var(--primary-orange)]" />
    </div>
  );
}
