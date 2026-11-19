"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, X } from "lucide-react";
import { authApi, extractNotificationItems } from "@/lib/api/auth";
import { queryKeys } from "@/lib/query/keys";
import { useAuthStore } from "@/store/authStore";

function getNotificationId(notification: Record<string, unknown>, index: number) {
  return String(notification.id ?? notification.notificationId ?? index);
}

export function NotificationPrompt() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const authHasHydrated = useAuthStore((state) => state.hasHydrated);
  const { data } = useQuery({
    queryKey: queryKeys.user.notifications,
    queryFn: authApi.getNotifications,
    enabled: authHasHydrated && isAuthenticated && pathname !== "/notifications",
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const notifications = extractNotificationItems(data);
  const unread = notifications.filter((notification) => Number(notification.status ?? 0) === 0);
  const fingerprint = unread.map((notification, index) => getNotificationId(notification, index)).join(",");
  const promptKey = `pitchside:notification-prompt:${fingerprint}`;
  const [dismissedPromptKey, setDismissedPromptKey] = useState<string | null>(null);
  const isDismissedInSession = useSyncExternalStore(
    () => () => {},
    () => !fingerprint || window.sessionStorage.getItem(promptKey) === "1",
    () => true,
  );
  const isDismissed = isDismissedInSession || dismissedPromptKey === promptKey;

  if (!authHasHydrated || !isAuthenticated || pathname === "/notifications" || !unread.length || isDismissed) {
    return null;
  }

  const dismiss = () => {
    window.sessionStorage.setItem(promptKey, "1");
    setDismissedPromptKey(promptKey);
  };

  return (
    <div className="fixed inset-0 z-menu flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[360px] rounded-3xl bg-white p-6 text-[#E9EAE7] shadow-xl">
        <button
          type="button"
          aria-label="Close notifications prompt"
          onClick={dismiss}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-[#191916] text-[#8F9281]"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4 pr-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#15803D] text-[#15803D]">
            <Mail size={28} strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-base font-black uppercase tracking-[0.16em] text-[#D22B34]">
              Messages waiting
            </p>
            <h2 className="mt-2 text-5xl font-black leading-[1.08]">
              You have {unread.length} new {unread.length === 1 ? "message" : "messages"}
            </h2>
          </div>
        </div>

        <div className="mt-6 inline-flex rounded-full border border-[#21221D] bg-[#111210] px-4 py-2 text-lg font-semibold text-[#E9EAE7]">
          <strong className="mr-1 text-[#15803D]">{unread.length}</strong>
          new {unread.length === 1 ? "message" : "messages"}
        </div>

        <Link
          href="/notifications"
          onClick={dismiss}
          className="mt-5 flex h-12 items-center justify-center rounded-lg bg-[#D22B34] text-2xl font-black text-white transition hover:bg-[#D22B34]"
        >
          Open
        </Link>
      </div>
    </div>
  );
}
