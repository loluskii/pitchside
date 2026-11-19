import { ForgotPasswordPageView } from "@/components/auth/ForgotPasswordPageView";
import { normalizeReturnUrl } from "@/lib/auth/session";

interface ForgotPasswordPageProps {
  searchParams: Promise<{ returnUrl?: string | string[] }>;
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const { returnUrl } = await searchParams;
  const requestedReturnUrl = Array.isArray(returnUrl) ? returnUrl[0] : returnUrl;

  return (
    <ForgotPasswordPageView
      requestedReturnUrl={normalizeReturnUrl(requestedReturnUrl, "")}
    />
  );
}
