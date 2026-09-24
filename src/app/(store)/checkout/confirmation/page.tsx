import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order confirmed" };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const orderId = typeof params.order === "string" ? params.order : null;
  const paid = params.paid === "true";

  return (
    <Container className="flex min-h-[60vh] flex-col justify-center py-24">
      <p className="eyebrow text-muted">Order placed</p>
      <h1 className="mt-6 text-hero">Thank you.</h1>

      <p className="mt-6 max-w-measure text-muted">
        {paid
          ? "Your payment went through and the order is confirmed. A receipt is on its way to your email."
          : "Your order is recorded and waiting on payment. Card payment is not switched on in this environment yet, so nothing has been charged."}
      </p>

      {orderId && (
        <p className="mt-6 text-sm">
          <span className="text-muted">Order reference</span>{" "}
          <span className="tabular-nums">{orderId}</span>
        </p>
      )}

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/account/orders" className={buttonClasses("solid", "md")}>
          View your orders
        </Link>
        <Link href="/products" className={buttonClasses("outline", "md")}>
          Keep shopping
        </Link>
      </div>
    </Container>
  );
}
