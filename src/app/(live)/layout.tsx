import { AppToaster } from "@/components/shared/app-toaster";
import { RoleProvider } from "@/components/shared/role-context";
import { Sidebar } from "@/components/layout/sidebar";

/** The app shell. */
export default function LiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RoleProvider>
      <div className="flex min-h-0 min-w-0 flex-1 bg-canvas">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
      <AppToaster />
    </RoleProvider>
  );
}
