"use client";

import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, Phone, Trophy } from "lucide-react";
import { type ClipboardEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AuthField,
  AuthMessage,
  AuthPrimaryButton,
  AuthShell,
} from "@/components/auth/AuthPrimitives";
import { authApi } from "@/lib/api/auth";
import {
  buildInternationalPhoneNumber,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
  OTP_CODE_LENGTH,
} from "@/lib/auth/forms";
import {
  extractAuthToken,
  extractResponseMessage,
  extractResponseSuccess,
  isExistingUsernameResponse,
} from "@/lib/auth/responses";
import { buildAuthRouteHref, normalizeReturnUrl } from "@/lib/auth/session";
import { CLIENT_ID, SMS_OTP_BYPASS_ENABLED } from "@/lib/helpers/constants";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

type SignUpStep = 1 | 2 | 3 | 4;

function createEmptyOtp() {
  return Array.from({ length: OTP_CODE_LENGTH }, () => "");
}

function passwordChecks(password: string) {
  return [
    {
      isValid: password.length >= 8 && password.length <= 64,
      text: `8~64 characters (${password.length})`,
    },
    { isValid: /\d/.test(password), text: "one number (0~9)" },
    { isValid: /[a-z]/.test(password), text: "one lowercase character (a~z)" },
    { isValid: /[A-Z]/.test(password), text: "one uppercase character (A~Z)" },
    { isValid: /[^A-Za-z0-9]/.test(password), text: "one special character (@, #, $, etc)" },
  ];
}

function ValidationItem({ isValid, text }: { isValid: boolean; text: string }) {
  return (
    <div className={isValid ? "flex items-center gap-2 text-[var(--primary-orange)]" : "flex items-center gap-2 text-[var(--text-dim)]"}>
      <CheckCircle2 size={18} />
      <span className="text-md">{text}</span>
    </div>
  );
}

export function CreateAccountPageView({
  onClose,
  onSwitchToLogin,
  referralCode = "",
  requestedReturnUrl = "",
}: {
  onClose?: () => void;
  onSwitchToLogin?: () => void;
  referralCode?: string;
  requestedReturnUrl?: string;
}) {
  const router = useRouter();
  const { returnUrl, setAuth, setReturnUrl } = useAuthStore();
  const [step, setStep] = useState<SignUpStep>(1);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState<string[]>(createEmptyOtp);
  const [otpTimer, setOtpTimer] = useState(0);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshCurrentUser = useUserStore((state) => state.refreshCurrentUser);

  const normalizedPhoneNumber = normalizeLocalPhoneNumber(mobileNumber);
  const internationalPhoneNumber = buildInternationalPhoneNumber(mobileNumber);
  const authReturnUrl = returnUrl || requestedReturnUrl;
  const normalizedReferralCode = referralCode.trim();
  const checks = passwordChecks(password);
  const isPasswordValid = checks.every((check) => check.isValid);
  const isOtpComplete = otp.every((digit) => digit !== "");
  const closeHref = normalizeReturnUrl(authReturnUrl, "/");

  useEffect(() => {
    if (!requestedReturnUrl || requestedReturnUrl === returnUrl) return;
    setReturnUrl(requestedReturnUrl);
  }, [requestedReturnUrl, returnUrl, setReturnUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startOtpTimer() {
    setOtpTimer(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((value) => {
        if (value <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

  function getTitle() {
    if (step === 1) return "Create Account";
    if (step === 2) return "Verify Phone";
    if (step === 3) return "Set Password";
    return "Welcome!";
  }

  function handleBack() {
    setErrorMessage(null);
    setStatusMessage(null);
    if (step === 3) setStep(SMS_OTP_BYPASS_ENABLED ? 1 : 2);
    if (step === 2) setStep(1);
  }

  async function sendOtp(phoneNumber: string) {
    const response = await authApi.sendOTP({
      clientID: CLIENT_ID,
      phoneNumber,
    });

    if (!extractResponseSuccess(response)) {
      throw new Error(extractResponseMessage(response) ?? "Unable to send verification code.");
    }
  }

  async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!isValidLocalPhoneNumber(mobileNumber)) {
      setErrorMessage("Please enter a valid phone number");
      setStatusMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const verificationResponse = await authApi.verifyUsername({
        username: normalizedPhoneNumber,
        clientId: CLIENT_ID,
      });

      if (isExistingUsernameResponse(verificationResponse)) {
        throw new Error("Phone number already registered. Log in or reset your password.");
      }

      if (!SMS_OTP_BYPASS_ENABLED) {
        await sendOtp(internationalPhoneNumber);
        startOtpTimer();
      }

      setOtp(createEmptyOtp());
      setStep(SMS_OTP_BYPASS_ENABLED ? 3 : 2);
      setStatusMessage(
        SMS_OTP_BYPASS_ENABLED
          ? "OTP verification is bypassed in this environment. Set your password to continue."
          : null,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start registration right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  function updateOtp(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;

    const nextOtp = [...otp];
    nextOtp[index] = value.slice(-1);
    setOtp(nextOtp);

    if (value && index < OTP_CODE_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, key: string) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_CODE_LENGTH);
    if (!pasted) return;

    event.preventDefault();
    const nextOtp = createEmptyOtp().map((_, index) => pasted[index] ?? "");
    setOtp(nextOtp);
    otpRefs.current[Math.min(pasted.length, OTP_CODE_LENGTH) - 1]?.focus();
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !isOtpComplete) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await authApi.verifyOTP({
        clientID: CLIENT_ID,
        phoneNumber: internationalPhoneNumber,
        code: otp.join(""),
      });

      if (!extractResponseSuccess(response)) {
        throw new Error(extractResponseMessage(response) ?? "Invalid verification code.");
      }

      setStep(3);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to verify code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (loading || otpTimer > 0) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await sendOtp(internationalPhoneNumber);
      setOtp(createEmptyOtp());
      startOtpTimer();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to resend verification code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !isPasswordValid) return;

    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const registerResponse = await authApi.register({
        username: normalizedPhoneNumber,
        password,
        phone: internationalPhoneNumber,
        clientId: CLIENT_ID,
        ...(normalizedReferralCode ? { referralCode: normalizedReferralCode } : {}),
      });
      const registrationToken = extractAuthToken(registerResponse);

      if (!registrationToken && !extractResponseSuccess(registerResponse)) {
        throw new Error(
          extractResponseMessage(registerResponse) ?? "Unable to create your account.",
        );
      }

      const token =
        registrationToken ??
        extractAuthToken(
          await authApi.login({ username: normalizedPhoneNumber, password }),
        );

      if (!token) {
        throw new Error("Account created, but automatic login failed. Please log in manually.");
      }

      setAuth(token, normalizedPhoneNumber);
      try {
        await refreshCurrentUser(normalizedPhoneNumber);
      } catch {
        // Account creation remains successful even when profile hydration lags behind.
      }
      setStep(4);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to complete registration.",
      );
    } finally {
      setLoading(false);
    }
  }

  function startBetting() {
    setReturnUrl("");
    if (onClose) {
      onClose();
      return;
    }
    router.replace(closeHref);
  }

  return (
    <AuthShell
      title={getTitle()}
      closeHref={closeHref}
      onClose={onClose}
      showBack={step > 1 && step < 4}
      onBack={handleBack}
      className={step === 4 ? "max-w-[420px]" : undefined}
    >
      {step === 1 ? (
        <form
          className="animate-[authFadeIn_0.3s_ease-out] space-y-6"
          autoComplete="off"
          onSubmit={handlePhoneSubmit}
        >
          <p className="app-text-body mx-auto max-w-[330px] text-center text-[var(--text-dim)]">
            {SMS_OTP_BYPASS_ENABLED
              ? "Enter your phone number to create a new account."
              : "Enter your phone number to create a new account. We'll send you a verification code."}
          </p>

          <fieldset disabled={loading} className="space-y-6">
            <AuthField
              name="mobileNumber"
              type="tel"
              autoComplete="tel"
              inputMode="numeric"
              leadingIcon={<Phone className="app-icon" />}
              prefix="+234"
              placeholder="Phone number"
              value={mobileNumber}
              onChange={(event) => {
                setMobileNumber(event.target.value);
                setErrorMessage(null);
              }}
            />

            {errorMessage ? (
              <AuthMessage role="alert" tone="error">
                {errorMessage}
              </AuthMessage>
            ) : null}

            {statusMessage ? <AuthMessage>{statusMessage}</AuthMessage> : null}

            <AuthPrimaryButton type="submit" disabled={loading || !mobileNumber.trim()}>
              {loading
                ? SMS_OTP_BYPASS_ENABLED
                  ? "Checking number..."
                  : "Sending OTP..."
                : SMS_OTP_BYPASS_ENABLED
                  ? "Continue"
                  : "Send OTP"}
            </AuthPrimaryButton>

            <p className="app-text-caption text-center text-[var(--text-dim)]">
              By creating an account, you agree to our{" "}
              <Link href="/account/terms" className="text-[var(--primary-orange)]">
                Terms & Conditions
              </Link>
              , you confirm you are 18 years old or over and all information given is true.
            </p>

            <p className="app-text-body text-center text-[var(--text-dim)]">
              Already have an account?{" "}
              {onSwitchToLogin ? (
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="font-bold text-[var(--primary-orange)]"
                >
                  Log In
                </button>
              ) : (
                <Link
                  href={buildAuthRouteHref("/login", authReturnUrl)}
                  className="font-bold text-[var(--primary-orange)]"
                >
                  Log In
                </Link>
              )}
            </p>
          </fieldset>
        </form>
      ) : null}

      {step === 2 ? (
        <form
          className="animate-[authFadeIn_0.3s_ease-out] space-y-6"
          autoComplete="off"
          onSubmit={handleOtpSubmit}
        >
          <fieldset disabled={loading} className="space-y-6">
            <div className="text-center">
              <p className="app-text-body text-[var(--text-dim)]">
                We sent a {OTP_CODE_LENGTH}-digit code to
              </p>
              <p className="app-text-heading mt-2 text-white">{normalizedPhoneNumber}</p>
            </div>

            <div className="flex justify-center gap-2.5">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpRefs.current[index] = element;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={1}
                  value={digit}
                  onChange={(event) => updateOtp(index, event.target.value)}
                  onKeyDown={(event) => handleOtpKeyDown(index, event.key)}
                  onPaste={handleOtpPaste}
                  className="min-h-12 w-10 rounded-lg border-2 border-[var(--border-dim)] bg-[var(--bg-card)] text-center text-3xl font-extrabold text-white outline-none transition-colors focus:border-[var(--primary-orange)] data-[filled=true]:border-[var(--primary-orange)] data-[filled=true]:bg-[rgba(203, 234, 78, 0.1)] sm:min-h-13 sm:w-11 sm:text-4xl md:w-12"
                  data-filled={digit ? "true" : "false"}
                />
              ))}
            </div>

            <div className="app-text-body text-center">
              {otpTimer > 0 ? (
                <span className="text-[var(--text-dim)]">
                  Resend code in{" "}
                  <span className="font-bold text-[var(--primary-orange)]">{otpTimer}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="font-bold text-[var(--primary-orange)] disabled:opacity-60"
                >
                  Resend Code
                </button>
              )}
            </div>

            {errorMessage ? (
              <AuthMessage role="alert" tone="error">
                {errorMessage}
              </AuthMessage>
            ) : null}

            <AuthPrimaryButton type="submit" disabled={loading || !isOtpComplete}>
              {loading ? "Verifying..." : "Verify"}
            </AuthPrimaryButton>
          </fieldset>
        </form>
      ) : null}

      {step === 3 ? (
        <form
          className="animate-[authFadeIn_0.3s_ease-out] space-y-5"
          autoComplete="off"
          onSubmit={handleRegisterSubmit}
        >
          <p className="app-text-body mx-auto max-w-[340px] text-center text-[var(--text-dim)]">
            Your password must be at least 8 characters long and must contain at least one upper
            case letter, one lower case letter, one number and one special character.
          </p>

          <fieldset disabled={loading} className="space-y-5">
            <AuthField
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrorMessage(null);
              }}
              suffix={(
                <button
                  type="button"
                  onClick={() => setIsPasswordVisible((value) => !value)}
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  className="text-text-secondary transition-colors hover:text-white"
                >
                  {isPasswordVisible ? <Eye className="app-icon" /> : <EyeOff className="app-icon" />}
                </button>
              )}
            />

            <div className="space-y-2.5">
              {checks.map((check) => (
                <ValidationItem key={check.text} isValid={check.isValid} text={check.text} />
              ))}
            </div>

            {errorMessage ? (
              <AuthMessage role="alert" tone="error">
                {errorMessage}
              </AuthMessage>
            ) : null}

            <AuthPrimaryButton type="submit" disabled={loading || !isPasswordValid}>
              {loading ? "Creating account..." : "Create Account"}
            </AuthPrimaryButton>
          </fieldset>
        </form>
      ) : null}

      {step === 4 ? (
        <div className="animate-[authFadeIn_0.3s_ease-out] flex flex-col items-center">
          <div className="app-icon-box mb-5 rounded-full bg-[rgba(203, 234, 78, 0.1)]">
            <CheckCircle2 className="size-8 text-[var(--primary-orange)] sm:size-9 md:size-10" />
          </div>

          <h2 className="app-text-title mb-2 text-center">Account Created!</h2>
          <p className="app-text-body mb-7 max-w-[320px] text-center text-[var(--text-dim)]">
            Your account has been created successfully. Start exploring Pitchside!
          </p>

          <div className="mb-6 w-full overflow-hidden rounded-xl border border-[var(--border-dim)] bg-[linear-gradient(135deg,rgba(238, 238, 236, 1)_0%,rgba(246, 246, 245, 1)_100%)]">
            <div className="relative px-4 py-5">
              <div className="mb-1 text-sm font-semibold uppercase tracking-[1px] text-[var(--text-dim)]">
                Complete New Comer Missions
              </div>
              <div className="text-4xl font-extrabold leading-7 text-white">
                Earn <span className="text-[var(--primary-orange)]">Free Bet Gift</span>
              </div>
              <Trophy
                size={64}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white opacity-10"
              />
            </div>
            <div className="bg-[var(--lime)] px-3 py-3 text-center text-md font-bold text-white">
              Earn up to ₦5000 &gt;
            </div>
          </div>

          <AuthPrimaryButton onClick={startBetting}>Start Betting</AuthPrimaryButton>

          <div className="mt-6 w-full rounded-md bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[var(--primary-orange)]">
              <span className="font-extrabold">!</span>
              <span className="text-md font-bold">For your money&apos;s safety</span>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-base leading-5 text-[var(--text-dim)]">
              <li>
                Only enter your details on our{" "}
                <strong className="text-white">official Pitchside platform.</strong>
              </li>
              <li>
                All promotions are visible only on our{" "}
                <strong className="text-white">official website. Ignore third-party offers.</strong>
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
