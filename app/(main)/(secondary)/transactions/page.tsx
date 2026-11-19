"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronRight, LogIn, X } from "lucide-react";
import { AuthHydrationFallback } from "@/components/auth/AuthHydrationFallback";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { CLIENT_ID } from "@/lib/api/config";
import { useTransactions } from "@/lib/query/hooks/useWallet";
import { useAuthStore } from "@/store/authStore";

type TransactionItem = {
  amount?: number | string;
  description?: string;
  id?: string | number;
  status?: number | string;
  subject?: string;
  transactionDate?: string;
  type?: string;
};

type TransactionsResponse = {
  data?: TransactionItem[];
};

const DATE_FILTERS = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "thirty", label: "Last 30 days" },
  { id: "custom", label: "Custom range" },
] as const;

type DateFilterId = (typeof DATE_FILTERS)[number]["id"];
type DateRangeValue = {
  end: string;
  start: string;
};

function formatAmount(value: number | string | undefined, type?: string) {
  const amount = Number(value ?? 0);
  const prefix = String(type ?? "").toLowerCase() === "credit" ? "+" : "-";
  return `${prefix}NGN ${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(value: number | string | undefined) {
  const normalized = String(value ?? "");
  if (normalized === "1") return "Successful";
  if (normalized === "0") return "Pending";
  if (normalized === "2") return "Failed";
  if (normalized === "3") return "Rejected";
  if (normalized === "4") return "Cancelled";
  return "Unknown";
}

function getStatusClass(value: number | string | undefined) {
  const normalized = String(value ?? "");
  if (normalized === "1") return "text-text-success";
  if (normalized === "0") return "text-[#0C7A4D]";
  return "text-text-error-light";
}

function formatTransactionDate(value: string | undefined) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateFilterRange(filterId: DateFilterId, customRange: DateRangeValue) {
  if (filterId === "all") return {};

  const format = (date: Date) => date.toISOString().split("T")[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (filterId === "today") {
    return { end: format(today), start: format(today) };
  }

  if (filterId === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { end: format(today), start: format(start) };
  }

  if (filterId === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { end: format(today), start: format(start) };
  }

  if (filterId === "custom") {
    if (customRange.start && customRange.end) {
      return { end: customRange.end, start: customRange.start };
    }
    return {};
  }

  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { end: format(today), start: format(start) };
}

function formatDrawerDateLabel(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function BottomDrawer({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-menu)]">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-black/72"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[72dvh] flex-col overflow-hidden rounded-t-2xl border-t border-white/8 bg-surface-dialog px-4 pt-2 shadow-sheet">
        <div className="mx-auto h-1 w-10 rounded-full bg-white/14" />
        <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
          <h3 className="text-lg font-black text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-1.5 text-white/72"
            aria-label={`Close ${title}`}
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { openCreateAccount, openLogin } = useAuthModal();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterId>("week");
  const [customDateRange, setCustomDateRange] = useState<DateRangeValue>({ end: "", start: "" });
  const [draftCustomDateRange, setDraftCustomDateRange] = useState<DateRangeValue>({
    end: "",
    start: "",
  });
  const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
  const [dateDrawerView, setDateDrawerView] = useState<"custom" | "presets">("presets");
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);
  const dateRange = useMemo(
    () => formatDateFilterRange(selectedDateFilter, customDateRange),
    [customDateRange, selectedDateFilter],
  );
  const selectedDateLabel =
    selectedDateFilter === "custom" && dateRange.start && dateRange.end
      ? `${formatDrawerDateLabel(dateRange.start)} - ${formatDrawerDateLabel(dateRange.end)}`
      : DATE_FILTERS.find((filter) => filter.id === selectedDateFilter)?.label ?? "Date range";
  const isDraftCustomRangeInvalid =
    !draftCustomDateRange.start ||
    !draftCustomDateRange.end ||
    new Date(draftCustomDateRange.end) < new Date(draftCustomDateRange.start);

  const queryParams = useMemo(
    () => ({
      clientId: CLIENT_ID,
      page: 1,
      ...(dateRange.end ? { endDate: dateRange.end } : {}),
      ...(dateRange.start ? { startDate: dateRange.start } : {}),
    }),
    [dateRange.end, dateRange.start],
  );

  const { data, error, isError, isLoading } = useTransactions(queryParams, authHasHydrated && isAuthenticated);
  const transactions = ((data as TransactionsResponse | undefined)?.data ?? []).filter(Boolean);

  return (
    <div className="space-y-4 py-4 pb-8">
      {!authHasHydrated ? (
        <AuthHydrationFallback />
      ) : !isAuthenticated ? (
        <section className="rounded-2xl border border-white/6 bg-surface-elevated p-5">
          <div className="flex items-start gap-3">
            <span className="app-icon-box text-text-blue">
              <LogIn className="app-icon" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black leading-6 text-white">Log in to view transactions</h2>
              <p className="mt-2 text-sm leading-5 text-[var(--text-dim)]">
                Transaction history is only available to authenticated users.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => openLogin("/transactions")}
                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-[var(--lime)] px-3 py-2 text-sm font-semibold text-white"
                >
                  Log in
                  <ChevronRight className="app-icon" />
                </button>
                <button
                  type="button"
                  onClick={() => openCreateAccount("/transactions")}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold text-white/80"
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setDateDrawerView("presets");
                setDateDrawerOpen(true);
              }}
              className="inline-flex min-h-8 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-bold text-white/80"
            >
              <CalendarDays className="app-icon text-[var(--primary-orange)]" />
              {selectedDateLabel}
            </button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`transaction-skeleton-${index}`}
                  className="animate-pulse rounded-2xl border border-white/6 bg-surface-elevated p-4"
                >
                  <div className="h-4 w-1/2 rounded bg-white/5" />
                  <div className="mt-3 h-3 w-full rounded bg-white/5" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-border-error bg-surface-error px-4 py-10 text-center">
              <p className="text-lg font-black text-white">Unable to load transactions</p>
              <p className="mt-2 text-sm leading-5 text-text-error">
                {error instanceof Error ? error.message : "The service returned an unexpected response."}
              </p>
            </div>
          ) : transactions.length ? (
            <div className="space-y-3">
              {transactions.map((transaction, index) => (
                <button
                  key={String(transaction.id ?? `${transaction.subject}-${index}`)}
                  type="button"
                  onClick={() => setSelectedTransaction(transaction)}
                  className="w-full rounded-2xl border border-white/6 bg-surface-elevated p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold leading-5 text-white">
                        {transaction.subject ?? "Transaction"}
                      </p>
                      <p className="app-text-caption mt-1 text-[var(--text-dim)]">
                        {formatTransactionDate(transaction.transactionDate)}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-base font-black leading-5 text-white">
                      {formatAmount(transaction.amount, transaction.type)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className={`app-text-caption font-semibold ${getStatusClass(transaction.status)}`}>
                      {formatStatus(transaction.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
              <p className="text-lg font-black text-white">No transactions yet</p>
              <p className="mt-2 text-sm leading-5 text-[var(--text-dim)]">
                Deposits, withdrawals, and bet-related activity will appear here.
              </p>
            </div>
          )}

          <BottomDrawer
            open={dateDrawerOpen}
            onClose={() => setDateDrawerOpen(false)}
            title={dateDrawerView === "custom" ? "Custom Date" : "Date range"}
          >
            {dateDrawerView === "presets" ? (
              <div className="grid grid-cols-2 gap-2">
                {DATE_FILTERS.map((option) => {
                  const selected = selectedDateFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (option.id === "custom") {
                          setDraftCustomDateRange(customDateRange);
                          setDateDrawerView("custom");
                          return;
                        }

                        setSelectedDateFilter(option.id);
                      }}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                        selected
                          ? "border-[rgba(12, 122, 77, 0.35)] bg-[rgba(203, 234, 78, 0.12)] text-white"
                          : "border-white/8 bg-surface-elevated text-white/82"
                      }`}
                    >
                      <span className="app-text-caption truncate font-semibold">{option.label}</span>
                      {selected ? <Check className="app-icon shrink-0 text-[var(--primary-orange)]" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-surface-elevated p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-2">
                    <span className="app-text-caption font-semibold uppercase tracking-[0.12em] text-white/45">
                      Start date
                    </span>
                    <input
                      type="date"
                      value={draftCustomDateRange.start}
                      onChange={(event) =>
                        setDraftCustomDateRange((current) => ({
                          ...current,
                          start: event.target.value,
                        }))
                      }
                      className="app-input bg-surface-simulation font-semibold"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="app-text-caption font-semibold uppercase tracking-[0.12em] text-white/45">
                      End date
                    </span>
                    <input
                      type="date"
                      value={draftCustomDateRange.end}
                      onChange={(event) =>
                        setDraftCustomDateRange((current) => ({
                          ...current,
                          end: event.target.value,
                        }))
                      }
                      className="app-input bg-surface-simulation font-semibold"
                    />
                  </label>
                </div>

                <p className="app-text-caption mt-3 text-white/52">
                  {draftCustomDateRange.start && draftCustomDateRange.end
                    ? `${formatDrawerDateLabel(draftCustomDateRange.start)} to ${formatDrawerDateLabel(
                        draftCustomDateRange.end,
                      )}`
                    : "Pick a start and end date to filter transactions."}
                </p>

                {isDraftCustomRangeInvalid ? (
                  <p className="app-text-caption mt-2 text-text-error-light">
                    Select both dates, and make sure the end date is not before the start date.
                  </p>
                ) : null}
              </div>
            )}

            <div className="sticky bottom-0 -mx-4 mt-3 grid grid-cols-2 gap-3 border-t border-white/8 bg-surface-dialog px-4 pb-1 pt-3">
              <button
                type="button"
                onClick={() => {
                  if (dateDrawerView === "custom") {
                    setDateDrawerView("presets");
                    return;
                  }

                  setSelectedDateFilter("week");
                  setCustomDateRange({ end: "", start: "" });
                  setDateDrawerOpen(false);
                }}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80"
              >
                {dateDrawerView === "custom" ? "Back" : "Reset"}
              </button>
              <button
                type="button"
                disabled={dateDrawerView === "custom" && isDraftCustomRangeInvalid}
                onClick={() => {
                  if (dateDrawerView === "custom") {
                    setCustomDateRange(draftCustomDateRange);
                    setSelectedDateFilter("custom");
                    setDateDrawerOpen(false);
                    setDateDrawerView("presets");
                    return;
                  }

                  setDateDrawerOpen(false);
                }}
                className="rounded-lg bg-[var(--lime)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {dateDrawerView === "custom" ? "Apply" : "Done"}
              </button>
            </div>
          </BottomDrawer>
        </>
      )}

      {selectedTransaction ? (
        <div className="fixed inset-0 z-[var(--z-menu)] flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close transaction detail"
            className="absolute inset-0 bg-black/70"
            onClick={() => setSelectedTransaction(null)}
          />
          <div className="relative w-full max-w-[380px] rounded-3xl border border-white/8 bg-surface-dialog p-5 shadow-xl">
            <button
              type="button"
              onClick={() => setSelectedTransaction(null)}
              className="absolute right-4 top-4 text-white/45"
            >
              <X className="app-icon" />
            </button>
            <h2 className="text-lg font-black leading-6 text-white">
              {selectedTransaction.subject ?? "Transaction"}
            </h2>
            <div className="app-text-body mt-4 space-y-3 rounded-2xl border border-white/8 bg-surface-input p-4 text-[var(--text-dim)]">
              <div className="flex items-center justify-between gap-3">
                <span>Amount</span>
                <span className="font-semibold text-white">
                  {formatAmount(selectedTransaction.amount, selectedTransaction.type)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                <span className={`font-semibold ${getStatusClass(selectedTransaction.status)}`}>
                  {formatStatus(selectedTransaction.status)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Date</span>
                <span className="text-right text-white">{formatTransactionDate(selectedTransaction.transactionDate)}</span>
              </div>
              {selectedTransaction.description ? (
                <div className="space-y-1">
                  <span>Description</span>
                  <p className="text-white">{selectedTransaction.description}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
