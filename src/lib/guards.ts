import { auth } from "@/auth";
import { forbidden, unauthorized } from "@/lib/api";
import { can, type Permission, type Role } from "@/lib/permissions";

/**
 * Authorisation helpers shared by route handlers and server components.
 *
 * Handlers ask for a permission, not a role. That keeps the rule in one
 * table (`lib/permissions.ts`) and means introducing a new role never
 * requires revisiting the endpoints it should reach.
 *
 * Route handlers throw; the wrapper in `lib/api.ts` turns the throw into the
 * right status code, so handlers never branch on auth themselves.
 */

export type SessionUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
};

/** The signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    role: session.user.role ?? "customer",
    name: session.user.name,
    email: session.user.email,
  };
}

/** The signed-in user, or a 401. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

/**
 * A signed-in user holding this permission, or a 401/403.
 *
 * The distinction matters: a signed-out visitor should be sent to sign in, a
 * signed-in one without the power should be told no.
 */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw forbidden("You do not have permission to do that.");
  }
  return user;
}

/** Anyone who may open the admin panel at all. */
export async function requireAdmin(): Promise<SessionUser> {
  return requirePermission("admin:access");
}
