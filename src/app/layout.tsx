import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

import { AppToaster } from "@/components/shared/app-toaster";
import { Material360Drawer } from "@/components/shared/material-360-drawer";
import { Sidebar } from "@/components/layout/sidebar";
import { Material360Provider } from "@/lib/material-360-context";
import { InventoryWorkflowProvider } from "@/features/initiative-7/context/workflow-context";

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
      <body className="flex h-full min-h-0 overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Material360Provider>
            {/* Global, not just /inventory-planning/* — both the Approvals
                page and the Action Center's Inventory Planning tab render
                the same ApprovalsWorkspace and need the same live state,
                not a second, desynced copy. */}
            <InventoryWorkflowProvider>
              <Sidebar />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
              <Material360Drawer />
              <AppToaster />
            </InventoryWorkflowProvider>
          </Material360Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
