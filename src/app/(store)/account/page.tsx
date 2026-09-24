import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getSessionUser } from "@/lib/guards";
import { connectToDatabase } from "@/lib/db";
import { Order } from "@/models";
import { formatPrice } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/account");

  await connectToDatabase();

  const [orderCount, spendRows] = await Promise.all([
    Order.countDocuments({ userId: user.id }),
    Order.aggregate<{ _id: null; total: number }>([
      { $match: { userId: user.id, status: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]).catch(() => []),
  ]);

  return (
    <Container className="py-16 lg:py-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-muted">Account</p>
          <h1 className="mt-5 text-hero">{user.name ?? "Your account"}</h1>
          <p className="mt-4 text-muted">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <dl className="mt-14 grid gap-px border border-line bg-line sm:grid-cols-3">
        <Stat label="Orders" value={String(orderCount)} />
        <Stat label="Lifetime spend" value={formatPrice(spendRows[0]?.total ?? 0)} />
        <Stat label="Role" value={user.role} />
      </dl>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link href="/account/orders" className={buttonClasses("solid", "md")}>
          Order history
        </Link>
        {user.role === "admin" && (
          <Link href="/admin" className={buttonClasses("outline", "md")}>
            Admin panel
          </Link>
        )}
      </div>
    </Container>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-7">
      <dt className="eyebrow text-muted">{label}</dt>
      <dd className="mt-3 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
