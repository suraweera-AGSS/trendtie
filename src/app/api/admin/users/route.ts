import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Order, User } from "@/models";
import { jsonOk, parseQuery, route } from "@/lib/api";
import { adminUserQuerySchema } from "@/lib/validation";
import { requirePermission } from "@/lib/guards";

/**
 * GET /api/admin/users — the customer list.
 *
 * Each row carries the customer's order count and lifetime spend, gathered in
 * one aggregation rather than one query per user. Password hashes are
 * excluded by the schema and never selected here.
 */
export const GET = route(async (request: NextRequest) => {
  await requirePermission("customers:read");
  const query = parseQuery(new URL(request.url), adminUserQuerySchema);

  await connectToDatabase();

  const filter = query.role ? { role: query.role } : {};
  const skip = (query.page - 1) * query.limit;

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    User.countDocuments(filter),
  ]);

  const ids = users.map((u) => u._id);

  const spend = await Order.aggregate<{
    _id: unknown;
    orders: number;
    spent: number;
  }>([
    { $match: { userId: { $in: ids }, status: { $ne: "cancelled" } } },
    { $group: { _id: "$userId", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
  ]);

  const byUser = new Map(spend.map((row) => [String(row._id), row]));

  return jsonOk({
    users: users.map((user) => {
      const stats = byUser.get(String(user._id));
      return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: (user.createdAt ?? new Date()).toISOString(),
        orderCount: stats?.orders ?? 0,
        lifetimeSpend: stats?.spent ?? 0,
      };
    }),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    limit: query.limit,
  });
});
