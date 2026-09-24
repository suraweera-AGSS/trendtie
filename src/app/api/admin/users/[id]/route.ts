import { connectToDatabase } from "@/lib/db";
import { Order, User } from "@/models";
import { badRequest, forbidden, jsonOk, notFound, parseJson, route } from "@/lib/api";
import { objectIdSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/guards";
import { ROLES, ROLE_RANK, type Role } from "@/lib/permissions";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };

const roleUpdateSchema = z.object({ role: z.enum(ROLES) });

async function validId(context: Context) {
  const { id } = await context.params;
  if (!objectIdSchema.safeParse(id).success) {
    throw badRequest("That is not a valid user id.");
  }
  return id;
}

/** GET /api/admin/users/[id] */
export const GET = route(async (_request: Request, context: Context) => {
  await requirePermission("customers:read");
  const id = await validId(context);

  await connectToDatabase();
  const user = await User.findById(id).lean();
  if (!user) throw notFound("No such user.");

  const orders = await Order.countDocuments({ userId: id });

  return jsonOk({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: (user.createdAt ?? new Date()).toISOString(),
      orderCount: orders,
    },
  });
});

/**
 * PATCH /api/admin/users/[id] — change someone's role.
 *
 * Two rules protect the store from losing its owner:
 *
 * 1. You cannot change your own role. Otherwise a super admin could demote
 *    themselves by accident and nobody would be able to put it back.
 * 2. The last super admin cannot be demoted. Losing the final account that
 *    can grant access is unrecoverable through the UI.
 */
export const PATCH = route(async (request: Request, context: Context) => {
  const actor = await requirePermission("roles:manage");
  const id = await validId(context);
  const { role } = await parseJson(request, roleUpdateSchema);

  if (id === actor.id) {
    throw forbidden("You cannot change your own role.");
  }

  await connectToDatabase();

  const target = await User.findById(id);
  if (!target) throw notFound("No such user.");

  if (target.role === "super_admin" && role !== "super_admin") {
    const remaining = await User.countDocuments({
      role: "super_admin",
      _id: { $ne: id },
    });
    if (remaining === 0) {
      throw forbidden(
        "That is the last super admin. Promote someone else before demoting this account.",
      );
    }
  }

  const previous = target.role as Role;
  target.role = role;
  await target.save();

  return jsonOk({
    user: {
      id: String(target._id),
      name: target.name,
      email: target.email,
      role: target.role,
    },
    changed: previous !== role,
    direction:
      ROLE_RANK[role] > ROLE_RANK[previous]
        ? "promoted"
        : ROLE_RANK[role] < ROLE_RANK[previous]
          ? "demoted"
          : "unchanged",
  });
});

/**
 * DELETE /api/admin/users/[id] — remove an account.
 *
 * Refused while the account still has orders: those records reference the
 * user, and deleting it would leave order history pointing at nothing.
 */
export const DELETE = route(async (_request: Request, context: Context) => {
  const actor = await requirePermission("customers:delete");
  const id = await validId(context);

  if (id === actor.id) throw forbidden("You cannot delete your own account.");

  await connectToDatabase();

  const target = await User.findById(id).lean();
  if (!target) throw notFound("No such user.");

  if (target.role === "super_admin") {
    throw forbidden("Demote this super admin before deleting the account.");
  }

  const orders = await Order.countDocuments({ userId: id });
  if (orders > 0) {
    throw forbidden(
      `That account has ${orders} order${orders === 1 ? "" : "s"}. Orders reference the customer, so the account cannot be removed.`,
    );
  }

  await User.deleteOne({ _id: id });

  return jsonOk({ deleted: true, id });
});
