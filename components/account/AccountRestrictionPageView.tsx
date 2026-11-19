"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Home,
  LockKeyhole,
  Power,
  ShieldAlert,
} from "lucide-react";
import { AuthHydrationFallback } from "@/components/auth/AuthHydrationFallback";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { authApi } from "@/lib/api/auth";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

type RestrictionMode = "deactivation" | "self-exclusion";
type FlowStep = "form" | "review";

const SELF_EXCLUSION_PERIODS = [
  { label: "24 hours", value: "1d", days: 1 },
  { label: "7 days", value: "7d", days: 7 },
  { label: "30 days", value: "30d", days: 30 },
  { label: "6 months", value: "180d", days: 180 },
  { label: "1 year", value: "365d", days: 365 },
];

const DEACTIVATION_REASONS = [
  "Taking a break",
  "Account security concern",
  "Responsible gaming",
  "No longer using Pitchside",
  "Other",
];

function formatReviewDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function RestrictionHeader({
  onBack,
  title,
}: {
  onBack: () => void;
  title: string;
}) {
  const router = useRouter();

  return (
    <header className="flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex size-11 items-center justify-center rounded-full bg-white/[0.06] text-white"
        aria-label="Go back"
      >
        <ArrowLeft size={22} />
      </button>
    </header>
  );
}

function SelectField({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = value || placeholder;

  return (
    <div className="relative">
      <p className="app-text-label text-white">{label}</p>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/12 bg-[#F5F6F4] px-4 py-4 text-left text-md font-black text-white"
      >
        <span className={cn(!value && "text-white/42")}>{selectedLabel}</span>
        <ChevronDown
          className={cn("text-white/45 transition", isOpen && "rotate-180")}
          size={20}
        />
      </button>

      {isOpen ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#F5F6F4] shadow-2xl">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onChange(option);
              setIsOpen(false);
            }}
            className={cn(
              "block w-full px-4 py-3 text-left text-md font-bold text-white transition hover:bg-white/[0.06]",
              value === option && "bg-[var(--lime)] text-white",
            )}
          >
            {option}
          </button>
        ))}
        </div>
      ) : null}
    </div>
  );
}

export function AccountRestrictionPageView({ mode }: { mode: RestrictionMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const { openLogin } = useAuthModal();
  const [step, setStep] = useState<FlowStep>("form");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [selectedReason, setSelectedReason] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPeriodConfig = SELF_EXCLUSION_PERIODS.find((period) => period.label === selectedPeriod);
  const isSelfExclusion = mode === "self-exclusion";
  const canContinue = isSelfExclusion ? Boolean(selectedPeriodConfig) : Boolean(selectedReason);
  const reviewEndDate = useMemo(
    () => formatReviewDate(selectedPeriodConfig?.days ?? 0),
    [selectedPeriodConfig?.days],
  );

  async function submitRestriction() {
    if (isSubmitting) return;
    setSubmitError("");
    setIsSubmitting(true);

    try {
      if (isSelfExclusion) {
        if (!selectedPeriodConfig) return;
        await authApi.setSelfExclusion({ days: selectedPeriodConfig.days });
      } else {
        await authApi.deactivateAccount({ reason: selectedReason });
      }

      logout();
      openLogin("/");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to complete request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!authHasHydrated) {
    return <AuthHydrationFallback />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100dvh-9rem)] px-1 pb-6 text-white">
        <section className="rounded-[28px] border border-white/8 bg-[#F5F6F4] p-5">
          <RestrictionHeader
            title={isSelfExclusion ? "Self-Exclusion" : "Deactivate"}
            onBack={() => router.back()}
          />
          <p className="app-text-body mt-6 text-white/58">
            Log in to manage account access controls.
          </p>
          <button
            type="button"
            onClick={() => openLogin(pathname)}
            className="app-button app-button-primary mt-5 w-full"
          >
            Log in to continue
          </button>
        </section>
      </div>
    );
  }

  if (step === "review") {
    return (
      <div className="min-h-[calc(100dvh-5rem)] px-1 pb-6 text-white">
        <section className="">
          <RestrictionHeader
            title={isSelfExclusion ? "Review" : "Confirm"}
            onBack={() => setStep("form")}
          />

          <div className="mt-6 rounded-3xl border border-white/8 bg-white/[0.035] p-5">
            <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--lime)]/15 text-[var(--primary-orange)]">
              <AlertTriangle size={24} />
            </div>
            <h1 className="text-3xl font-black text-white">
              {isSelfExclusion ? "Self-exclusion starts immediately" : "Deactivate account"}
            </h1>
            <p className="app-text-body mt-4 text-white/62">
              {isSelfExclusion
                ? `Your self-exclusion will end on ${reviewEndDate}. You will be logged out and will not be able to bet, deposit, or play games during this period.`
                : "Deactivation freezes account access, logs out active sessions, and prevents new logins until reactivation is completed."}
            </p>
            <div className="mt-5 rounded-2xl bg-[#F5F6F4] p-4">
              <p className="app-text-caption text-white/42">
                {isSelfExclusion ? "Selected period" : "Selected reason"}
              </p>
              <p className="app-text-label mt-1 text-white">
                {isSelfExclusion ? selectedPeriodConfig?.label : selectedReason}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <button
              type="button"
              onClick={() => void submitRestriction()}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[var(--lime)] px-4 py-4 text-md font-black text-white disabled:bg-white/10 disabled:text-white/35"
            >
              {isSubmitting
                ? "Submitting..."
                : isSelfExclusion
                  ? "Self-exclude"
                  : "Deactivate account"}
            </button>
            {submitError ? (
              <div className="rounded-2xl border border-border-error bg-surface-error px-4 py-3 text-md text-[#D22B34]">
                {submitError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setStep("form")}
              className="w-full rounded-lg border border-[var(--primary-orange)] px-4 py-4 text-md font-black text-[var(--primary-orange)]"
            >
              Cancel
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-5rem)] px-1 pb-6 text-white">
      <section className="">
        <RestrictionHeader
          title={isSelfExclusion ? "Review" : "Confirm"}
          onBack={() => router.back()}
        />
        <div className="mt-7">
          <div
            className={cn(
              "mb-5 inline-flex size-12 items-center justify-center rounded-2xl",
              isSelfExclusion
                ? "bg-[#E2F5E9]/15 text-[#15803D]"
                : "bg-[var(--lime)]/15 text-[var(--primary-orange)]",
            )}
          >
            {isSelfExclusion ? <ShieldAlert size={25} /> : <Power size={25} />}
          </div>
          <h1 className="text-4xl font-black text-white">
            {isSelfExclusion ? "Self-Exclusion" : "Deactivate account"}
          </h1>
          <p className="app-text-body mt-4 leading-relaxed text-white/62">
            {isSelfExclusion
              ? "Choose a period to restrict betting, deposits, and gameplay. During the selected period, open bets settle normally and account access remains limited."
              : "Use this page to request account deactivation. Deactivation prevents new logins and freezes account access until reactivation is completed."}
          </p>

          <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <div className="flex gap-3">
              <LockKeyhole className="mt-0.5 shrink-0 text-white/45" size={18} />
              <p className="app-text-caption leading-relaxed text-white/48">
                {isSelfExclusion
                  ? "Self-exclusion cannot be shortened from the app once submitted."
                  : "Reactivation may require OTP verification and password reset."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7">
          {isSelfExclusion ? (
            <SelectField
              label="Self-exclusion period"
              placeholder="Select period"
              value={selectedPeriod}
              onChange={(value) => {
                setSelectedPeriod(value);
                setSubmitError("");
              }}
              options={SELF_EXCLUSION_PERIODS.map((period) => period.label)}
            />
          ) : (
            <SelectField
              label="Deactivate reason"
              placeholder="Select reason"
              value={selectedReason}
              onChange={(value) => {
                setSelectedReason(value);
                setSubmitError("");
              }}
              options={DEACTIVATION_REASONS}
            />
          )}
        </div>

        <button
          type="button"
          disabled={!canContinue}
          onClick={() => canContinue && setStep("review")}
          className={cn(
            "mt-7 w-full rounded-lg px-4 py-4 text-md font-black",
            canContinue
              ? "bg-[var(--lime)] text-white"
              : "bg-white/10 text-white/35",
          )}
        >
          Continue
        </button>
      </section>
    </div>
  );
}
