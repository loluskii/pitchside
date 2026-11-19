import type { Metadata } from "next";
import { WalletActionView } from "@/components/wallet/WalletActionView";

export const metadata: Metadata = { title: "Add funds · Pitchside" };

export default function Page() {
  return <WalletActionView mode="deposit" />;
}
