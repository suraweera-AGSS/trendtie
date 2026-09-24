import type { Metadata } from "next";
import { OrderManager } from "@/components/admin/order-manager";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { serialiseOrder } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await connectToDatabase();

  const docs = await Order.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("userId", "name email")
    .lean();

  const orders = docs.map((doc) => {
    const customer = doc.userId as unknown as {
      name?: string;
      email?: string;
    } | null;
    return {
      ...serialiseOrder(doc),
      customer:
        customer && typeof customer === "object" && "email" in customer
          ? { name: customer.name, email: customer.email }
          : null,
    };
  });

  return (
    <div className="px-6 py-10 lg:px-10 lg:py-12">
      <OrderManager orders={orders} />
    </div>
  );
}
