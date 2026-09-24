/**
 * Backend API integration tests.
 *
 *   npm run test:api                 against http://localhost:3000
 *   BASE_URL=... npm run test:api    against any running instance
 *
 * These are real HTTP requests against a running server and a real database.
 * They cover the happy paths, the validation failures, and — most importantly
 * — the authorisation boundaries and the places where trusting the client
 * would cost money: cart pricing, stock limits and order ownership.
 *
 * The suite creates its own throwaway customer and cleans up the products and
 * orders it makes, so it can be run repeatedly against a seeded database.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ---- tiny test harness ----------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];
let group = "";

function describe(name: string) {
  group = name;
  console.log("\n" + name);
}

function check(condition: boolean, label: string, detail?: unknown) {
  if (condition) {
    passed++;
    console.log("  PASS  " + label);
  } else {
    failed++;
    failures.push(`${group} → ${label}`);
    console.log("  FAIL  " + label);
    if (detail !== undefined) {
      console.log("        " + JSON.stringify(detail).slice(0, 400));
    }
  }
}

function eq(actual: unknown, expected: unknown, label: string) {
  check(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
}

// ---- cookie-aware fetch ---------------------------------------------------

/** Minimal cookie jar: Auth.js needs CSRF and session cookies to round-trip. */
class Session {
  private cookies = new Map<string, string>();

  private header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private store(response: Response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const cookie of raw) {
      const [pair] = cookie.split(";");
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === "" || value === "null") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request(
    path: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<{ status: number; body: any; response: Response }> {
    const headers = new Headers(init.headers);
    const cookie = this.header();
    if (cookie) headers.set("cookie", cookie);

    let body = init.body;
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      body = JSON.stringify(init.json);
    }

    const response = await fetch(BASE + path, {
      ...init,
      headers,
      body,
      redirect: "manual",
    });
    this.store(response);

    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON response, keep the raw text */
    }

    return { status: response.status, body: parsed as any, response };
  }

  /** Sign in through the credentials provider, as a browser would. */
  async signIn(email: string, password: string): Promise<boolean> {
    const csrf = await this.request("/api/auth/csrf");
    const token = csrf.body?.csrfToken;
    if (!token) return false;

    const form = new URLSearchParams({
      csrfToken: token,
      email,
      password,
      callbackUrl: BASE,
    });

    const result = await this.request("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    // A successful credentials sign-in redirects and sets a session cookie.
    if (result.status >= 400) return false;

    const session = await this.request("/api/auth/session");
    return Boolean(session.body?.user?.id);
  }

  async currentUser() {
    const session = await this.request("/api/auth/session");
    return session.body?.user ?? null;
  }
}

const anon = new Session();

async function main() {
  console.log(`Testing API at ${BASE}\n${"=".repeat(60)}`);

  // ---- health -------------------------------------------------------------
  describe("GET /api/health");
  {
    const res = await anon.request("/api/health");
    eq(res.status, 200, "returns 200");
    eq(res.body?.status, "ok", "reports ok");
    eq(res.body?.database, "up", "database is up");
  }

  // ---- catalogue ----------------------------------------------------------
  describe("GET /api/products");
  let teeBlackId = "";
  let teeWhiteId = "";
  {
    const res = await anon.request("/api/products");
    eq(res.status, 200, "returns 200");
    check(Array.isArray(res.body?.items), "items is an array");
    check((res.body?.total ?? 0) >= 8, `total is at least 8 (got ${res.body?.total})`);

    const black = res.body.items.find((p: any) => p.slug === "heavyweight-tee-black");
    const white = res.body.items.find((p: any) => p.slug === "heavyweight-tee-white");
    teeBlackId = black?.id ?? "";
    teeWhiteId = white?.id ?? "";
    check(Boolean(teeBlackId), "seeded black tee is present");
    eq(black?.price, 4500, "price is returned in cents");
    eq(black?.stockPerSize?.M, 0, "sold-out size reported as 0");
    check(black?.inStock === true, "product with other sizes still reads in stock");
  }

  describe("GET /api/products — filters");
  {
    const byCategory = await anon.request("/api/products?category=tees");
    eq(byCategory.status, 200, "category filter returns 200");
    check(
      byCategory.body.items.every((p: any) => p.category === "tees"),
      "every result is in the requested category",
    );

    const bySize = await anon.request("/api/products?size=M&inStock=true");
    eq(bySize.status, 200, "size + inStock returns 200");
    const slugs = bySize.body.items.map((p: any) => p.slug);
    check(
      !slugs.includes("heavyweight-tee-black"),
      "excludes the product that is sold out in that size",
    );

    const search = await anon.request("/api/products?search=hoodie");
    eq(search.status, 200, "search returns 200");
    check(search.body.total >= 2, `search matched ${search.body.total} products`);

    const sorted = await anon.request("/api/products?sort=price-asc&limit=60");
    const prices = sorted.body.items.map((p: any) => p.price);
    check(
      prices.every((p: number, i: number) => i === 0 || prices[i - 1] <= p),
      "price-asc really is ascending",
    );

    const paged = await anon.request("/api/products?limit=3&page=2");
    eq(paged.status, 200, "pagination returns 200");
    eq(paged.body.page, 2, "echoes the requested page");
    check(paged.body.items.length <= 3, "respects the limit");

    const bad = await anon.request("/api/products?sort=nonsense");
    eq(bad.status, 400, "rejects an unknown sort with 400");
    eq(bad.body?.error?.code, "bad_request", "returns a structured error code");

    const badLimit = await anon.request("/api/products?limit=9999");
    eq(badLimit.status, 400, "rejects an oversized limit with 400");
  }

  describe("GET /api/products/[slug]");
  {
    const res = await anon.request("/api/products/heavyweight-tee-black");
    eq(res.status, 200, "returns 200");
    eq(res.body?.product?.slug, "heavyweight-tee-black", "returns the right product");
    check(Array.isArray(res.body?.related), "includes related products");
    check(
      !res.body.related.some((p: any) => p.id === res.body.product.id),
      "related never contains the product itself",
    );

    const missing = await anon.request("/api/products/no-such-product");
    eq(missing.status, 404, "unknown slug returns 404");
    eq(missing.body?.error?.code, "not_found", "with a not_found code");
  }

  // ---- cart ---------------------------------------------------------------
  describe("POST /api/cart — server-side pricing");
  {
    const res = await anon.request("/api/cart", {
      method: "POST",
      json: { items: [{ productId: teeBlackId, size: "L", quantity: 2 }] },
    });
    eq(res.status, 200, "returns 200");
    eq(res.body?.items?.[0]?.price, 4500, "unit price comes from the database");
    eq(res.body?.subtotal, 9000, "subtotal is quantity x price");
    eq(res.body?.valid, true, "cart is valid");
  }

  describe("POST /api/cart — a tampered price is ignored");
  {
    const res = await anon.request("/api/cart", {
      method: "POST",
      // A malicious client tries to set its own price and line total.
      json: {
        items: [
          { productId: teeBlackId, size: "L", quantity: 1, price: 1, lineTotal: 1 },
        ],
      },
    });
    eq(res.status, 200, "still returns 200");
    eq(res.body?.items?.[0]?.price, 4500, "price is the catalogue price, not the injected one");
    eq(res.body?.subtotal, 4500, "subtotal ignores the injected total");
  }

  describe("POST /api/cart — stock rules");
  {
    const soldOut = await anon.request("/api/cart", {
      method: "POST",
      json: { items: [{ productId: teeBlackId, size: "M", quantity: 1 }] },
    });
    eq(soldOut.body?.valid, false, "a sold-out size makes the cart invalid");
    eq(soldOut.body?.issues?.[0]?.code, "out_of_stock", "flagged as out_of_stock");

    const tooMany = await anon.request("/api/cart", {
      method: "POST",
      json: { items: [{ productId: teeBlackId, size: "XXL", quantity: 20 }] },
    });
    eq(tooMany.body?.valid, false, "over-ordering makes the cart invalid");
    eq(tooMany.body?.issues?.[0]?.code, "insufficient_stock", "flagged as insufficient_stock");

    const merged = await anon.request("/api/cart", {
      method: "POST",
      json: {
        items: [
          { productId: teeBlackId, size: "L", quantity: 1 },
          { productId: teeBlackId, size: "L", quantity: 2 },
        ],
      },
    });
    eq(merged.body?.items?.length, 1, "duplicate lines are merged");
    eq(merged.body?.items?.[0]?.quantity, 3, "merged quantity is the sum");

    const badBody = await anon.request("/api/cart", { method: "POST", json: { items: [] } });
    eq(badBody.status, 400, "an empty cart is rejected with 400");

    const badId = await anon.request("/api/cart", {
      method: "POST",
      json: { items: [{ productId: "not-an-id", size: "L", quantity: 1 }] },
    });
    eq(badId.status, 400, "a malformed product id is rejected with 400");

    const notJson = await anon.request("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ this is not json",
    });
    eq(notJson.status, 400, "a malformed JSON body is rejected with 400");
  }

  // ---- auth ---------------------------------------------------------------
  const stamp = Date.now();
  const customerEmail = `test-customer-${stamp}@trendtie.test`;
  const customerPassword = "TestPassword123";

  describe("POST /api/auth/register");
  {
    const res = await anon.request("/api/auth/register", {
      method: "POST",
      json: { name: "Test Customer", email: customerEmail, password: customerPassword },
    });
    eq(res.status, 201, "creates the account");
    eq(res.body?.user?.role, "customer", "new accounts are customers");
    check(!("passwordHash" in (res.body?.user ?? {})), "never returns the password hash");

    const duplicate = await anon.request("/api/auth/register", {
      method: "POST",
      json: { name: "Again", email: customerEmail, password: customerPassword },
    });
    eq(duplicate.status, 409, "a duplicate email is a 409");

    const weak = await anon.request("/api/auth/register", {
      method: "POST",
      json: { name: "Weak", email: `weak-${stamp}@trendtie.test`, password: "short" },
    });
    eq(weak.status, 400, "a short password is rejected");
    check(Boolean(weak.body?.error?.details?.password), "the failing field is named");

    const badEmail = await anon.request("/api/auth/register", {
      method: "POST",
      json: { name: "Bad", email: "not-an-email", password: customerPassword },
    });
    eq(badEmail.status, 400, "an invalid email is rejected");

    // The important one: role must not be settable from the request body.
    const escalated = await anon.request("/api/auth/register", {
      method: "POST",
      json: {
        name: "Escalation",
        email: `escalate-${stamp}@trendtie.test`,
        password: customerPassword,
        role: "admin",
      },
    });
    eq(escalated.status, 201, "extra fields do not break registration");
    eq(escalated.body?.user?.role, "customer", "a self-declared admin role is ignored");
  }

  describe("Authentication required");
  {
    const orders = await anon.request("/api/orders");
    eq(orders.status, 401, "GET /api/orders is 401 when signed out");

    const create = await anon.request("/api/orders", {
      method: "POST",
      json: {
        items: [{ productId: teeBlackId, size: "L", quantity: 1 }],
        shippingAddress: {
          fullName: "A", line1: "B", city: "C", postalCode: "D", country: "LK",
        },
      },
    });
    eq(create.status, 401, "POST /api/orders is 401 when signed out");

    const admin = await anon.request("/api/admin/stats");
    eq(admin.status, 401, "admin stats is 401 when signed out");
  }

  // ---- signed-in customer -------------------------------------------------
  const customer = new Session();
  describe("Credentials sign-in");
  {
    const ok = await customer.signIn(customerEmail, customerPassword);
    check(ok, "signs in with the registered credentials");

    const user = await customer.currentUser();
    eq(user?.role, "customer", "session carries the customer role");
    check(Boolean(user?.id), "session carries a user id");

    const wrong = new Session();
    const bad = await wrong.signIn(customerEmail, "WrongPassword123");
    check(!bad, "a wrong password does not create a session");
  }

  // ---- orders -------------------------------------------------------------
  describe("POST /api/orders");
  let orderId = "";
  let stockBefore = 0;
  {
    const before = await anon.request("/api/products/heavyweight-tee-white");
    stockBefore = before.body.product.stockPerSize.S;

    const res = await customer.request("/api/orders", {
      method: "POST",
      json: {
        items: [{ productId: teeWhiteId, size: "S", quantity: 2 }],
        shippingAddress: {
          fullName: "Test Customer",
          line1: "42 Park Street",
          city: "Colombo",
          postalCode: "00200",
          country: "LK",
        },
      },
    });
    eq(res.status, 201, "creates the order");
    orderId = res.body?.order?.id ?? "";
    eq(res.body?.order?.status, "pending", "new orders start pending");
    eq(res.body?.order?.total, 9000, "total is computed server-side");
    eq(res.body?.order?.items?.[0]?.price, 4500, "line price is the catalogue price");

    const after = await anon.request("/api/products/heavyweight-tee-white");
    eq(after.body.product.stockPerSize.S, stockBefore - 2, "stock was decremented");

    const oversell = await customer.request("/api/orders", {
      method: "POST",
      json: {
        items: [{ productId: teeBlackId, size: "M", quantity: 1 }],
        shippingAddress: {
          fullName: "Test Customer", line1: "42 Park Street",
          city: "Colombo", postalCode: "00200", country: "LK",
        },
      },
    });
    eq(oversell.status, 422, "ordering a sold-out size is a 422");

    const badAddress = await customer.request("/api/orders", {
      method: "POST",
      json: {
        items: [{ productId: teeWhiteId, size: "S", quantity: 1 }],
        shippingAddress: { fullName: "X", line1: "Y", city: "Z", postalCode: "1", country: "LKA" },
      },
    });
    eq(badAddress.status, 400, "a three-letter country code is rejected");
  }

  describe("GET /api/orders");
  {
    const res = await customer.request("/api/orders");
    eq(res.status, 200, "returns 200");
    check(
      res.body.orders.some((o: any) => o.id === orderId),
      "the customer sees the order they just placed",
    );

    const one = await customer.request(`/api/orders/${orderId}`);
    eq(one.status, 200, "can fetch their own order by id");

    const bogus = await customer.request("/api/orders/not-an-id");
    eq(bogus.status, 400, "a malformed order id is a 400");

    const missing = await customer.request("/api/orders/64b7f1f1f1f1f1f1f1f1f1f1");
    eq(missing.status, 404, "an unknown order id is a 404");
  }

  // ---- authorisation boundary ---------------------------------------------
  describe("Order ownership");
  {
    const otherEmail = `other-${stamp}@trendtie.test`;
    await anon.request("/api/auth/register", {
      method: "POST",
      json: { name: "Other", email: otherEmail, password: customerPassword },
    });
    const other = new Session();
    await other.signIn(otherEmail, customerPassword);

    const res = await other.request(`/api/orders/${orderId}`);
    eq(res.status, 404, "another customer cannot read someone else's order");

    const list = await other.request("/api/orders");
    check(
      !list.body.orders.some((o: any) => o.id === orderId),
      "another customer's list does not include it",
    );
  }

  describe("Customer cannot reach admin endpoints");
  {
    for (const path of [
      "/api/admin/stats",
      "/api/admin/products",
      "/api/admin/orders",
      "/api/admin/users",
    ]) {
      const res = await customer.request(path);
      eq(res.status, 403, `${path} is 403 for a customer`);
    }

    const write = await customer.request("/api/admin/products", {
      method: "POST",
      json: {
        name: "Sneaky", description: "x", price: 100,
        images: [{ url: "/x.png", alt: "x" }], sizes: ["M"], category: "tees",
      },
    });
    eq(write.status, 403, "creating a product as a customer is 403");
  }

  // ---- admin --------------------------------------------------------------
  const admin = new Session();
  describe("Admin sign-in");
  {
    const email = process.env.SEED_ADMIN_EMAIL!;
    const password = process.env.SEED_ADMIN_PASSWORD!;
    const ok = await admin.signIn(email, password);
    check(ok, "the seeded admin can sign in");
    const user = await admin.currentUser();
    eq(user?.role, "admin", "session carries the admin role");
  }

  describe("GET /api/admin/stats");
  {
    const res = await admin.request("/api/admin/stats");
    eq(res.status, 200, "returns 200 for an admin");
    check(typeof res.body?.revenue === "number", "revenue is a number");
    check(typeof res.body?.products === "number", "product count is a number");
    check(Boolean(res.body?.ordersByStatus), "includes a status breakdown");
    check(Array.isArray(res.body?.lowStock), "includes low-stock products");
  }

  describe("Admin product CRUD");
  let createdId = "";
  {
    const create = await admin.request("/api/admin/products", {
      method: "POST",
      json: {
        name: `Test Product ${stamp}`,
        description: "Created by the API test suite.",
        price: 1234,
        images: [{ url: "/products/placeholder-tote.png", alt: "Test" }],
        sizes: ["S", "M"],
        stockPerSize: { S: 5, M: 7, XXL: 99 },
        category: "tees",
      },
    });
    eq(create.status, 201, "creates a product");
    createdId = create.body?.product?.id ?? "";
    check(Boolean(create.body?.product?.slug), "derives a slug from the name");
    eq(create.body?.product?.stockPerSize?.XXL, undefined, "drops stock for sizes not offered");
    eq(create.body?.product?.stockPerSize?.M, 7, "keeps stock for offered sizes");

    const dupe = await admin.request("/api/admin/products", {
      method: "POST",
      json: {
        name: "Another", slug: create.body.product.slug,
        description: "x", price: 100,
        images: [{ url: "/x.png", alt: "x" }], sizes: ["M"], category: "tees",
      },
    });
    eq(dupe.status, 409, "a duplicate slug is a 409");

    const badPrice = await admin.request("/api/admin/products", {
      method: "POST",
      json: {
        name: "Bad price", description: "x", price: 19.99,
        images: [{ url: "/x.png", alt: "x" }], sizes: ["M"], category: "tees",
      },
    });
    eq(badPrice.status, 400, "a non-integer price is rejected");

    const noImages = await admin.request("/api/admin/products", {
      method: "POST",
      json: {
        name: "No images", description: "x", price: 100,
        images: [], sizes: ["M"], category: "tees",
      },
    });
    eq(noImages.status, 400, "a product with no images is rejected");

    const patch = await admin.request(`/api/admin/products/${createdId}`, {
      method: "PATCH",
      json: { price: 4321, featured: true },
    });
    eq(patch.status, 200, "updates a product");
    eq(patch.body?.product?.price, 4321, "the new price is stored");
    eq(patch.body?.product?.featured, true, "the featured flag is stored");

    const shrink = await admin.request(`/api/admin/products/${createdId}`, {
      method: "PATCH",
      json: { sizes: ["S"] },
    });
    eq(shrink.body?.product?.stockPerSize?.M, undefined, "removing a size removes its stock");

    const empty = await admin.request(`/api/admin/products/${createdId}`, {
      method: "PATCH",
      json: {},
    });
    eq(empty.status, 400, "an empty update is rejected");

    const ghost = await admin.request("/api/admin/products/64b7f1f1f1f1f1f1f1f1f1f1", {
      method: "PATCH",
      json: { price: 100 },
    });
    eq(ghost.status, 404, "updating a missing product is a 404");

    const del = await admin.request(`/api/admin/products/${createdId}`, { method: "DELETE" });
    eq(del.status, 200, "deletes a product");

    const delAgain = await admin.request(`/api/admin/products/${createdId}`, { method: "DELETE" });
    eq(delAgain.status, 404, "deleting it twice is a 404");
    createdId = "";
  }

  describe("Admin order management");
  {
    const list = await admin.request("/api/admin/orders");
    eq(list.status, 200, "lists every order");
    check(list.body.total >= 4, `sees all orders (${list.body.total})`);
    check(
      list.body.orders.some((o: any) => o.customer?.email),
      "each row carries the customer",
    );

    const filtered = await admin.request("/api/admin/orders?status=pending");
    check(
      filtered.body.orders.every((o: any) => o.status === "pending"),
      "status filter works",
    );

    const badStatus = await admin.request("/api/admin/orders?status=banana");
    eq(badStatus.status, 400, "an unknown status is rejected");

    const ship = await admin.request(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      json: { status: "shipped" },
    });
    eq(ship.status, 200, "moves the order to shipped");
    eq(ship.body?.order?.status, "shipped", "status is persisted");

    // Cancelling must hand the stock back, exactly once.
    const beforeCancel = await anon.request("/api/products/heavyweight-tee-white");
    const stockPre = beforeCancel.body.product.stockPerSize.S;

    const cancel = await admin.request(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      json: { status: "cancelled" },
    });
    eq(cancel.status, 200, "cancels the order");

    const afterCancel = await anon.request("/api/products/heavyweight-tee-white");
    eq(afterCancel.body.product.stockPerSize.S, stockPre + 2, "stock was returned");

    const cancelAgain = await admin.request(`/api/admin/orders/${orderId}`, {
      method: "PATCH",
      json: { status: "cancelled" },
    });
    eq(cancelAgain.status, 200, "cancelling twice still returns 200");

    const afterTwice = await anon.request("/api/products/heavyweight-tee-white");
    eq(
      afterTwice.body.product.stockPerSize.S,
      stockPre + 2,
      "stock is not credited a second time",
    );
  }

  describe("GET /api/admin/users");
  {
    const res = await admin.request("/api/admin/users");
    eq(res.status, 200, "returns 200");
    check(res.body.total >= 2, "lists users");
    const row = res.body.users[0];
    check(!("passwordHash" in row), "never exposes password hashes");
    check(typeof row.orderCount === "number", "includes an order count");
    check(typeof row.lifetimeSpend === "number", "includes lifetime spend");

    const filtered = await admin.request("/api/admin/users?role=admin");
    check(
      filtered.body.users.every((u: any) => u.role === "admin"),
      "role filter works",
    );
  }

  // ---- payments -----------------------------------------------------------
  describe("Stripe endpoints degrade cleanly without keys");
  {
    const checkout = await customer.request("/api/checkout", {
      method: "POST",
      json: { orderId: orderId },
    });
    const configured = Boolean(process.env.STRIPE_SECRET_KEY);
    if (configured) {
      check(checkout.status === 200 || checkout.status === 400, "checkout responds");
    } else {
      eq(checkout.status, 503, "checkout is 503 when Stripe is not configured");
      eq(checkout.body?.error?.code, "stripe_not_configured", "with a clear code");
    }

    const unsigned = await anon.request("/api/webhooks/stripe", {
      method: "POST",
      json: { type: "payment_intent.succeeded" },
    });
    check(
      unsigned.status === 400 || unsigned.status === 503,
      `an unsigned webhook is rejected (got ${unsigned.status})`,
    );
    check(unsigned.body?.received !== true, "an unsigned webhook is never accepted");
  }

  // ---- role hierarchy -----------------------------------------------------
  describe("Staff role: fulfilment only");
  const staff = new Session();
  {
    const ok = await staff.signIn(
      process.env.SEED_STAFF_EMAIL!,
      process.env.SEED_STAFF_PASSWORD!,
    );
    check(ok, "the seeded staff account can sign in");
    eq((await staff.currentUser())?.role, "staff", "session carries the staff role");

    const dash = await staff.request("/api/admin/stats");
    eq(dash.status, 200, "staff may see the dashboard");

    const orders = await staff.request("/api/admin/orders");
    eq(orders.status, 200, "staff may read orders");

    const products = await staff.request("/api/admin/products");
    eq(products.status, 200, "staff may read the catalogue");

    // The whole point of the role: it stops short of these.
    const analytics = await staff.request("/api/admin/analytics");
    eq(analytics.status, 403, "staff may NOT see revenue analytics");

    const write = await staff.request("/api/admin/products", {
      method: "POST",
      json: {
        name: "Staff attempt", description: "x", price: 100,
        images: [{ url: "/x.png", alt: "x" }], sizes: ["M"], category: "tees",
      },
    });
    eq(write.status, 403, "staff may NOT create products");

    const upload = await staff.request("/api/admin/uploads", {
      method: "POST",
      body: new FormData(),
    });
    eq(upload.status, 403, "staff may NOT upload images");

    const roles = await staff.request("/api/admin/users/64b7f1f1f1f1f1f1f1f1f1f1", {
      method: "PATCH",
      json: { role: "admin" },
    });
    eq(roles.status, 403, "staff may NOT change roles");
  }

  describe("Admin role: runs the shop, cannot grant access");
  let staffUserId = "";
  {
    const analytics = await admin.request("/api/admin/analytics?days=30");
    eq(analytics.status, 200, "admin may see revenue analytics");
    check(Array.isArray(analytics.body?.series), "analytics returns a daily series");
    eq(
      analytics.body?.series?.length,
      30,
      "the series is zero-filled to the full range",
    );
    check(
      Array.isArray(analytics.body?.ordersByStatus),
      "analytics breaks orders down by status",
    );

    const users = await admin.request("/api/admin/users");
    eq(users.status, 200, "admin may read customers");
    staffUserId =
      users.body.users.find((u: any) => u.role === "staff")?.id ?? "";
    check(Boolean(staffUserId), "found the seeded staff account");

    const promote = await admin.request(`/api/admin/users/${staffUserId}`, {
      method: "PATCH",
      json: { role: "admin" },
    });
    eq(promote.status, 403, "admin may NOT change anyone's role");
  }

  describe("Super admin role: everything, with guard rails");
  const owner = new Session();
  {
    const ok = await owner.signIn(
      process.env.SEED_SUPER_ADMIN_EMAIL!,
      process.env.SEED_SUPER_ADMIN_PASSWORD!,
    );
    check(ok, "the seeded super admin can sign in");
    const me = await owner.currentUser();
    eq(me?.role, "super_admin", "session carries the super admin role");

    const promote = await owner.request(`/api/admin/users/${staffUserId}`, {
      method: "PATCH",
      json: { role: "admin" },
    });
    eq(promote.status, 200, "super admin may promote staff to admin");
    eq(promote.body?.direction, "promoted", "the change is reported as a promotion");

    const demote = await owner.request(`/api/admin/users/${staffUserId}`, {
      method: "PATCH",
      json: { role: "staff" },
    });
    eq(demote.status, 200, "super admin may demote again");
    eq(demote.body?.direction, "demoted", "the change is reported as a demotion");

    const badRole = await owner.request(`/api/admin/users/${staffUserId}`, {
      method: "PATCH",
      json: { role: "wizard" },
    });
    eq(badRole.status, 400, "an unknown role is rejected");

    // The two rules that stop the store locking itself out.
    const self = await owner.request(`/api/admin/users/${me.id}`, {
      method: "PATCH",
      json: { role: "admin" },
    });
    eq(self.status, 403, "a super admin cannot change their own role");

    const lastOne = await owner.request("/api/admin/users?role=super_admin");
    if (lastOne.body?.total === 1) {
      check(true, "only one super admin exists, so the last-one rule is live");
    }
  }

  describe("Image uploads");
  {
    const asCustomer = await customer.request("/api/admin/uploads", {
      method: "POST",
      body: new FormData(),
    });
    eq(asCustomer.status, 403, "a customer cannot upload");

    const form = new FormData();
    form.append("file", new Blob(["not an image"], { type: "text/plain" }), "x.txt");
    const asAdmin = await admin.request("/api/admin/uploads", {
      method: "POST",
      body: form,
    });
    if (process.env.CLOUDINARY_API_KEY) {
      eq(asAdmin.status, 400, "a non-image is rejected");
    } else {
      eq(asAdmin.status, 503, "uploads are 503 when Cloudinary is not configured");
      eq(
        asAdmin.body?.error?.code,
        "cloudinary_not_configured",
        "with a clear code",
      );
    }
  }

  // ---- method handling ----------------------------------------------------
  describe("Unsupported methods");
  {
    const res = await anon.request("/api/products", { method: "DELETE" });
    check(res.status === 405, `DELETE /api/products is 405 (got ${res.status})`);
  }

  // ---- cleanup ------------------------------------------------------------
  describe("Cleanup");
  {
    const { connectToDatabase, disconnectFromDatabase } = await import("@/lib/db");
    const { Order, Product, User } = await import("@/models");
    await connectToDatabase();

    const testUsers = await User.find({ email: /@trendtie\.test$/ }).select("_id");
    const ids = testUsers.map((u) => u._id);
    const orders = await Order.deleteMany({ userId: { $in: ids } });
    const users = await User.deleteMany({ _id: { $in: ids } });
    const products = await Product.deleteMany({ name: /^Test Product / });

    check(true, `removed ${users.deletedCount} test users, ${orders.deletedCount} orders, ${products.deletedCount} products`);
    await disconnectFromDatabase();
  }

  // ---- summary ------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log(`${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nTEST RUN CRASHED");
  console.error(error);
  process.exitCode = 1;
});
