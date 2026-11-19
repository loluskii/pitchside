import axios, { isAxiosError } from "axios";
import Cookies from "js-cookie";
import CryptoJS from "crypto-js";
import { APP_KEY, CLIENT_ID } from "@/lib/api/config";
import { AUTH_TOKEN_KEY } from "@/lib/auth/session";
import { SESSION_EXPIRED_EVENT, type SessionExpiredEventDetail } from "@/lib/auth/session";
import { useAuthStore } from "@/store/authStore";

/**
 * AES-128 / SHA-256 request signing.
 * Every outbound API request gets three headers:
 *   X-Client-ID       → operator ID
 *   X-Api-Key         → SHA-256(clientId:appKey) hex
 *   X-Api-Signature   → AES-CBC(timestamp, key, iv) — ivHex + ciphertextHex
 */

export function getClientId(): string {
  return CLIENT_ID;
}

function generateApiKey(): string {
  return CryptoJS.enc.Hex.stringify(CryptoJS.SHA256(`${CLIENT_ID}:${APP_KEY}`));
}

function generateSignature(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.enc.Hex.parse(generateApiKey());

  const encrypted = CryptoJS.AES.encrypt(timestamp, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return iv.toString(CryptoJS.enc.Hex) + encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}

export function getAuthHeaders(): Record<string, string> {
  return {
    "X-Client-ID": CLIENT_ID,
    "X-Api-Key": generateApiKey(),
    "X-Api-Signature": generateSignature(),
  };
}

function getPersistedToken(): string | null {
  const cookieToken = Cookies.get(AUTH_TOKEN_KEY);
  if (cookieToken) return cookieToken;

  if (typeof window === "undefined") return null;

  try {
    const persisted = JSON.parse(localStorage.getItem("pitchside-auth") ?? "{}") as {
      state?: { token?: unknown };
    };
    return typeof persisted.state?.token === "string" ? persisted.state.token : null;
  } catch {
    return null;
  }
}

function clearFrontendSession() {
  useAuthStore.getState().logout();

  if (typeof window === "undefined") return;

  localStorage.removeItem("pitchside-auth");
  localStorage.removeItem("pitchside-user");
  localStorage.removeItem("pitchside-query-cache-static");
}

function getCurrentReturnUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<SessionExpiredEventDetail>(SESSION_EXPIRED_EVENT, {
      detail: { returnUrl: getCurrentReturnUrl() },
    }),
  );
}

export class ApiClientError extends Error {
  status: number | null;
  data: unknown;

  constructor(message: string, options: { data?: unknown; status?: number | null } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.data = options.data;
    this.status = options.status ?? null;
  }
}

export function isApiClientError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

export const apiClient = axios.create({
  // Fetch adapter so requests reach the in-process engine (lib/engine/install.ts).
  adapter: "fetch",
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

/** Attach signing headers + Bearer token on every request */
apiClient.interceptors.request.use((config) => {
  // AES/SHA-256 signing — X-Client-ID, X-Api-Key, X-Api-Signature
  Object.assign(config.headers, getAuthHeaders());

  const token = getPersistedToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

/** Auto-logout on 401, surface errors cleanly */
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (isAxiosError(err) && err.code === "ERR_CANCELED") {
      return Promise.reject(err);
    }

    const status = err.response?.status;

    if (status === 401 && typeof window !== "undefined") {
      clearFrontendSession();
      notifySessionExpired();
    }
    const message =
      err.response?.data?.message ?? err.response?.data ?? err.message ?? "Unknown error";
    return Promise.reject(
      new ApiClientError(String(message), {
        data: err.response?.data,
        status,
      }),
    );
  }
);

/** Separate unauthenticated client for public endpoints (no signing overhead) */
export const publicClient = axios.create({
  adapter: "fetch",
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "/api",
  timeout: 30_000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});
