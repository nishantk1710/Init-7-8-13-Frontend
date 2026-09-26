import { AppToaster } from "@/components/shared/app-toaster";
import { Material360Drawer } from "@/components/shared/material-360-drawer";
import { Sidebar } from "@/components/layout/sidebar";
import { Material360Provider } from "@/lib/material-360-context";
import { InventoryWorkflowProvider } from "@/features/initiative-7/context/workflow-context";

/** The live frontend's shell. Served in live mode -- see src/proxy.ts. */
export default function LiveLayout({
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
