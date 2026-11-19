import "@/lib/engine/install";
import { ENGINE_ORIGIN } from "@/lib/engine/upstream";

// All services are answered by the in-process match engine (see lib/engine).
export const BASE_API = `${ENGINE_ORIGIN}/platform`;
export const FIXTURES_API = `${ENGINE_ORIGIN}/fixtures`;
export const CLIENT_FIXTURES_API = FIXTURES_API;
export const BET_API = `${ENGINE_ORIGIN}/bet`;
export const CASINO_API = `${ENGINE_ORIGIN}/casino`;

export const CLIENT_ID = "1";
export const APP_KEY = "PSD";
const pad = (n: number) => String(n).padStart(2, "0");

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const off = new Date().getTimezoneOffset();
export const TZ = `${off >= 0 ? "-" : "+"}${Math.abs(off / 60)}`;

export interface PeriodFilter {
  startDate?: string;
  endDate?: string;
}
