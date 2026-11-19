"use client";

import { Check, FastForward } from "lucide-react";
import type {
  CouponSelection,
  CouponSimulationState,
} from "@/store/couponStore";
import { SimulationEventCard } from "@/components/betting/SimulationEventCard";
import { SimulationPitch } from "@/components/betting/SimulationPitch";

interface SimulationPanelProps {
  selections: CouponSelection[];
  simulation: CouponSimulationState;
  onDismiss: () => void;
  onSkip: () => void;
}

function getSelectionResult(
  selection: CouponSelection,
  simulation: CouponSimulationState,
) {
  const exactKey = `${selection.matchId}:${selection.marketId}:${selection.outcomeId}:${selection.specifier || ""}`;
  return (
    simulation.selectionResultsBySelectionKey[exactKey] ??
    simulation.selectionResultsBySelectionKey[
      `${selection.matchId}:${selection.marketId}:${selection.outcomeId}:`
    ]
  );
}

export function SimulationPanel({
  selections,
  simulation,
  onDismiss,
  onSkip,
}: SimulationPanelProps) {
  const isComplete = simulation.status === "complete";
  const primarySelection =
    selections.find((selection) => selection.selectionId === simulation.primarySelectionId) ??
    selections[0];
  const primaryEvent = primarySelection
    ? simulation.eventsByMatchId[String(primarySelection.matchId)]
    : undefined;
  const showSharedPitch = selections.length > 1 && Boolean(primarySelection);
  const showTopPitch = Boolean(primarySelection) && (showSharedPitch || isComplete);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[#F5F5F4] text-white">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-4">
        <div className="mx-auto w-full max-w-[680px]">
          {showTopPitch && primarySelection ? (
            <div className="mb-3 rounded-2xl border border-white/8 bg-surface-simulation p-2.5">
              <SimulationPitch
                selection={primarySelection}
                event={primaryEvent}
                simulation={simulation}
                shared
              />
            </div>
          ) : null}

          <div className="space-y-3">
            {selections.map((selection) => (
              <SimulationEventCard
                key={selection.selectionId}
                selection={selection}
                event={simulation.eventsByMatchId[String(selection.matchId)]}
                simulation={simulation}
                result={getSelectionResult(selection, simulation)}
                showPitch={!showTopPitch}
              />
            ))}
          </div>

        </div>
      </div>

      <div className="shrink-0 border-t border-white/8 bg-[#F5F5F3] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={isComplete ? onDismiss : onSkip}
          className="mx-auto inline-flex w-full max-w-[680px] items-center justify-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-base font-bold text-text-on-orange transition active:scale-[0.99]"
        >
          {isComplete ? <Check size={18} /> : <FastForward size={18} />}
          {isComplete ? "OK" : "Skip to Results"}
        </button>
      </div>

    </div>
  );
}
