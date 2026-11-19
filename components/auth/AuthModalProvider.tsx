"use client";

import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  startTransition,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SESSION_EXPIRED_EVENT, type SessionExpiredEventDetail } from "@/lib/auth/session";
import { useAuthStore } from "@/store/authStore";

type AuthModalMode = "login" | "create-account" | "forgot-password";

type AuthModalState = {
  mode: AuthModalMode;
  referralCode?: string;
  returnUrl: string;
};

type AuthModalContextValue = {
  closeAuthModal: () => void;
  openCreateAccount: (returnUrl?: string, referralCode?: string) => void;
  openForgotPassword: (returnUrl?: string) => void;
  openLogin: (returnUrl?: string) => void;
};

const loadLoginPageView = () =>
  import("@/components/auth/LoginPageView").then((module) => module.LoginPageView);

const loadCreateAccountPageView = () =>
  import("@/components/auth/CreateAccountPageView").then(
    (module) => module.CreateAccountPageView,
  );

const loadForgotPasswordPageView = () =>
  import("@/components/auth/ForgotPasswordPageView").then(
    (module) => module.ForgotPasswordPageView,
  );

export function preloadAuthModalViews() {
  void loadLoginPageView();
  void loadCreateAccountPageView();
  void loadForgotPasswordPageView();
}

function AuthModalLoading({ title }: { title: string }) {
  return (
    <div className="fixed inset-0 z-[1500] flex min-h-dvh items-center justify-center bg-black/85 px-5 py-8 text-white">
      <div className="w-full max-w-[calc(100vw-2.5rem)] rounded-2xl bg-[var(--bg-main)] px-5 py-8 text-center shadow-xl sm:max-w-[420px]">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/15 border-t-[var(--primary-orange)]" />
        <p className="app-text-heading text-white">{title}</p>
      </div>
    </div>
  );
}

const LoginPageView = dynamic(loadLoginPageView, {
  loading: () => <AuthModalLoading title="Log In" />,
  ssr: false,
});
const CreateAccountPageView = dynamic(loadCreateAccountPageView, {
  loading: () => <AuthModalLoading title="Create Account" />,
  ssr: false,
});
const ForgotPasswordPageView = dynamic(loadForgotPasswordPageView, {
  loading: () => <AuthModalLoading title="Reset Password" />,
  ssr: false,
});

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

function normalizeModalReturnUrl(returnUrl: string | undefined) {
  return returnUrl && returnUrl.startsWith("/") ? returnUrl : "";
}

function ReferralSignupWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openCreateAccount } = useAuthModal();
  const referralCode = searchParams?.get("referralCode")?.trim() ?? "";

  useEffect(() => {
    if (!referralCode) return;

    startTransition(() => {
      const query = searchParams?.toString() ?? "";
      openCreateAccount(query ? `${pathname}?${query}` : pathname, referralCode);
    });
  }, [openCreateAccount, pathname, referralCode, searchParams]);

  return null;
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const setReturnUrl = useAuthStore((state) => state.setReturnUrl);
  const [modal, setModal] = useState<AuthModalState | null>(null);

  const openModal = useCallback((mode: AuthModalMode, returnUrl?: string, referralCode?: string) => {
    setModal({ mode, referralCode, returnUrl: normalizeModalReturnUrl(returnUrl) });
  }, []);

  const closeAuthModal = useCallback(() => {
    setReturnUrl("");
    setModal(null);
  }, [setReturnUrl]);

  const openLogin = useCallback((returnUrl?: string) => {
    openModal("login", returnUrl);
  }, [openModal]);

  const openCreateAccount = useCallback((returnUrl?: string, referralCode?: string) => {
    // Pitchside is login-only (demo account); sign-up routes to log in.
    void referralCode;
    openModal("login", returnUrl);
  }, [openModal]);

  const openForgotPassword = useCallback((returnUrl?: string) => {
    openModal("login", returnUrl);
  }, [openModal]);

  const requestedReturnUrl = modal?.returnUrl ?? "";
  const contextValue = useMemo(
    () => ({
      closeAuthModal,
      openCreateAccount,
      openForgotPassword,
      openLogin,
    }),
    [closeAuthModal, openCreateAccount, openForgotPassword, openLogin],
  );

  useEffect(() => {
    function handleSessionExpired(event: Event) {
      const detail = (event as CustomEvent<SessionExpiredEventDetail>).detail;
      queryClient.clear();
      setModal({
        mode: "login",
        returnUrl: normalizeModalReturnUrl(detail?.returnUrl),
      });
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [queryClient]);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadAuthModalViews, { timeout: 2500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timerId = globalThis.setTimeout(preloadAuthModalViews, 1200);
    return () => globalThis.clearTimeout(timerId);
  }, []);

  return (
    <AuthModalContext.Provider
      value={contextValue}
    >
      {children}
      <Suspense fallback={null}>
        <ReferralSignupWatcher />
      </Suspense>
      {modal?.mode === "login" ? (
        <LoginPageView
          requestedReturnUrl={requestedReturnUrl}
          onClose={closeAuthModal}
          onForgotPassword={() => openForgotPassword(requestedReturnUrl)}
          onSwitchToCreateAccount={() => openCreateAccount(requestedReturnUrl)}
        />
      ) : null}
      {modal?.mode === "create-account" ? (
        <CreateAccountPageView
          referralCode={modal.referralCode}
          requestedReturnUrl={requestedReturnUrl}
          onClose={closeAuthModal}
          onSwitchToLogin={() => openLogin(requestedReturnUrl)}
        />
      ) : null}
      {modal?.mode === "forgot-password" ? (
        <ForgotPasswordPageView
          requestedReturnUrl={requestedReturnUrl}
          onClose={closeAuthModal}
          onSwitchToLogin={() => openLogin(requestedReturnUrl)}
        />
      ) : null}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const value = useContext(AuthModalContext);
  if (!value) {
    throw new Error("useAuthModal must be used within AuthModalProvider.");
  }
  return value;
}
