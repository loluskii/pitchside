import { RealtimeChrome } from "@/components/layout/RealtimeChrome";

export default function SportsbookRealtimeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RealtimeChrome>{children}</RealtimeChrome>;
}
