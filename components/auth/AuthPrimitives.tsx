import Link from "next/link";
import type { InputHTMLAttributes } from "react";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthShellProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
  closeHref?: string;
  onClose?: () => void;
  onBack?: () => void;
  showBack?: boolean;
};

type AuthFieldProps = {
  name: string;
  placeholder: string;
  leadingIcon?: React.ReactNode;
  prefix?: string;
  suffix?: React.ReactNode;
  containerClassName?: string;
  inputClassName?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix">;

type AuthStepperProps = {
  currentStep: number;
  steps: readonly [string, string, string];
};

export function AuthShell({
  title,
  children,
  className,
  closeHref = "/",
  onClose,
  onBack,
  showBack = false,
}: AuthShellProps) {
  return (
    <div className="fixed inset-0 z-[1500] flex min-h-dvh items-center justify-center bg-black/85 px-5 py-8 text-white">
      <main
        className={cn(
          "w-full max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl bg-[var(--bg-main)] shadow-xl sm:max-w-[420px]",
          "max-h-[90dvh] overflow-y-auto",
          className,
        )}
      >
        <header className="flex min-w-0 items-center justify-between px-4 pb-3 pt-5 sm:px-6">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="inline-flex size-6 items-center justify-center text-white transition-opacity hover:opacity-85"
            >
              <ArrowLeft className="app-icon" />
            </button>
          ) : (
            <span className="size-6" aria-hidden="true" />
          )}

          <h1 className="app-text-title text-center tracking-[-0.02em]">{title}</h1>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-6 items-center justify-center text-white transition-opacity hover:opacity-85"
            >
              <X className="app-icon" />
            </button>
          ) : (
            <Link
              href={closeHref}
              aria-label="Close"
              className="inline-flex size-6 items-center justify-center text-white transition-opacity hover:opacity-85"
            >
              <X className="app-icon" />
            </Link>
          )}
        </header>

        <div className="min-w-0 px-4 pb-6 sm:px-6">{children}</div>
      </main>
    </div>
  );
}

export function AuthStepper({ currentStep, steps }: AuthStepperProps) {
  return (
    <div className="mb-5">
      <div className="relative mb-2.5 flex items-center justify-between px-1">
        <div className="absolute left-1 right-1 top-1/2 h-[2px] -translate-y-1/2 bg-white/15" />
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              "relative z-10 block h-3 w-3 rounded-full border",
              index <= currentStep
                ? "border-[var(--primary-orange)] bg-[var(--lime)]"
                : "border-white/10 bg-[#97998A]",
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 app-text-caption font-medium">
        {steps.map((step, index) => (
          <span
            key={step}
            className={cn(
              "leading-4",
              index === currentStep ? "text-white" : "text-text-secondary",
            )}
          >
            {step}
          </span>
        ))}
      </div>

      <div className="mt-4 border-b border-white/12" />
    </div>
  );
}

export function AuthField({
  name,
  placeholder,
  leadingIcon,
  prefix,
  suffix,
  containerClassName,
  inputClassName,
  type = "text",
  ...props
}: AuthFieldProps) {
  return (
    <label
      className={cn(
        "app-field border-[var(--border-dim)] bg-[var(--bg-card)]",
        containerClassName,
      )}
    >
      {leadingIcon ? (
        <span className="mr-2 inline-flex shrink-0 text-[var(--text-dim)]">{leadingIcon}</span>
      ) : null}
      {prefix ? (
        <span className="app-text-body mr-2 shrink-0 font-semibold text-[var(--text-dim)]">{prefix}</span>
      ) : null}
      {leadingIcon || prefix ? <span className="mr-3 h-6 w-px bg-[var(--border-dim)]" /> : null}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        className={cn(
          "app-field-input placeholder:text-[#767969]",
          inputClassName,
        )}
        {...props}
        autoComplete="off"
      />
      {suffix ? <span className="ml-2 shrink-0">{suffix}</span> : null}
    </label>
  );
}

export function AuthMessage({
  children,
  tone = "info",
  role = "status",
}: {
  children: React.ReactNode;
  tone?: "error" | "info" | "success";
  role?: "alert" | "status";
}) {
  return (
    <p
      role={role}
      className={cn(
        "app-text-caption rounded-md border px-3 py-2 text-center",
        tone === "error" &&
          "border-[rgba(12, 122, 77, 0.25)] bg-[rgba(203, 234, 78, 0.08)] text-[#0C7A4D]",
        tone === "info" && "border-white/10 bg-white/5 text-[#242520]",
        tone === "success" &&
          "border-[rgba(21, 128, 61, 0.22)] bg-[rgba(21, 128, 61, 0.1)] text-[#15803D]",
      )}
    >
      {children}
    </p>
  );
}

export function AuthPrimaryButton({
  children,
  className,
  disabled = false,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "app-button app-button-primary w-full font-bold disabled:bg-[rgba(203, 234, 78, 0.3)] disabled:text-white/50",
        className,
      )}
    >
      {children}
    </button>
  );
}
