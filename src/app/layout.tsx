import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

import { DataModeBanner } from "@/components/shared/data-mode";
import { AuthBridge } from "@/components/auth/auth-bridge";
// Registers the server's access-token provider for lib/api/client.ts, so
// server components call the backend as the signed-in user (AUTH_MODE=entra).
import "@/auth";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Spares AI",
  description:
    "One integrated spares management application — inventory planning, repairable spares and OAR utilization tracking.",
};

/**
 * Root layout: theme provider plus the strip shown when the live backend is
 * down. The app shell (sidebar, providers) lives in app/(live)/layout.tsx.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full min-h-0 flex-col overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthBridge />
          <DataModeBanner />
          <div className="flex min-h-0 flex-1">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
