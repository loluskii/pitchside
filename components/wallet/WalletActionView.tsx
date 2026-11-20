"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Building2, Check, CreditCard, Hash, LogIn, ShieldCheck, Zap } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { walletApi } from "@/lib/api/wallet";
import { photo } from "@/lib/media";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

type Mode = "deposit" | "withdraw";

const DEPOSIT_METHODS = [
  { id: "instant", label: "Wallet", note: "Instant", icon: Zap },
  { id: "transfer", label: "Transfer", note: "Bank app", icon: Building2 },
  { id: "card", label: "Card", note: "Debit card", icon: CreditCard },
  { id: "ussd", label: "USSD", note: "Any phone", icon: Hash },
] as const;

const PRESETS: Record<Mode, number[]> = {
  deposit: [1000, 5000, 10000, 25000, 50000, 100000],
  withdraw: [1000, 2500, 5000, 10000, 25000, 50000],
};

function naira(value: number) {
  return `₦${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type WithdrawalRow = { id: number; amount: number; created: string; reference: string; status: string };

export function WalletActionView({ mode }: { mode: Mode }) {
  const isDeposit = mode === "deposit";
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const balance = useUserStore((state) => state.currentUser?.availableBalance ?? 0);
  const refresh = useUserStore((state) => state.refreshCurrentUser);
  const queryClient = useQueryClient();
  const { openLogin } = useAuthModal();

  const [amount, setAmount] = useState(isDeposit ? 5000 : 2500);
  const [method, setMethod] = useState<(typeof DEPOSIT_METHODS)[number]["id"]>("instant");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: withdrawalsPayload } = useQuery({
    queryKey: ["wallet", "play-withdrawals"],
    queryFn: () => walletApi.getPendingWithdrawals(),
    enabled: !isDeposit && hasHydrated && isAuthenticated,
    refetchInterval: 10_000,
  });
  const withdrawals = ((withdrawalsPayload as { data?: WithdrawalRow[] } | undefined)?.data ?? []).filter(
    (row) => row && typeof row === "object" && "reference" in row,
  );

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = (isDeposit
        ? await walletApi.initiateDeposit({ amount, channel: method })
        : await walletApi.withdraw({ amount })) as { status_code?: number; status_description?: string };
      if (response.status_code && response.status_code !== 200) {
        setMessage({ ok: false, text: response.status_description ?? "That didn't go through." });
      } else {
        setMessage({
          ok: true,
          text: isDeposit ? `${naira(amount)} added to your balance.` : `Withdrawal of ${naira(amount)} requested.`,
        });
        await refresh().catch(() => undefined);
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      }
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "That didn't go through." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="-mx-3 -mt-3 flex flex-col">
      <section className="relative overflow-hidden bg-[var(--ink)] px-4 pb-6 pt-5 text-[var(--chalk)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(isDeposit ? "stadiumDusk" : "crowd", 900, 420)}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--ink)]" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--lime)] text-[var(--ink)]">
              {isDeposit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            </span>
            <h1 className="font-heading text-2xl font-extrabold">{isDeposit ? "Add funds" : "Withdraw"}</h1>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--chalk)]/55">Available balance</p>
          <p className="font-heading text-4xl font-extrabold tabular-nums">{naira(balance)}</p>
          <div className="mt-3 flex gap-2 text-xs">
            <Link
              href={isDeposit ? "/withdraw" : "/deposit"}
              className="rounded-full bg-[rgba(242,241,236,0.12)] px-3 py-1.5 font-semibold"
            >
              {isDeposit ? "Withdraw instead" : "Add funds instead"}
            </Link>
            <Link href="/transactions" className="rounded-full bg-[rgba(242,241,236,0.12)] px-3 py-1.5 font-semibold">
              History
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-t-[28px] bg-[var(--chalk)] px-3 pb-28 pt-5 -mt-4 relative">
        {hasHydrated && !isAuthenticated ? (
          <div className="rounded-3xl bg-[var(--paper)] p-5 text-center">
            <p className="font-heading text-lg font-bold text-[var(--ink)]">Log in to continue</p>
            <p className="mt-1 text-sm text-[var(--ink)]/60">You need to be logged in to add funds or withdraw.</p>
            <button
              type="button"
              onClick={() => openLogin(`/${mode}`)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--chalk)]"
            >
              <LogIn size={16} /> Log in
            </button>
          </div>
        ) : (
          <>
            {isDeposit ? (
              <div>
                <p className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink)]/50">Method</p>
                <div className="grid grid-cols-4 gap-2">
                  {DEPOSIT_METHODS.map(({ id, label, note, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMethod(id)}
                      className={`relative flex flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-center transition ${
                        method === id
                          ? "border-[var(--pitch)] bg-[var(--paper)] shadow-[0_0_0_2px_var(--pitch)]"
                          : "border-[var(--ink)]/10 bg-[var(--paper)]"
                      }`}
                    >
                      {method === id ? (
                        <Check size={12} className="absolute right-1.5 top-1.5 text-[var(--pitch)]" />
                      ) : null}
                      <Icon size={20} className="text-[var(--pitch)]" />
                      <span className="text-xs font-bold text-[var(--ink)]">{label}</span>
                      <span className="text-[9px] leading-3 text-[var(--ink)]/50">{note}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--paper)] p-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pitch)]/10 text-[var(--pitch)]">
                  <Building2 size={20} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--ink)]">Linked payout account</p>
                  <p className="text-xs text-[var(--ink)]/55">Pitchside Wallet · ••••2026</p>
                </div>
                <ShieldCheck size={18} className="text-[var(--pitch)]" />
              </div>
            )}

            <div className="rounded-3xl bg-[var(--paper)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink)]/50">Amount</p>
              <label className="mt-1 flex items-baseline gap-1 border-b-2 border-[var(--ink)]/10 pb-2 focus-within:border-[var(--pitch)]">
                <span className="font-heading text-2xl font-bold text-[var(--ink)]/40">₦</span>
                <input
                  inputMode="numeric"
                  value={amount ? amount.toLocaleString("en-US") : ""}
                  onChange={(event) => setAmount(Number(event.target.value.replace(/\D/g, "")) || 0)}
                  className="w-full bg-transparent font-heading text-4xl font-extrabold tabular-nums text-[var(--ink)] outline-none"
                  aria-label="Amount"
                  placeholder="0"
                />
              </label>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {PRESETS[mode].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset)}
                    className={`h-9 rounded-xl text-sm font-bold transition ${
                      amount === preset ? "bg-[var(--ink)] text-[var(--chalk)]" : "bg-[var(--chalk)] text-[var(--ink)]"
                    }`}
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>
              {!isDeposit ? (
                <button
                  type="button"
                  onClick={() => setAmount(Math.floor(balance))}
                  className="mt-2 text-xs font-bold text-[var(--pitch)]"
                >
                  Withdraw all ({naira(Math.floor(balance))})
                </button>
              ) : null}
            </div>

            {message ? (
              <p
                className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  message.ok ? "bg-[var(--pitch)] text-[var(--chalk)]" : "bg-[var(--flare)]/12 text-[var(--flare)]"
                }`}
              >
                {message.text}
              </p>
            ) : null}

            <button
              type="button"
              onClick={submit}
              disabled={busy || amount <= 0}
              className="h-14 w-full rounded-2xl bg-[var(--lime)] font-heading text-lg font-extrabold text-[var(--ink)] disabled:opacity-50"
            >
              {busy ? "Processing…" : isDeposit ? `Add ${naira(amount)}` : `Withdraw ${naira(amount)}`}
            </button>
            <p className="px-1 text-center text-[11px] text-[var(--ink)]/45">
              {isDeposit ? "Minimum deposit ₦100" : "Minimum withdrawal ₦500"}
            </p>

            {!isDeposit && withdrawals.length ? (
              <div className="rounded-3xl bg-[var(--paper)] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink)]/50">Recent payouts</p>
                <ul className="divide-y divide-[var(--ink)]/8">
                  {withdrawals.slice(0, 6).map((row) => (
                    <li key={row.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="font-mono text-sm font-bold text-[var(--ink)]">{naira(row.amount)}</p>
                        <p className="text-[11px] text-[var(--ink)]/50">
                          {row.reference} · {new Date(row.created).toLocaleTimeString("en-NG", { timeStyle: "short" })}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          row.status === "Paid" ? "bg-[var(--pitch)]/12 text-[var(--pitch)]" : "bg-[var(--amber)]/20 text-[#9A6A00]"
                        }`}
                      >
                        {row.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
