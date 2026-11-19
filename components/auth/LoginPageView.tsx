"use client";

import Link from "next/link";
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
import { buildAuthRouteHref, normalizeReturnUrl } from "@/lib/auth/session";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

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

    const username = normalizeLocalPhoneNumber(rawMobileNumber);
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
          />
          <AuthField
            name="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
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

          <div className="-mt-2 text-right">
            {onForgotPassword ? (
              <button
                type="button"
                onClick={onForgotPassword}
                className="app-text-caption font-semibold text-[var(--primary-orange)]"
              >
                Forgot Password?
              </button>
            ) : (
              <Link
                href={buildAuthRouteHref("/forgot-password", authReturnUrl)}
                className="app-text-caption font-semibold text-[var(--primary-orange)]"
              >
                Forgot Password?
              </Link>
            )}
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

          <p className="app-text-body pt-2 text-center text-[var(--text-dim)]">
            Don&apos;t have an account?{" "}
            {onSwitchToCreateAccount ? (
              <button
                type="button"
                onClick={onSwitchToCreateAccount}
                className="font-bold text-[var(--primary-orange)]"
              >
                Sign Up
              </button>
            ) : (
              <Link
                href={buildAuthRouteHref("/create-account", authReturnUrl)}
                className="font-bold text-[var(--primary-orange)]"
              >
                Sign Up
              </Link>
            )}
          </p>
        </fieldset>
      </form>
    </AuthShell>
  );
}
