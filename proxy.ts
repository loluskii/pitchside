import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_TOKEN_KEY,
  isAuthRoute,
  isProtectedRoute,
  normalizeReturnUrl,
} from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestedReturnUrl = request.nextUrl.searchParams.get("returnUrl");
  const token = request.cookies.get(AUTH_TOKEN_KEY)?.value;
  const isAuthenticated = Boolean(token);
  const protectedRoute = isProtectedRoute(pathname);
  const authRoute = isAuthRoute(pathname);

  if (protectedRoute && !isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("returnUrl", normalizeReturnUrl(`${pathname}${search}`));
    return NextResponse.redirect(url);
  }

  if (authRoute && isAuthenticated) {
    const redirectPath = normalizeReturnUrl(requestedReturnUrl, "/");
    return NextResponse.redirect(
      new URL(isAuthRoute(redirectPath) ? "/" : redirectPath, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|public).*)",
  ],
};
