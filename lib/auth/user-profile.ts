import { authApi } from "@/lib/api/auth";
import { extractResponseMessage } from "@/lib/auth/responses";
import type { UserProfile } from "@/store/userStore";

type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === "object";
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asId(value: unknown): string | number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return asString(value);
}

function asNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function extractUserPayload(payload: unknown): ApiRecord | null {
  if (!isRecord(payload)) return null;

  if (isRecord(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload.user)) {
    return payload.user;
  }

  return payload;
}

export function extractCurrentUserProfile(
  payload: unknown,
  fallbackUsername?: string,
): UserProfile | null {
  const source = extractUserPayload(payload);
  if (!source) return null;

  const username =
    asString(source.username) ??
    asString(source.mobileNumber) ??
    asString(source.phone) ??
    fallbackUsername;

  if (!username) return null;

  return {
    ...source,
    id: asId(source.id) ?? asId(source.userId) ?? asId(source.user_id) ?? "",
    username,
    mobileNumber: asString(source.mobileNumber) ?? asString(source.phone) ?? username,
    phone: asString(source.phone) ?? asString(source.mobileNumber) ?? username,
    email: asString(source.email),
    availableBalance: asNumber(source.availableBalance ?? source.balance ?? source.walletBalance),
    sportBonusBalance: asNumber(source.sportBonusBalance),
    casinoBonusBalance: asNumber(source.casinoBonusBalance),
    virtualBonusBalance: asNumber(source.virtualBonusBalance),
    trustBalance: asNumber(source.trustBalance),
    currency: asString(source.currency) ?? "NGN",
    kycStatus: asString(source.kycStatus ?? source.kyc_status),
    firstName: asString(source.firstName ?? source.first_name),
    lastName: asString(source.lastName ?? source.last_name),
    address: asString(source.address),
    city: asString(source.city),
    gender: asString(source.gender),
    dateOfBirth: asString(source.dateOfBirth ?? source.date_of_birth),
  } as UserProfile;
}

export async function fetchCurrentUserProfile(
  fallbackUsername?: string,
): Promise<UserProfile> {
  const response = await authApi.getDetails();
  const profile = extractCurrentUserProfile(response, fallbackUsername);

  if (!profile) {
    throw new Error(
      extractResponseMessage(response) ?? "Unable to load your account details.",
    );
  }

  return profile;
}
