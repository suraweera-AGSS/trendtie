import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getSessionUser } from "@/lib/guards";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Admin shell and the route guard for everything beneath /admin.
 *
 * Guarding in the layout covers every nested page at once, so a new admin
 * screen is protected by existing rather than by someone remembering to add a
 * check. The API routes guard themselves separately with the same
 * permissions: this stops a customer seeing the pages, `requirePermission`
 * stops them reaching the data.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect("/login?callbackUrl=/admin");
  if (!can(user.role, "admin:access")) redirect("/account");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <AdminSidebar role={user.role} email={user.email} />
      <main id="main-content" className="min-w-0 flex-1 bg-paper">
        {children}
      </main>
    </div>
  );
}
