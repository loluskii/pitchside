"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronRight, Lock, LogIn, Save, ShieldCheck, UserRound } from "lucide-react";
import { AuthHydrationFallback } from "@/components/auth/AuthHydrationFallback";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { authApi } from "@/lib/api/auth";
import { extractResponseMessage, extractResponseSuccess } from "@/lib/auth/responses";
import { useAuthStore } from "@/store/authStore";
import { useUserStore } from "@/store/userStore";

type ProfileFormState = {
  address: string;
  city: string;
  dateOfBirth: string;
  email: string;
  firstName: string;
  gender: string;
  lastName: string;
};

const EMPTY_FORM: ProfileFormState = {
  address: "",
  city: "",
  dateOfBirth: "",
  email: "",
  firstName: "",
  gender: "",
  lastName: "",
};

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function buildInitialForm(currentUser: Record<string, unknown> | null): ProfileFormState {
  if (!currentUser) return EMPTY_FORM;

  return {
    firstName: readString(currentUser.firstName),
    lastName: readString(currentUser.lastName),
    email: readString(currentUser.email),
    address: readString(currentUser.address),
    city: readString(currentUser.city),
    dateOfBirth: readString(currentUser.dateOfBirth ?? currentUser.date_of_birth).slice(0, 10),
    gender: readString(currentUser.gender),
  };
}

function PersonalDetailsFormSections({
  currentUser,
  mobileNumber,
  refreshProfile,
}: {
  currentUser: Record<string, unknown> | null;
  mobileNumber: string | null;
  refreshProfile: () => Promise<void>;
}) {
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => buildInitialForm(currentUser));
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const username = String(currentUser?.username ?? mobileNumber ?? "").trim();
  const phoneNumber = String(
    currentUser?.phone ??
      currentUser?.mobileNumber ??
      mobileNumber ??
      "",
  ).trim();

  const isProfileDirty = useMemo(() => {
    const initialForm = buildInitialForm(currentUser);
    return Object.keys(initialForm).some((key) => {
      const field = key as keyof ProfileFormState;
      return initialForm[field] !== profileForm[field];
    });
  }, [currentUser, profileForm]);

  async function handleProfileSave() {
    if (!currentUser || isProfileSaving) return;

    setIsProfileSaving(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const payload = {
        userID: currentUser.id,
        roleId: currentUser.roleId,
        email: profileForm.email.trim(),
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phone:
          String(currentUser.phone ?? currentUser.mobileNumber ?? mobileNumber ?? "").trim(),
        address: profileForm.address.trim(),
        city: profileForm.city.trim(),
        dateOfBirth: profileForm.dateOfBirth,
        gender: profileForm.gender.trim(),
      };

      const response = await authApi.updateProfile(payload);
      if (!extractResponseSuccess(response)) {
        setProfileError(
          extractResponseMessage(response) ?? "Unable to update your personal details.",
        );
        return;
      }

      await refreshProfile();
      setProfileMessage("Personal details updated successfully.");
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : "Unable to update your personal details.",
      );
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handlePasswordSave() {
    if (isPasswordSaving) return;
    if (!oldPassword.trim() || !newPassword.trim()) {
      setPasswordError("Enter both your old and new passwords.");
      return;
    }

    setIsPasswordSaving(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      const response = await authApi.updatePassword({
        oldPassword: oldPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (!extractResponseSuccess(response)) {
        setPasswordError(
          extractResponseMessage(response) ?? "Unable to update your password.",
        );
        return;
      }

      setOldPassword("");
      setNewPassword("");
      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : "Unable to update your password.",
      );
    } finally {
      setIsPasswordSaving(false);
    }
  }

  return (
    <>
      <section className="">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="app-text-heading text-white">Profile Information</h2>
            <p className="app-text-caption mt-1 text-[var(--text-dim)]">
              First name, last name, email, address, city, gender, and date of birth.
            </p>
          </div>
          <span className="app-icon-box text-nav-active">
            <ShieldCheck className="app-icon" />
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-1">
          {(
            [
              ["firstName", "First Name", "text"],
              ["lastName", "Last Name", "text"],
              ["email", "Email", "email"],
              ["address", "Address", "text"],
              ["city", "City", "text"],
              ["dateOfBirth", "Date of Birth", "date"],
              ["gender", "Gender", "text"],
            ] as const
          ).map(([field, label, type]) => (
            <label key={field} className="space-y-2">
              <span className="app-text-label text-white mb-2">{label}</span>
              <input
                type={type}
                autoComplete="off"
                value={profileForm[field]}
                onChange={(event) => {
                  setProfileForm((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }));
                  setProfileError(null);
                  setProfileMessage(null);
                }}
                className="app-input placeholder:text-white/24"
                placeholder={label}
              />
            </label>
          ))}
        </div>

        {profileError ? (
          <p className="app-text-caption mt-4 text-[#D22B34]">{profileError}</p>
        ) : null}
        {profileMessage ? (
          <p className="app-text-caption mt-4 text-text-success">{profileMessage}</p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={!isProfileDirty || isProfileSaving}
            onClick={() => void handleProfileSave()}
            className="app-button app-button-primary font-bold"
          >
            <Save className="app-icon" />
            {isProfileSaving ? "Saving..." : "Save details"}
          </button>
        </div>
      </section>
    </>
  );
}

export function PersonalDetailsPageView() {
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const mobileNumber = useAuthStore((state) => state.mobileNumber);
  const currentUser = useUserStore((state) => state.currentUser);
  const refreshCurrentUser = useUserStore((state) => state.refreshCurrentUser);
  const { openLogin } = useAuthModal();

  async function refreshProfile() {
    await refreshCurrentUser(mobileNumber ?? undefined);
  }

  if (!hasMounted || !authHasHydrated) {
    return (
      <div className="space-y-4 px-3 py-4 pb-8">
        <AuthHydrationFallback />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-4 px-3 py-4 pb-8">
        <section className="rounded-2xl border border-white/6 bg-surface-elevated p-5">
          <div className="flex items-start gap-3">
            <span className="app-icon-box text-text-blue">
              <LogIn className="app-icon" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="app-text-heading text-white">Log in to manage your details</h1>
              <p className="app-text-body mt-2 text-[var(--text-dim)]">
                Personal details are only available to authenticated users.
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => openLogin("/account/personal-details")}
                  className="app-button app-button-primary font-semibold"
                >
                  Log in
                  <ChevronRight className="app-icon" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-3 py-4 pb-8">
      <PersonalDetailsFormSections
        key={JSON.stringify([
          currentUser?.id ?? "",
          currentUser?.firstName ?? "",
          currentUser?.lastName ?? "",
          currentUser?.email ?? "",
          currentUser?.address ?? "",
          currentUser?.city ?? "",
          currentUser?.dateOfBirth ?? currentUser?.date_of_birth ?? "",
          currentUser?.gender ?? "",
          currentUser?.phone ?? currentUser?.mobileNumber ?? mobileNumber ?? "",
        ])}
        currentUser={currentUser as Record<string, unknown> | null}
        mobileNumber={mobileNumber}
        refreshProfile={refreshProfile}
      />
    </div>
  );
}
