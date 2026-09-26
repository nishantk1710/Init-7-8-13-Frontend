import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

import { DataModeBanner } from "@/components/shared/data-mode";

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
 * Shared by both frontends this app serves (see src/proxy.ts):
 *
 *   live   app/(live)/  -- this branch's frontend, reading the real backend
 *   demo   app/demo/    -- main's frontend as it was, on its own mock data
 *
 * Each brings its own shell (sidebar, providers) in its own layout; this one
 * only holds what they have in common, plus the strip saying which is showing.
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
          <DataModeBanner />
          <div className="flex min-h-0 flex-1">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
