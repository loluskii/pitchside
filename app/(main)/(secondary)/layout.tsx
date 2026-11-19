import { SecondaryChrome } from "@/components/layout/SecondaryChrome";

export default function SecondaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SecondaryChrome>{children}</SecondaryChrome>;
}
