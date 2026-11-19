export const AUTH_TOKEN_KEY = "PS-TOKEN";
export const SESSION_EXPIRED_EVENT = "pitchside:session-expired";

export type SessionExpiredEventDetail = {
  returnUrl?: string;
};

type RouteGroupName = "auth" | "public" | "protected";

type RouteGroupConfig = {
  label: string;
  description: string;
  prefixes: readonly string[];
};

export const APP_ROUTE_GROUPS: Record<RouteGroupName, RouteGroupConfig> = {
  auth: {
    label: "Auth pages",
    description: "Pages used to sign in, register a new account, or recover access.",
    prefixes: ["/login", "/create-account", "/forgot-password"],
  },
  public: {
    label: "Public pages",
    description: "Pages that are useful for guests and signed-in users.",
    prefixes: [
      "/",
      "/account",
      "/sports",
      "/live",
      "/casino",
      "/search",
      "/promotions",
      "/transactions",
      "/load-code",
      "/results",
      "/my-bets",
    ],
  },
  protected: {
    label: "Protected pages",
    description: "Pages that require an active authenticated session.",
    prefixes: ["/deposit", "/withdraw", "/notifications"],
  },
} as const;

export const AUTH_ROUTE_PREFIXES = APP_ROUTE_GROUPS.auth.prefixes;
export const PUBLIC_ROUTE_PREFIXES = APP_ROUTE_GROUPS.public.prefixes;
export const PROTECTED_ROUTE_PREFIXES = APP_ROUTE_GROUPS.protected.prefixes;

export function matchesPathPrefix(pathname: string, routePrefix: string): boolean {
  if (routePrefix === "/") {
    return pathname === "/";
  }

  return pathname === routePrefix || pathname.startsWith(`${routePrefix}/`);
}

export function matchesAnyPathPrefix(
  pathname: string,
  routePrefixes: readonly string[],
): boolean {
  return routePrefixes.some((routePrefix) => matchesPathPrefix(pathname, routePrefix));
}

export function isAuthRoute(pathname: string): boolean {
  return matchesAnyPathPrefix(pathname, AUTH_ROUTE_PREFIXES);
}

export function isPublicRoute(pathname: string): boolean {
  return matchesAnyPathPrefix(pathname, PUBLIC_ROUTE_PREFIXES);
}

export function isProtectedRoute(pathname: string): boolean {
  return matchesAnyPathPrefix(pathname, PROTECTED_ROUTE_PREFIXES);
}

export function getRouteGroup(pathname: string): RouteGroupName | null {
  if (isAuthRoute(pathname)) return "auth";
  if (isProtectedRoute(pathname)) return "protected";
  if (isPublicRoute(pathname)) return "public";
  return null;
}

export function normalizeReturnUrl(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (typeof value !== "string") return fallback;

  const normalized = value.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return fallback;
  }

  return normalized;
}

export function buildAuthRouteHref(
  pathname: string,
  returnUrl: string | null | undefined,
): string {
  const normalizedReturnUrl = normalizeReturnUrl(returnUrl, "");

  if (!normalizedReturnUrl) {
    return pathname;
  }

  const params = new URLSearchParams({ returnUrl: normalizedReturnUrl });
  return `${pathname}?${params.toString()}`;
}
