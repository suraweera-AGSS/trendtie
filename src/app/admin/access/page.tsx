import type { Metadata } from "next";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  can,
  permissionsFor,
} from "@/lib/permissions";
import { getSessionUser } from "@/lib/guards";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { RoleManager } from "@/components/admin/role-manager";

export const metadata: Metadata = {
  title: "Roles and access",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The access page: what every role can do, and who holds which role.
 *
 * The matrix is generated from the same table the API enforces, so it cannot
 * drift from reality the way a hand-written permissions document does.
 */
export default async function AccessPage() {
  const viewer = await getSessionUser();
  const mayManage = can(viewer?.role, "roles:manage");

  await connectToDatabase();

  const staff = mayManage
    ? await User.find({ role: { $ne: "customer" } })
        .sort({ role: -1, createdAt: 1 })
        .lean()
    : [];

  return (
    <div className="px-6 py-10 lg:px-10 lg:py-12">
      <header>
        <p className="eyebrow text-muted">Access control</p>
        <h1 className="mt-4 text-title">Roles and access</h1>
        <p className="mt-4 max-w-measure text-sm text-muted">
          Permissions are granted to roles, not to people. Every role inherits
          the one below it and adds powers, so anyone with a role can do
          everything the role beneath it can.
        </p>
      </header>

      {/* Role summary */}
      <section className="mt-12">
        <h2 className="type-wide text-sm font-semibold">The four roles</h2>
        <div className="mt-6 grid gap-px border border-line bg-line lg:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((role) => {
            const held = permissionsFor(role);
            return (
              <article key={role} className="flex flex-col bg-paper p-6">
                <h3 className="type-wide text-sm font-semibold">
                  {ROLE_LABELS[role]}
                </h3>
                <p className="mt-1.5 text-xs tabular-nums text-muted">
                  {held.length} of {Object.keys(PERMISSION_LABELS).length} powers
                </p>
                <p className="mt-4 text-xs text-muted">{ROLE_DESCRIPTIONS[role]}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* The matrix */}
      <section className="mt-14">
        <h2 className="type-wide text-sm font-semibold">What each role can do</h2>
        <p className="mt-1.5 text-xs text-muted">
          A filled square means the role holds that power.
        </p>

        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="eyebrow p-4 text-left text-muted">
                  Power
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role}
                    scope="col"
                    className="eyebrow p-4 text-center text-muted"
                  >
                    {ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((group) => (
                <>
                  <tr key={group.title} className="border-b border-line bg-wash">
                    <th
                      scope="colgroup"
                      colSpan={ROLES.length + 1}
                      className="eyebrow p-3 text-left"
                    >
                      {group.title}
                    </th>
                  </tr>
                  {group.permissions.map((permission) => (
                    <tr key={permission} className="border-b border-line last:border-0">
                      <th scope="row" className="p-4 text-left font-normal">
                        {PERMISSION_LABELS[permission]}
                      </th>
                      {ROLES.map((role) => {
                        const allowed = can(role, permission);
                        return (
                          <td key={role} className="p-4 text-center">
                            {/* Shape, not colour: a filled square reads in
                                any palette and survives printing. */}
                            <span
                              aria-hidden
                              className={
                                allowed
                                  ? "inline-block size-3 bg-ink"
                                  : "inline-block size-3 border border-line"
                              }
                            />
                            <span className="sr-only">
                              {allowed ? "Allowed" : "Not allowed"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Assignment */}
      {mayManage ? (
        <section className="mt-14">
          <h2 className="type-wide text-sm font-semibold">Who has access</h2>
          <p className="mt-1.5 text-xs text-muted">
            Customers are not listed. You cannot change your own role, and the
            last super admin cannot be demoted.
          </p>
          <RoleManager
            viewerId={viewer?.id ?? ""}
            people={staff.map((person) => ({
              id: String(person._id),
              name: person.name,
              email: person.email,
              role: person.role,
            }))}
          />
        </section>
      ) : (
        <section className="mt-14 border border-line p-6">
          <h2 className="type-wide text-sm font-semibold">Who has access</h2>
          <p className="mt-3 text-sm text-muted">
            Only a super admin can see and change who holds which role.
          </p>
        </section>
      )}
    </div>
  );
}
