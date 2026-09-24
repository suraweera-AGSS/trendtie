"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Person = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Role assignment.
 *
 * Promotions apply immediately, demotions ask first: taking access away is
 * the change someone is more likely to make by mistake and less likely to
 * notice. The server enforces both rules again, including the two it cannot
 * trust the client for — no self-edits, and never remove the last super
 * admin.
 */
export function RoleManager({
  people,
  viewerId,
}: {
  people: Person[];
  viewerId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign(person: Person, role: Role) {
    if (role === person.role) return;

    const losingAccess = ROLES.indexOf(role) < ROLES.indexOf(person.role as Role);
    if (
      losingAccess &&
      !window.confirm(
        `Change ${person.name} from ${ROLE_LABELS[person.role as Role]} to ${ROLE_LABELS[role]}? They will lose access immediately.`,
      )
    ) {
      return;
    }

    setBusyId(person.id);
    setError(null);

    const response = await fetch(`/api/admin/users/${person.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not change that role.");
    }

    setBusyId(null);
    router.refresh();
  }

  if (people.length === 0) {
    return (
      <p className="mt-6 border border-line p-8 text-center text-sm text-muted">
        Nobody has been given a role yet.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-5 border border-ink p-4 text-sm">
          {error}
        </p>
      )}

      <ul className="border border-line">
        {people.map((person) => {
          const isSelf = person.id === viewerId;
          return (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {person.name}
                  {isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}
                </p>
                <p className="mt-1 truncate text-xs text-muted">{person.email}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => {
                  const current = person.role === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={isSelf || busyId === person.id}
                      aria-pressed={current}
                      onClick={() => assign(person, role)}
                      className={cn(
                        "type-wide border px-3 py-1.5 text-[0.625rem] tracking-wide-caps uppercase",
                        "transition-[background-color,color,border-color] duration-(--duration-quick) ease-out-soft",
                        current
                          ? "border-ink bg-ink text-paper"
                          : "border-line text-muted hover:border-ink",
                        isSelf
                          ? "cursor-not-allowed opacity-40"
                          : "cursor-pointer disabled:opacity-40",
                      )}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
