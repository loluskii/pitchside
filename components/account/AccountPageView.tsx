"use client";

import Link from "next/link";

import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  FaFacebookF,
  FaHistory,
  FaInstagram,
  FaTelegramPlane,
  FaTwitter,
} from "react-icons/fa";
import {
  MdAccountBalanceWallet,
  MdAccountCircle,
  MdCallMade,
  MdChevronRight,
  MdBlock,
  MdEmojiEvents,
  MdFactCheck,
  MdGroupAdd,
  MdHeadsetMic,
  MdNotifications,
  MdPerson,
  MdPowerSettingsNew,
  MdPendingActions,
  MdSettings,
  MdSyncAlt,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import { AuthHydrationFallback } from "@/components/auth/AuthHydrationFallback";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";
import { PageFooter } from "../layout/PageFooter";

function formatBalanceDisplay(currency = "NGN", amount = 0) {
  const normalizedCurrency = currency.trim() || "NGN";
  const normalizedAmount = Number(amount ?? 0);
  const formattedAmount = normalizedAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (normalizedCurrency === "NGN") {
    return `₦${formattedAmount}`;
  }

  return `${normalizedCurrency} ${formattedAmount}`;
}

type AuthMode = "login" | "register";

type ProfilePageProps = {
  accountId: string;
  balanceLabel: string;
  displayName: string;
  isLoggedIn: boolean;
  onLogout: () => void;
  onNavigate: (path: string, requiresAuth?: boolean) => void;
  onOpenAuth: (mode: AuthMode) => void;
};

const ProfilePage = ({
  accountId,
  balanceLabel,
  displayName,
  isLoggedIn,
  onLogout,
  onNavigate,
  onOpenAuth,
}: ProfilePageProps) => {
  const [showBalance, setShowBalance] = useState(true);

  return (
    <div
      className="profile-page"
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "480px",
        bottom: "60px",
        background: "var(--bg-main)",
        color: "#10100E",
        zIndex: 900,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: "linear-gradient(145deg, rgba(203, 234, 78, 0.12) 0%, rgba(238, 238, 236, 0.6) 50%, rgba(246, 246, 245, 0.9) 100%)",
          padding: "20px 16px 16px",
          borderBottom: "1px solid var(--border-dim)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--primary-orange), #CBEA4E)",
                padding: "2px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: "var(--bg-main)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                <MdAccountCircle className="size-10 sm:size-11 md:size-12" color="var(--text-dim)" />
              </div>
            </div>
            <div>
              {isLoggedIn ? (
                <>
                  <span className="app-text-body font-bold tracking-wide">
                    {displayName}
                  </span>
                  <span className="app-text-caption mt-0.5 block text-[var(--text-dim)]">
                    ID: {accountId}
                  </span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      padding: 0,
                    }}
                    onClick={() => onOpenAuth("login")}
                  >
                    <span className="app-text-body font-bold tracking-wide">
                      Log in
                    </span>
                    <MdChevronRight className="app-icon" color="var(--text-dim)" />
                  </button>
                  <span className="app-text-caption mt-0.5 block text-[var(--text-dim)]">
                    Tap to access your account
                  </span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(18, 26, 22, 0.06)",
                border: "none",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              onClick={() => onNavigate("/notifications", true)}
            >
              <MdNotifications className="app-icon" color="var(--text-dim)" />
            </button>
            <button
              type="button"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(18, 26, 22, 0.06)",
                border: "none",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              onClick={() => onNavigate("/account/personal-details")}
            >
              <MdSettings className="app-icon" color="var(--text-dim)" />
            </button>
          </div>
        </div>

        <div
          style={{
            background: "rgba(18, 26, 22, 0.04)",
            border: "1px solid rgba(18, 26, 22, 0.06)",
            borderRadius: "12px",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="app-text-caption font-semibold uppercase tracking-wide text-[var(--text-dim)]">
                Total Balance
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {showBalance ? <MdVisibility className="app-icon" /> : <MdVisibilityOff className="app-icon" />}
              </button>
            </div>
            <MdAccountBalanceWallet className="app-icon" color="var(--primary-orange)" />
          </div>
          <span className="app-text-title tracking-tight">
            {showBalance ? balanceLabel : "••••"}
          </span>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href="/deposit"
              className="flex h-10 items-center justify-center rounded-xl bg-[var(--lime)] text-sm font-bold text-[var(--ink)]"
            >
              Add funds
            </Link>
            <Link
              href="/withdraw"
              className="flex h-10 items-center justify-center rounded-xl border border-[var(--ink)]/15 text-sm font-bold text-[var(--ink)]"
            >
              Withdraw
            </Link>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 16px", flex: 1 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            padding: "16px 0",
          }}
        >
          {[
            {
              id: "history",
              icon: <FaHistory size={16} />,
              label: "Bet History",
              path: "/my-bets",
              requiresAuth: false,
            },
            {
              id: "transactions",
              icon: <MdSyncAlt size={18} />,
              label: "Transactions",
              path: "/transactions",
              requiresAuth: true,
            },
            {
              id: "live",
              icon: <MdSyncAlt size={18} />,
              label: "In play",
              path: "/live",
              requiresAuth: false,
            },
            {
              id: "results",
              icon: <MdEmojiEvents size={18} />,
              label: "Results",
              path: "/results",
              requiresAuth: false,
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                padding: "12px 4px",
                background: "none",
                border: "none",
                textAlign: "center",
              }}
              onClick={() => onNavigate(item.path, item.requiresAuth)}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10100E",
                }}
              >
                {item.icon}
              </div>
              <span
                className="app-text-caption text-center font-semibold text-[var(--text-dim)]"
                style={{
                  textAlign: "center",
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "16px" }}>
          <div
            className="app-text-caption pb-2.5 font-bold uppercase tracking-wider text-[var(--text-dim)]"
          >
            Account
          </div>
          <div
            style={{
              background: "rgba(18, 26, 22, 0.03)",
              border: "1px solid rgba(18, 26, 22, 0.05)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
          >
            {[
              {
                id: "personal",
                icon: <MdPerson size={18} />,
                label: "Personal Details",
                subtitle: "Manage your profile",
                path: "/account/personal-details",
                requiresAuth: false,
              },
              {
                id: "cs",
                icon: <MdHeadsetMic size={18} />,
                label: "Customer Support",
                subtitle: "Available 24/7",
                path: "/account/customer-support",
                dot: true,
              },
              ...(isLoggedIn
                ? [
                    {
                      id: "self-exclusion",
                      icon: <MdBlock size={18} />,
                      label: "Self Exclusion",
                      path: "/account/self-exclusion",
                      requiresAuth: true,
                    },
                    {
                      id: "deactivation",
                      icon: <MdPowerSettingsNew size={18} />,
                      label: "Deactivation",
                      path: "/account/deactivation",
                      requiresAuth: true,
                    },
                  ]
                : []),
            ].map((item, index, arr) => (
              <button
                key={item.id}
                type="button"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  borderBottom:
                    index < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  width: "100%",
                  background: "transparent",
                  borderLeft: "none",
                  borderRight: "none",
                  borderTop: "none",
                  textAlign: "left",
                }}
                onClick={() => onNavigate(item.path, item.requiresAuth)}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(18, 26, 22, 0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-dim)",
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="app-text-label">{item.label}</div>
                    {item.subtitle ? (
                      <div className="app-text-caption mt-0.5 text-[var(--text-dim)]">
                        {item.subtitle}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {item.dot ? (
                    <div
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: "var(--primary-orange)",
                      }}
                    />
                  ) : null}
                  <MdChevronRight className="app-icon" color="rgba(255,255,255,0.2)" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {isLoggedIn ? (
          <div style={{ marginBottom: "24px" }}>
            <button
              className="app-text-body font-bold"
              onClick={onLogout}
              style={{
                width: "100%",
                padding: "14px",
                background: "rgba(210, 43, 52, 0.1)",
                color: "#D22B34",
                border: "1px solid rgba(210, 43, 52, 0.2)",
                borderRadius: "12px",
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Log Out
            </button>
          </div>
        ) : null}

        <PageFooter />
      </div>
    </div>
  );
};

export function AccountPageView() {
  const router = useRouter();
  const pathname = usePathname();
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useUserStore((state) => state.currentUser);
  const { openCreateAccount, openLogin } = useAuthModal();

  if (!hasMounted || !authHasHydrated) {
    return <AuthHydrationFallback />;
  }

  const isLoggedIn = isAuthenticated;
  const firstName = String(currentUser?.firstName ?? "").trim();
  const lastName = String(currentUser?.lastName ?? "").trim();
  const displayName = `${firstName} ${lastName}`.trim() || currentUser?.username || "User";
  const accountId = String(
    currentUser?.id ?? currentUser?.mobileNumber ?? currentUser?.username ?? "Guest",
  );
  const balanceLabel = formatBalanceDisplay(
    currentUser?.currency ?? "NGN",
    currentUser?.availableBalance ?? 0,
  );

  function openAuth(mode: AuthMode) {
    if (mode === "register") {
      openCreateAccount(pathname);
      return;
    }
    openLogin(pathname);
  }

  function navigate(path: string, requiresAuth = false) {
    if (requiresAuth && !isLoggedIn) {
      openAuth("login");
      return;
    }

    router.push(path);
  }

  return (
    <ProfilePage
      accountId={accountId}
      balanceLabel={balanceLabel}
      displayName={displayName}
      isLoggedIn={isLoggedIn}
      onLogout={() => {
        logout();
        router.push("/");
      }}
      onNavigate={navigate}
      onOpenAuth={openAuth}
    />
  );
}
