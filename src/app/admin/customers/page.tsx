import type { Metadata } from "next";
import { connectToDatabase } from "@/lib/db";
import { Order, User } from "@/models";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Customers",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await connectToDatabase();

  const users = await User.find().sort({ createdAt: -1 }).limit(100).lean();
  const ids = users.map((u) => u._id);

  const spend = await Order.aggregate<{ _id: unknown; orders: number; spent: number }>([
    { $match: { userId: { $in: ids }, status: { $ne: "cancelled" } } },
    { $group: { _id: "$userId", orders: { $sum: 1 }, spent: { $sum: "$total" } } },
  ]);
  const byUser = new Map(spend.map((row) => [String(row._id), row]));

  return (
    <div className="px-6 py-10 lg:px-10 lg:py-12">
      <h1 className="text-title">Customers</h1>
      <p className="mt-3 text-sm text-muted">{users.length} accounts</p>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-y border-line">
              <th className="eyebrow py-4 text-left text-muted">Name</th>
              <th className="eyebrow py-4 text-left text-muted">Email</th>
              <th className="eyebrow py-4 text-left text-muted">Role</th>
              <th className="eyebrow py-4 text-right text-muted">Orders</th>
              <th className="eyebrow py-4 text-right text-muted">Spend</th>
              <th className="eyebrow py-4 text-right text-muted">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const stats = byUser.get(String(user._id));
              return (
                <tr key={String(user._id)} className="border-b border-line">
                  <td className="py-4 pr-4 font-medium">{user.name}</td>
                  <td className="py-4 pr-4 text-muted">{user.email}</td>
                  <td className="py-4 pr-4">
                    <span className="type-wide border border-line px-2.5 py-1 text-[0.625rem] tracking-wide-caps uppercase">
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-right tabular-nums">
                    {stats?.orders ?? 0}
                  </td>
                  <td className="py-4 pr-4 text-right tabular-nums">
                    {formatPrice(stats?.spent ?? 0)}
                  </td>
                  <td className="py-4 text-right tabular-nums text-muted">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString("en-GB")
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
