"use client";

import { Eye, EyeOff, Phone } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthField,
  AuthMessage,
  AuthPrimaryButton,
  AuthShell,
} from "@/components/auth/AuthPrimitives";
import { authApi } from "@/lib/api/auth";
import { normalizeLocalPhoneNumber } from "@/lib/auth/forms";
import { extractAuthToken, extractResponseMessage } from "@/lib/auth/responses";
import { normalizeReturnUrl } from "@/lib/auth/session";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

export const DEMO_ACCOUNT = { phone: "8012345678", password: "Pitchside#2026" };

export function LoginPageView({
  onClose,
  onForgotPassword,
  onSwitchToCreateAccount,
  requestedReturnUrl = "",
}: {
  onClose?: () => void;
  onForgotPassword?: () => void;
  onSwitchToCreateAccount?: () => void;
  requestedReturnUrl?: string;
}) {
  const router = useRouter();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const {
    authError,
    loading,
    returnUrl,
    setAuth,
    setAuthError,
    setLoading,
    setReturnUrl,
  } = useAuthStore();
  const refreshCurrentUser = useUserStore((state) => state.refreshCurrentUser);
  const authReturnUrl = returnUrl || requestedReturnUrl;

  useEffect(() => {
    setAuthError(null);
  }, [setAuthError]);

  useEffect(() => {
    if (!requestedReturnUrl || requestedReturnUrl === returnUrl) return;
    setReturnUrl(requestedReturnUrl);
  }, [requestedReturnUrl, returnUrl, setReturnUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const rawMobileNumber = String(formData.get("mobileNumber") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();

    if (!rawMobileNumber || !password) {
      setAuthError("Enter your mobile number and password.");
      return;
    }

    await logIn(normalizeLocalPhoneNumber(rawMobileNumber), password);
  }

  async function logIn(username: string, password: string) {
    setLoading(true);
    setAuthError(null);

    try {
      const response = await authApi.login({ username, password });
      const token = extractAuthToken(response);

      if (!token) {
        throw new Error(extractResponseMessage(response) ?? "Login failed. Please try again.");
      }

      setAuth(token, username);
      try {
        await refreshCurrentUser(username);
      } catch {
        // Keep login successful even when profile hydration lags behind.
      }
      setReturnUrl("");
      if (onClose) {
        onClose();
        return;
      }
      router.replace(normalizeReturnUrl(returnUrl || requestedReturnUrl, "/"));
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Log In"
      closeHref={normalizeReturnUrl(authReturnUrl, "/")}
      onClose={onClose}
    >
      <form
        className="min-w-0 animate-[authFadeIn_0.3s_ease-out] space-y-4"
        autoComplete="off"
        onSubmit={handleSubmit}
      >
        <p className="app-text-body mx-auto max-w-[320px] pb-2 text-center text-[var(--text-dim)]">
          Enter your phone number and password to access your account.
        </p>

        <fieldset disabled={loading} className="min-w-0 space-y-4">
          <AuthField
            name="mobileNumber"
            type="tel"
            autoComplete="tel"
            leadingIcon={<Phone className="app-icon" />}
            prefix="+234"
            placeholder="Phone number"
            defaultValue={DEMO_ACCOUNT.phone}
          />
          <AuthField
            name="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
            defaultValue={DEMO_ACCOUNT.password}
            suffix={(
              <button
                type="button"
                onClick={() => setIsPasswordVisible((value) => !value)}
                aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                className="text-[#686B5D] transition-colors hover:text-white"
              >
                {isPasswordVisible ? <Eye className="app-icon" /> : <EyeOff className="app-icon" />}
              </button>
            )}
          />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--chalk)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            <p className="font-semibold text-[var(--ink)]">Demo account</p>
            <p className="mt-0.5 font-mono text-[12px]">
              +234 {DEMO_ACCOUNT.phone} · {DEMO_ACCOUNT.password}
            </p>
            <p className="mt-1 text-[var(--ink-3)]">Starts with a ₦50,000 play balance. No real money is used.</p>
          </div>

          {authError ? (
            <AuthMessage role="alert" tone="error">
              {authError}
            </AuthMessage>
          ) : null}

          <AuthPrimaryButton
            type="submit"
            disabled={loading}
            className="mt-0.5"
          >
            {loading ? "Logging in..." : "Log In"}
          </AuthPrimaryButton>

          <button
            type="button"
            disabled={loading}
            onClick={() => void logIn(DEMO_ACCOUNT.phone, DEMO_ACCOUNT.password)}
            className="w-full rounded-full border border-[var(--ink)] bg-[var(--ink)] py-3 text-[14px] font-semibold text-[#fff] transition-opacity disabled:opacity-50"
          >
            Continue with demo account
          </button>
        </fieldset>
      </form>
    </AuthShell>
  );
}
