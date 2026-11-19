"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  AuthField,
  AuthMessage,
  AuthPrimaryButton,
  AuthShell,
  AuthStepper,
} from "@/components/auth/AuthPrimitives";
import { authApi } from "@/lib/api/auth";
import {
  buildInternationalPhoneNumber,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
  OTP_CODE_LENGTH,
  validatePassword,
} from "@/lib/auth/forms";
import {
  extractResponseMessage,
  extractResponseSuccess,
  isExistingUsernameResponse,
} from "@/lib/auth/responses";
import { buildAuthRouteHref } from "@/lib/auth/session";
import { CLIENT_ID, SMS_OTP_BYPASS_ENABLED } from "@/lib/helpers/constants";

const RESET_PASSWORD_STEPS = ["Find account", "OTP verification", "New password"] as const;

type ResetStep = 0 | 1 | 2;

function InlineActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="font-medium text-[var(--primary-orange)] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function ForgotPasswordPageView({
  onClose,
  onSwitchToLogin,
  requestedReturnUrl = "",
}: {
  onClose?: () => void;
  onSwitchToLogin?: () => void;
  requestedReturnUrl?: string;
}) {
  const [step, setStep] = useState<ResetStep>(0);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const passwordErrors = validatePassword(password);
  const normalizedPhoneNumber = normalizeLocalPhoneNumber(mobileNumber);
  const internationalPhoneNumber = buildInternationalPhoneNumber(mobileNumber);

  async function sendOtp(phoneNumber: string) {
    const response = await authApi.sendOTP({
      clientID: CLIENT_ID,
      phoneNumber,
    });

    if (!extractResponseSuccess(response)) {
      throw new Error(extractResponseMessage(response) ?? "Unable to send verification code.");
    }
  }

  async function handleFindAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!isValidLocalPhoneNumber(mobileNumber)) {
      setErrorMessage("Enter a valid Nigerian mobile number.");
      setStatusMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await authApi.verifyUsername({
        username: normalizedPhoneNumber,
        clientId: CLIENT_ID,
      });

      if (!isExistingUsernameResponse(response)) {
        throw new Error(extractResponseMessage(response) ?? "We could not find that account.");
      }

      if (!SMS_OTP_BYPASS_ENABLED) {
        await sendOtp(internationalPhoneNumber);
      }

      setStep(SMS_OTP_BYPASS_ENABLED ? 2 : 1);
      setStatusMessage(
        SMS_OTP_BYPASS_ENABLED
          ? "OTP verification is bypassed in this environment. Choose a new password."
          : `We sent a ${OTP_CODE_LENGTH}-digit code to +${internationalPhoneNumber}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to verify the account right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const trimmedOtp = otpCode.trim();
    if (trimmedOtp.length !== OTP_CODE_LENGTH) {
      setErrorMessage(`Enter the ${OTP_CODE_LENGTH}-digit verification code.`);
      setStatusMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await authApi.verifyOTP({
        clientID: CLIENT_ID,
        phoneNumber: internationalPhoneNumber,
        code: trimmedOtp,
      });

      if (!extractResponseSuccess(response)) {
        throw new Error(extractResponseMessage(response) ?? "Invalid verification code.");
      }

      setStep(2);
      setStatusMessage("Verification complete. Choose a new password for your account.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to verify code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (passwordErrors.length > 0) {
      setErrorMessage(passwordErrors[0]);
      setStatusMessage(null);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      setStatusMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await authApi.resetPassword({
        username: normalizedPhoneNumber,
        password,
        clientId: CLIENT_ID,
      });

      if (!extractResponseSuccess(response)) {
        throw new Error(extractResponseMessage(response) ?? "Unable to reset your password.");
      }

      setIsComplete(true);
      setStatusMessage("Password updated successfully. Log in with your new password.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to reset your password right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (loading) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await sendOtp(internationalPhoneNumber);
      setStatusMessage(`We sent a new ${OTP_CODE_LENGTH}-digit code to +${internationalPhoneNumber}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to resend verification code.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (isComplete) {
    return (
      <AuthShell title="Password reset" onClose={onClose}>
        <div className="space-y-5 pt-4">
          {statusMessage ? <AuthMessage tone="success">{statusMessage}</AuthMessage> : null}
          {onSwitchToLogin ? (
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="app-button app-button-primary w-full font-semibold"
            >
              Back to log in
            </button>
          ) : (
            <Link
              href={buildAuthRouteHref("/login", requestedReturnUrl)}
              className="app-button app-button-primary w-full font-semibold"
            >
              Back to log in
            </Link>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Find account" onClose={onClose}>
      <AuthStepper currentStep={step} steps={RESET_PASSWORD_STEPS} />

      {step === 0 ? (
        <form className="space-y-5 pt-1" autoComplete="off" onSubmit={handleFindAccountSubmit}>
          <fieldset disabled={loading} className="space-y-5">
            <p className="app-text-body max-w-[28ch] text-text-secondary">
              To reset your password, please confirm your account first.
            </p>

            <AuthField
              name="mobileNumber"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              prefix="+234"
              placeholder="Mobile number"
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
            />

            {errorMessage ? (
              <AuthMessage role="alert" tone="error">
                {errorMessage}
              </AuthMessage>
            ) : null}

            {statusMessage ? <AuthMessage>{statusMessage}</AuthMessage> : null}

            <AuthPrimaryButton className="mt-1" type="submit" disabled={loading}>
              {loading ? "Checking account..." : SMS_OTP_BYPASS_ENABLED ? "Continue" : "Next"}
            </AuthPrimaryButton>
          </fieldset>
        </form>
      ) : null}

      {step === 1 ? (
        <form className="space-y-5 pt-1" autoComplete="off" onSubmit={handleOtpSubmit}>
          <fieldset disabled={loading} className="space-y-5">
            <p className="app-text-body text-text-secondary">
              Enter the {OTP_CODE_LENGTH}-digit code sent to +{internationalPhoneNumber}.
            </p>

            <AuthField
              name="otpCode"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={OTP_CODE_LENGTH}
              placeholder="Verification code"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
            />

            <div className="app-text-body flex items-center justify-between gap-4">
              <InlineActionButton onClick={() => setStep(0)} disabled={loading}>
                Change number
              </InlineActionButton>
              <InlineActionButton onClick={handleResendCode} disabled={loading}>
                Resend code
              </InlineActionButton>
            </div>

            {errorMessage ? (
              <AuthMessage role="alert" tone="error">
                {errorMessage}
              </AuthMessage>
            ) : null}

            {statusMessage ? <AuthMessage>{statusMessage}</AuthMessage> : null}

            <AuthPrimaryButton type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify code"}
            </AuthPrimaryButton>
          </fieldset>
        </form>
      ) : null}

      {step === 2 ? (
        <form className="space-y-5 pt-1" autoComplete="off" onSubmit={handleResetPasswordSubmit}>
          <fieldset disabled={loading} className="space-y-5">
            <AuthField
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              suffix={(
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((value) => !value)}
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  className="text-text-secondary transition-colors hover:text-white"
                >
                  {isPasswordVisible ? <EyeOff className="app-icon" /> : <Eye className="app-icon" />}
                </button>
              )}
            />

            <AuthField
              name="confirmPassword"
              type={isConfirmPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              suffix={(
                <button
                  type="button"
                  onClick={() => setIsConfirmPasswordVisible((value) => !value)}
                  aria-label={isConfirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                  className="text-text-secondary transition-colors hover:text-white"
                >
                  {isConfirmPasswordVisible ? <EyeOff className="app-icon" /> : <Eye className="app-icon" />}
                </button>
              )}
            />

            {password.length > 0 && passwordErrors.length > 0 ? (
              <AuthMessage role="alert" tone="error">
                {passwordErrors[0]}
              </AuthMessage>
            ) : null}

            {errorMessage ? (
              <AuthMessage role="alert" tone="error">
                {errorMessage}
              </AuthMessage>
            ) : null}

            {statusMessage ? <AuthMessage>{statusMessage}</AuthMessage> : null}

            <AuthPrimaryButton type="submit" disabled={loading}>
              {loading ? "Saving password..." : "Save password"}
            </AuthPrimaryButton>
          </fieldset>
        </form>
      ) : null}
    </AuthShell>
  );
}
