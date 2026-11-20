import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/bricolage-grotesque";
import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { ReactQueryProvider } from "@/lib/query/provider";
import "./globals.css";

const SITE_URL = "https://pitchside-app-alpha.vercel.app";
const DESCRIPTION =
  "Live betting on football, basketball, ice hockey and tennis, plus casino games. Play money only.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Pitchside | Live betting and casino", template: "%s | Pitchside" },
  description: DESCRIPTION,
  applicationName: "Pitchside",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Pitchside",
    title: "Pitchside | Live betting and casino",
    description: DESCRIPTION,
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Pitchside on a phone, showing live matches" }],
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pitchside | Live betting and casino",
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#121A16",
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
