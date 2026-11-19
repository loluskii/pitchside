import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/bricolage-grotesque";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { ReactQueryProvider } from "@/lib/query/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitchside — Live odds, every minute",
  description: "A mobile sportsbook running on a live match simulation: fixtures every hour, prices that move, tickets that settle.",
  icons: { icon: "/brand/mark.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1B1B18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[var(--bg-main)] text-foreground">
        <ReactQueryProvider>
          <AuthModalProvider>{children}</AuthModalProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
