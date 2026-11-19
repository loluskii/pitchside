import { LoginPageView } from "@/components/auth/LoginPageView";
import { normalizeReturnUrl } from "@/lib/auth/session";

interface LoginPageProps {
  searchParams: Promise<{ returnUrl?: string | string[] }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { returnUrl } = await searchParams;
  const requestedReturnUrl = Array.isArray(returnUrl) ? returnUrl[0] : returnUrl;

  return <LoginPageView requestedReturnUrl={normalizeReturnUrl(requestedReturnUrl, "")} />;
}
