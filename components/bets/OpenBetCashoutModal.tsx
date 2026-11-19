"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

export function OpenBetCashoutModal({
  busy,
  currencyLabel = "NGN",
  errorMessage,
  maxAmount,
  onClose,
  onConfirm,
  potentialWinLabel,
  stakeLabel,
}: {
  busy: boolean;
  currencyLabel?: string;
  errorMessage: string;
  maxAmount: number;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  potentialWinLabel: string;
  stakeLabel: string;
}) {
  const safeMaxAmount = Number.isFinite(maxAmount) && maxAmount > 0 ? maxAmount : 0;
  const minAmount = safeMaxAmount > 0 ? Math.min(0.1, safeMaxAmount) : 0;
  const [cashoutRatio, setCashoutRatio] = useState(1);
  const isAvailable = safeMaxAmount > 0;
  const selectedAmount = isAvailable
    ? Number((minAmount + cashoutRatio * (safeMaxAmount - minAmount)).toFixed(2))
    : 0;
  const sliderPercent = !isAvailable
    ? 0
    : safeMaxAmount <= minAmount
      ? 100
      : Math.min(100, Math.max(0, ((selectedAmount - minAmount) / (safeMaxAmount - minAmount)) * 100));
  const cashoutTitle = selectedAmount >= safeMaxAmount ? "Full Cashout" : "Partial Cashout";
  const selectedAmountLabel = formatCashoutAmount(currencyLabel, selectedAmount);
  const maxAmountLabel = formatCashoutAmount(currencyLabel, safeMaxAmount);
  const minAmountLabel = formatCashoutAmount(currencyLabel, minAmount);

  return (
    <div className="fixed inset-0 z-[1300]">
      <button
        type="button"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 bg-black/70"
        aria-label="Close cashout confirmation"
      />

      <div className="cashout-modal-panel absolute inset-x-4 overflow-y-auto rounded-3xl border border-white/8 bg-surface-elevated p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-md font-semibold uppercase tracking-[0.16em] text-[var(--primary-orange)]">
              Cashout
            </p>
            <h3 className="mt-2 text-4xl font-black text-white">{selectedAmountLabel}</h3>
          </div>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            className="rounded-full border border-white/10 p-2 text-white/70 transition hover:text-white"
            aria-label="Close cashout confirmation"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-md">
          <div className="rounded-2xl bg-white/[0.04] p-3">
            <p className="text-white/45">Stake</p>
            <p className="mt-2 text-xl font-bold text-white">{stakeLabel}</p>
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-3">
            <p className="text-white/45">Pot. Win</p>
            <p className="mt-2 text-xl font-bold text-white">{potentialWinLabel}</p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/8 bg-surface-input p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-md font-bold text-white/64">{cashoutTitle}</span>
            <span className="text-xl font-black text-white">{selectedAmountLabel}</span>
          </div>
          <div className="relative mt-5 h-8">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-[var(--lime)]"
                style={{ width: `${sliderPercent}%` }}
              />
            </div>
            <input
              aria-label="Cashout amount"
              className="absolute inset-0 h-8 w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-not-allowed"
              disabled={!isAvailable || busy}
              max={safeMaxAmount}
              min={minAmount}
              onChange={(event) => {
                const nextAmount = Number(event.target.value);
                if (!Number.isFinite(nextAmount) || safeMaxAmount <= minAmount) {
                  setCashoutRatio(1);
                  return;
                }
                setCashoutRatio(Math.min(1, Math.max(0, (nextAmount - minAmount) / (safeMaxAmount - minAmount))));
              }}
              step="0.01"
              type="range"
              value={selectedAmount}
            />
            <div
              aria-hidden="true"
              className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--primary-orange)] bg-white shadow-sm"
              style={{ left: `${sliderPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-base font-semibold text-white/45">
            <span>Min {minAmountLabel}</span>
            <span>Max {maxAmountLabel}</span>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-border-error bg-surface-error px-4 py-3 text-md text-[#D22B34]">
            {errorMessage}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => onConfirm(selectedAmount)}
          disabled={busy || !isAvailable}
          className="app-button app-button-primary mt-5 w-full font-black"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {busy ? "Submitting cashout" : `Confirm ${selectedAmountLabel}`}
        </button>
      </div>
    </div>
  );
}

function formatCashoutAmount(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}
