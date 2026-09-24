import type { NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { jsonOk, parseQuery, route } from "@/lib/api";
import { adminOrderQuerySchema } from "@/lib/validation";
import { requirePermission } from "@/lib/guards";
import { serialiseOrder } from "@/lib/orders";

/** GET /api/admin/orders — every order, newest first, filterable by status. */
export const GET = route(async (request: NextRequest) => {
  await requirePermission("orders:read");
  const query = parseQuery(new URL(request.url), adminOrderQuerySchema);

  await connectToDatabase();

  const filter = query.status ? { status: query.status } : {};
  const skip = (query.page - 1) * query.limit;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate("userId", "name email")
      .lean(),
    Order.countDocuments(filter),
  ]);

  return jsonOk({
    orders: orders.map((order) => {
      const dto = serialiseOrder(order);
      const customer = order.userId as unknown as {
        name?: string;
        email?: string;
      } | null;
      return {
        ...dto,
        customer:
          customer && typeof customer === "object" && "email" in customer
            ? { name: customer.name, email: customer.email }
            : null,
      };
    }),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / query.limit)),
    limit: query.limit,
  });
});
