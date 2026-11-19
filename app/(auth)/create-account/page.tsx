import { CreateAccountPageView } from "@/components/auth/CreateAccountPageView";
import { normalizeReturnUrl } from "@/lib/auth/session";

interface CreateAccountPageProps {
  searchParams: Promise<{ returnUrl?: string | string[] }>;
}

export default async function CreateAccountPage({ searchParams }: CreateAccountPageProps) {
  const { returnUrl } = await searchParams;
  const requestedReturnUrl = Array.isArray(returnUrl) ? returnUrl[0] : returnUrl;

  return (
    <CreateAccountPageView
      requestedReturnUrl={normalizeReturnUrl(requestedReturnUrl, "")}
    />
  );
}
