"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const SPORTRADAR_SCRIPT_ID = "sr-tracker";
const SPORTRADAR_SCRIPT_SOURCE =
  "https://widgets.sir.sportradar.com/9a7545262c211f21e8cdaf98d9b86856/widgetloader";

type SirFunction = (
  action: "addWidget" | "removeWidget",
  selector: string,
  widgetName: string,
  options?: Record<string, unknown>,
) => void;

type SirQueue = SirFunction & {
  l?: number;
  o?: Record<string, unknown>;
  q?: unknown[];
};

declare global {
  interface Window {
    SIR?: SirQueue;
  }
}

function ensureSportradarScript() {
  if (typeof window === "undefined") return;

  if (!window.SIR) {
    const queue = ((...args: unknown[]) => {
      queue.q = queue.q || [];
      queue.q.push(args);
    }) as SirQueue;

    queue.q = [];
    queue.l = Date.now();
    queue.o = { language: "en" };
    window.SIR = queue;
  }

  if (document.getElementById(SPORTRADAR_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.async = true;
  script.id = SPORTRADAR_SCRIPT_ID;
  script.src = SPORTRADAR_SCRIPT_SOURCE;
  script.setAttribute("n", "SIR");
  document.body.appendChild(script);
}

export function SportradarWidget({
  className,
  matchId,
  title = "Match tracker",
  widgetName,
}: {
  className?: string;
  matchId: string | number;
  title?: string;
  widgetName: "headToHead.standalone" | "match.lmtPlus" | "match.Statistics";
}) {
  const reactId = useId();
  const widgetId = useMemo(() => `sr-widget-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const matchIdValue = String(matchId ?? "").trim();
  const widgetKey = `${widgetName}:${matchIdValue}:${widgetId}`;
  const [failedWidgetKey, setFailedWidgetKey] = useState("");
  const failed = failedWidgetKey === widgetKey;

  useEffect(() => {
    if (!matchIdValue) {
      return;
    }

    ensureSportradarScript();

    const selector = `[data-sr-widget-id="${widgetId}"]`;
    const timeout = window.setTimeout(() => {
      try {
        window.SIR?.("addWidget", selector, widgetName, { matchId: matchIdValue });
      } catch {
        setFailedWidgetKey(widgetKey);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeout);
      try {
        window.SIR?.("removeWidget", selector, widgetName);
      } catch {
        // Sportradar cleanup is best-effort; the container is also unmounted.
      }
    };
  }, [matchIdValue, widgetId, widgetKey, widgetName]);

  if (!matchIdValue || failed) {
    return (
      <div className={cn("rounded-2xl border border-white/8 bg-surface-elevated px-4 py-8 text-center", className)}>
        <p className="text-xl font-bold text-white">{title} unavailable</p>
        <p className="mt-2 text-md leading-6 text-white/52">
          Match tracker data could not be loaded for this fixture.
        </p>
      </div>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-white/8 bg-surface-elevated", className)}>
      <div
        data-sr-widget-id={widgetId}
        className="h-full bg-surface-simulation px-2 py-3"
      >
        <div className="flex min-h-[220px] items-center justify-center">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/12 border-t-[var(--primary-orange)]" />
        </div>
      </div>
    </section>
  );
}
