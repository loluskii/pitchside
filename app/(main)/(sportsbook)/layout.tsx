import { MainChrome } from "@/components/layout/MainChrome";

export default function SportsbookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainChrome>{children}</MainChrome>;
}
