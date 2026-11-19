import { apiClient } from "@/lib/api";
import { BASE_API, CLIENT_ID } from "./config";

type NotificationRecord = Record<string, unknown>;

function isNotificationRecord(value: unknown): value is NotificationRecord {
  return Boolean(value) && typeof value === "object";
}

function isNotificationItem(value: unknown): value is NotificationRecord {
  if (!isNotificationRecord(value)) return false;

  return [
    value.id,
    value.notificationId,
    value.title,
    value.subject,
    value.body,
    value.content,
    value.text,
    value.message,
  ].some((field) => typeof field === "string" ? field.trim().length > 0 : field != null);
}

export function extractNotificationItems(payload: unknown): NotificationRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isNotificationItem);
  }

  if (!isNotificationRecord(payload)) return [];

  const data = payload.data ?? payload.notifications ?? payload.notification ?? payload;

  if (Array.isArray(data)) {
    return data.filter(isNotificationItem);
  }

  if (!isNotificationRecord(data)) {
    return [];
  }

  const candidates = [data.notifications, data.items, data.data];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isNotificationItem);
    }

    if (isNotificationItem(candidate)) {
      return [candidate];
    }
  }

  return isNotificationItem(data) ? [data] : [];
}

export const authApi = {
  login: (payload: { username: string; password: string; clientId?: string | number }) =>
    apiClient
      .post(`${BASE_API}/auth/login?source=mobile`, {
        ...payload,
        clientId: payload.clientId ?? CLIENT_ID,
      })
      .then((r) => r.data),

  register: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/auth/register/`, payload).then((r) => r.data),

  sendOTP: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/notification/send-otp`, payload).then((r) => r.data),

  verifyOTP: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/notification/verify-otp`, payload).then((r) => r.data),

  verifyUsername: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/auth/verify-username`, payload).then((r) => r.data),

  resetPassword: (payload: Record<string, unknown>) =>
    apiClient.patch(`${BASE_API}/auth/update/reset-password`, payload).then((r) => r.data),

  updateProfile: (payload: Record<string, unknown>) =>
    apiClient.put(`${BASE_API}/auth/update/details`, payload).then((r) => r.data),

  updatePassword: (payload: { oldPassword: string; newPassword: string }) =>
    apiClient
      .put(`${BASE_API}/auth/update/password/`, {
        clientId: CLIENT_ID,
        oldPassword: payload.oldPassword,
        password: payload.newPassword,
      })
      .then((r) => r.data),

  setSelfExclusion: (payload: { days: number }) =>
    apiClient
      .post(`${BASE_API}/auth/self-exclusion`, {
        clientId: Number(CLIENT_ID),
        days: payload.days,
      })
      .then((r) => r.data),

  getSelfExclusionStatus: () =>
    apiClient
      .get(`${BASE_API}/auth/self-exclusion/status/${CLIENT_ID}`)
      .then((r) => r.data),

  deactivateAccount: (payload: { reason: string }) =>
    apiClient
      .post(`${BASE_API}/auth/deactivate-account`, {
        clientId: Number(CLIENT_ID),
        reason: payload.reason,
      })
      .then((r) => r.data),

  submitKYC: (payload: FormData | Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/auth/kyc`, payload).then((r) => r.data),

  getDetails: () =>
    apiClient.get(`${BASE_API}/auth/details/${CLIENT_ID}`).then((r) => r.data),

  getGlobalVars: () =>
    apiClient.get(`${BASE_API}/auth/globalvariables/${CLIENT_ID}`).then((r) => r.data),

  getNotifications: () =>
    apiClient.get(`${BASE_API}/notification/user`).then((r) => r.data),

  markNotificationRead: (notificationId: string | number) =>
    apiClient
      .patch(`${BASE_API}/notification/user/${encodeURIComponent(String(notificationId))}/read`)
      .then((r) => r.data),

  deleteNotification: (notificationId: string | number) =>
    apiClient
      .delete(`${BASE_API}/notification/user/${encodeURIComponent(String(notificationId))}`)
      .then((r) => r.data),
};
