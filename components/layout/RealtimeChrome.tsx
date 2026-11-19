"use client";

import dynamic from "next/dynamic";

const SportsbookRealtimeBridge = dynamic(
  () =>
    import("@/components/layout/SportsbookRealtimeBridge").then(
      (mod) => mod.SportsbookRealtimeBridge,
    ),
  { ssr: false, loading: () => null },
);

export function RealtimeChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SportsbookRealtimeBridge />
      {children}
    </>
  );
}
