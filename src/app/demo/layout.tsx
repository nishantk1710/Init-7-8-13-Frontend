import { AppToaster } from "@demo/components/shared/app-toaster";
import { Material360Drawer } from "@demo/components/shared/material-360-drawer";
import { Sidebar } from "@demo/components/layout/sidebar";
import { Material360Provider } from "@demo/lib/material-360-context";
import { InventoryWorkflowProvider } from "@demo/features/initiative-7/context/workflow-context";

/**
 * The demo frontend's shell: main's root layout, minus the <html>/<body> the
 * shared root layout now owns. Everything under app/demo/ and src/demo/ is
 * main's frontend copied as it was, with `@/` imports pointed at `@demo/`.
 *
 * Reached without "/demo" in the URL: in demo mode src/proxy.ts rewrites
 * /home to /demo/home and so on, so main's own links keep working unchanged.
 *
 * Rendered per request, never prerendered: a prerendered page reached through
 * a rewrite can read a different pathname on the server than in the browser,
 * which breaks the sidebar's active-item highlight (usePathname).
 */
export const dynamic = "force-dynamic";

export default function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
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
  );
}
