"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import { PageFooter } from "@/components/layout/PageFooter";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/uiStore";

const NotificationPrompt = dynamic(
  () => import("@/components/layout/NotificationPrompt").then((mod) => mod.NotificationPrompt),
  { ssr: false, loading: () => null },
);

export function SecondaryChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const showMobileNavigation = useUIStore((state) => state.showMobileNavigation);
  const isAccountRoute = pathname === "/account";
  const isWalletActionRoute = pathname === "/deposit" || pathname === "/withdraw";
  const isCasinoRoute = pathname.startsWith("/casino");
  const isCasinoPlayRoute = pathname.startsWith("/casino/play/");

  return (
    <>
      {!isAccountRoute && !isCasinoPlayRoute ? <Header /> : null}
      <main
        className={cn(
          "flex flex-col gap-y-3 p-3",
          !isAccountRoute && !isWalletActionRoute && !isCasinoRoute && "with-footer",
          isAccountRoute && "gap-y-0 p-0",
          isCasinoPlayRoute && "gap-y-0 p-0",
          showMobileNavigation && !isCasinoPlayRoute && "pb-20",
        )}
      >
        {children}
        {!isAccountRoute && !isWalletActionRoute && !isCasinoRoute ? <PageFooter /> : null}
      </main>
      {showMobileNavigation && !isCasinoPlayRoute ? <MobileNavigation /> : null}
      <NotificationPrompt />
    </>
  );
}
