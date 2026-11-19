"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { authApi, extractNotificationItems } from "@/lib/api/auth";
import { queryKeys } from "@/lib/query/keys";

type NotificationItem = {
  id?: string | number;
  notificationId?: string | number;
  title?: string;
  subject?: string;
  message?: string;
  body?: string;
  content?: string;
  text?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  status?: number | string;
};

function getNotificationTitle(notification: NotificationItem) {
  return notification.title?.trim() || notification.subject?.trim() || "Notification";
}

function getNotificationBody(notification: NotificationItem) {
  return (
    notification.message?.trim() ||
    notification.body?.trim() ||
    notification.content?.trim() ||
    notification.text?.trim() ||
    "No message content was provided for this notification."
  );
}

function formatNotificationDate(notification: NotificationItem) {
  const rawValue =
    notification.createdAt ||
    notification.created_at ||
    notification.updatedAt ||
    notification.updated_at;

  if (!rawValue) return "";

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.user.notifications,
    queryFn: authApi.getNotifications,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
  const notifications = extractNotificationItems(data) as NotificationItem[];

  const updateNotification = async (notification: NotificationItem, action: "read" | "delete") => {
    const notificationId = notification.id ?? notification.notificationId;
    if (notificationId == null) return;

    const actionKey = `${action}:${notificationId}`;
    setPendingAction(actionKey);
    try {
      if (action === "read") {
        await authApi.markNotificationRead(notificationId);
        queryClient.setQueryData(queryKeys.user.notifications, (current: unknown) =>
          extractNotificationItems(current).map((item) =>
            String(item.id ?? item.notificationId) === String(notificationId)
              ? { ...item, status: 1 }
              : item,
          ),
        );
      } else {
        await authApi.deleteNotification(notificationId);
        queryClient.setQueryData(queryKeys.user.notifications, (current: unknown) =>
          extractNotificationItems(current).filter(
            (item) => String(item.id ?? item.notificationId) !== String(notificationId),
          ),
        );
      }
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="space-y-4 px-3 py-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-white/6 bg-surface-input p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="app-text-title text-white">Notifications</h1>
          </div>
          <span className="app-icon-box text-text-blue shadow-lg">
            <BellRing className="app-icon" />
          </span>
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`notification-skeleton-${index}`}
              className="animate-pulse rounded-2xl border border-white/6 bg-surface-elevated p-4"
            >
              <div className="h-4 w-1/2 rounded bg-white/5" />
              <div className="mt-3 h-3 w-full rounded bg-white/5" />
              <div className="mt-2 h-3 w-5/6 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-dashed border-border-gold/30 bg-surface-elevated px-4 py-10 text-center">
          <p className="app-text-heading text-white">Notifications are temporarily unavailable</p>
          <p className="app-text-body mt-2 text-[var(--text-dim)]">
            Your inbox could not be loaded right now. Try again shortly.
          </p>
        </div>
      ) : notifications.length ? (
        <div className="space-y-3">
          {notifications.map((notification, index) => (
            <article
              key={String(notification.id ?? notification.notificationId ?? index)}
              className="rounded-2xl border border-white/6 bg-surface-elevated p-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-icon text-nav-active">
                  <Bell size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                  <h2 className="app-text-heading text-white">
                      {getNotificationTitle(notification)}
                    </h2>
                    {Number(notification.status ?? 0) === 0 ? (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#D22B34]" />
                    ) : null}
                  </div>
                  <p className="app-text-body mt-2 text-[var(--text-dim)]">
                    {getNotificationBody(notification)}
                  </p>
                  {formatNotificationDate(notification) ? (
                    <p className="app-text-caption mt-3 font-medium text-white/45">
                      {formatNotificationDate(notification)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Number(notification.status ?? 0) === 0 ? (
                      <button
                        type="button"
                        disabled={pendingAction === `read:${notification.id ?? notification.notificationId}`}
                        onClick={() => void updateNotification(notification, "read")}
                        className="app-button app-button-secondary font-bold"
                      >
                        {pendingAction === `read:${notification.id ?? notification.notificationId}`
                          ? "Updating..."
                          : "Mark as read"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={pendingAction === `delete:${notification.id ?? notification.notificationId}`}
                      onClick={() => void updateNotification(notification, "delete")}
                      className="app-button app-button-outline font-bold text-[var(--text-dim)]"
                    >
                      {pendingAction === `delete:${notification.id ?? notification.notificationId}`
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-surface-elevated px-4 py-10 text-center">
          <p className="app-text-heading text-white">No notifications yet</p>
          <p className="app-text-body mt-2 text-[var(--text-dim)]">
            When Pitchside sends you account or sportsbook updates, they will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
