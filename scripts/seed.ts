/**
 * Seed the database with sample catalogue, users and orders.
 *
 *   npm run seed            upsert sample data, leave anything else alone
 *   npm run seed -- --fresh delete products, orders and seeded users first
 *
 * The script is idempotent: products are keyed on slug and users on email, so
 * running it twice does not duplicate anything. Prices are in minor units
 * (cents) to match the Product schema.
 */
import { hash } from "bcryptjs";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db";
import { Order, Product, User } from "@/models";
import type { Category, Size } from "@/lib/site-config";

const FRESH = process.argv.includes("--fresh");
const BCRYPT_ROUNDS = 12;

/** Apparel runs the full size ladder; caps and totes are one size. */
const APPAREL_SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];
const ONE_SIZE: Size[] = ["ONE_SIZE"];

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  price: number;
  category: Category;
  sizes: Size[];
  stockPerSize: Partial<Record<Size, number>>;
  featured: boolean;
  image: { url: string; alt: string };
};

const PRODUCTS: SeedProduct[] = [
  {
    name: "Heavyweight Tee — Black",
    slug: "heavyweight-tee-black",
    description:
      "A 240gsm combed cotton tee with a boxy, slightly cropped cut and a ribbed collar that holds its shape through the wash. The mark is printed small on the chest in white. Pre-shrunk, so the size you buy is the size it stays.",
    price: 4500,
    category: "tees",
    sizes: APPAREL_SIZES,
    // M is deliberately sold out so the out-of-stock state has something to show.
    stockPerSize: { XS: 8, S: 14, M: 0, L: 22, XL: 11, XXL: 5 },
    featured: true,
    image: {
      url: "/products/tee-black.png",
      alt: "Black heavyweight cotton tee with a small white logo mark on the chest",
    },
  },
  {
    name: "Heavyweight Tee — White",
    slug: "heavyweight-tee-white",
    description:
      "The same 240gsm combed cotton body as the black tee, with the mark printed in black. Opaque enough that nothing shows through, and cut boxy through the shoulder so it hangs rather than clings.",
    price: 4500,
    category: "tees",
    sizes: APPAREL_SIZES,
    stockPerSize: { XS: 6, S: 18, M: 24, L: 19, XL: 9, XXL: 4 },
    featured: true,
    image: {
      url: "/products/tee-white.png",
      alt: "White heavyweight cotton tee with a small black logo mark on the chest",
    },
  },
  {
    name: "Oversized Hoodie — Black",
    slug: "oversized-hoodie-black",
    description:
      "400gsm brushed-back fleece with a double-layer hood, no drawcord, and a dropped shoulder. Heavy enough to stand up on its own and cut long in the body so it layers over a tee without riding up.",
    price: 9500,
    category: "hoodies",
    sizes: APPAREL_SIZES,
    stockPerSize: { XS: 3, S: 9, M: 12, L: 14, XL: 7, XXL: 2 },
    featured: true,
    image: {
      url: "/products/placeholder-hoodie.png",
      alt: "Placeholder image for the black oversized hoodie, photography pending",
    },
  },
  {
    name: "Oversized Hoodie — White",
    slug: "oversized-hoodie-white",
    description:
      "The black hoodie in reverse: 400gsm brushed-back fleece, double-layer hood, dropped shoulder, mark printed in black at the chest. Garment-dyed so the white stays flat rather than turning blue under camera flash.",
    price: 9500,
    category: "hoodies",
    sizes: APPAREL_SIZES,
    stockPerSize: { XS: 2, S: 7, M: 10, L: 8, XL: 5, XXL: 0 },
    featured: false,
    image: {
      url: "/products/placeholder-hoodie.png",
      alt: "Placeholder image for the white oversized hoodie, photography pending",
    },
  },
  {
    name: "Logo Cap — Black",
    slug: "logo-cap-black",
    description:
      "Unstructured six-panel cap in washed cotton twill with an embroidered mark at the front and a brass buckle strap. Soft crown, so it packs flat and creases the way a cap should.",
    price: 3500,
    category: "caps",
    sizes: ONE_SIZE,
    stockPerSize: { ONE_SIZE: 40 },
    featured: false,
    image: {
      url: "/products/placeholder-cap.png",
      alt: "Placeholder image for the black logo cap, photography pending",
    },
  },
  {
    name: "Logo Cap — White",
    slug: "logo-cap-white",
    description:
      "The six-panel cap in off-the-loom white twill with the mark embroidered in black. Same unstructured crown and brass buckle strap as the black colourway.",
    price: 3500,
    category: "caps",
    sizes: ONE_SIZE,
    stockPerSize: { ONE_SIZE: 26 },
    featured: false,
    image: {
      url: "/products/placeholder-cap.png",
      alt: "Placeholder image for the white logo cap, photography pending",
    },
  },
  {
    name: "Canvas Tote — Black",
    slug: "canvas-tote-black",
    description:
      "16oz cotton canvas tote with reinforced handles, a flat base and one interior pocket. Screen-printed mark on one face, nothing on the other. Holds a laptop and a week of groceries without complaint.",
    price: 2800,
    category: "accessories",
    sizes: ONE_SIZE,
    stockPerSize: { ONE_SIZE: 55 },
    featured: false,
    image: {
      url: "/products/placeholder-tote.png",
      alt: "Placeholder image for the black canvas tote, photography pending",
    },
  },
  {
    name: "Canvas Tote — Natural",
    slug: "canvas-tote-natural",
    description:
      "The same 16oz canvas tote left undyed, with the mark screen-printed in black. Reinforced handles, flat base, one interior pocket.",
    price: 2800,
    category: "accessories",
    sizes: ONE_SIZE,
    stockPerSize: { ONE_SIZE: 0 },
    featured: false,
    image: {
      url: "/products/placeholder-tote.png",
      alt: "Placeholder image for the natural canvas tote, photography pending",
    },
  },
];

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local before running the seed.`,
    );
  }
  return value;
}

async function seedProducts() {
  const ids = new Map<string, string>();

  for (const product of PRODUCTS) {
    const { image, ...rest } = product;
    const doc = await Product.findOneAndUpdate(
      { slug: product.slug },
      {
        $set: {
          ...rest,
          images: [
            {
              ...image,
              width: 1200,
              height: 1200,
            },
          ],
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    ids.set(product.slug, String(doc._id));
  }

  return ids;
}

async function seedUsers() {
  const accounts = [
    {
      name: "Store Owner",
      email: requiredEnv("SEED_SUPER_ADMIN_EMAIL", "owner@trendtie.local").toLowerCase(),
      password: requiredEnv("SEED_SUPER_ADMIN_PASSWORD", requiredEnv("SEED_ADMIN_PASSWORD")),
      role: "super_admin" as const,
    },
    {
      name: "Store Admin",
      email: requiredEnv("SEED_ADMIN_EMAIL").toLowerCase(),
      password: requiredEnv("SEED_ADMIN_PASSWORD"),
      role: "admin" as const,
    },
    {
      name: "Fulfilment Staff",
      email: requiredEnv("SEED_STAFF_EMAIL", "staff@trendtie.local").toLowerCase(),
      password: requiredEnv("SEED_STAFF_PASSWORD", requiredEnv("SEED_ADMIN_PASSWORD")),
      role: "staff" as const,
    },
    {
      name: "Sample Customer",
      email: requiredEnv("SEED_CUSTOMER_EMAIL").toLowerCase(),
      password: requiredEnv("SEED_CUSTOMER_PASSWORD"),
      role: "customer" as const,
    },
  ];

  const ids = new Map<string, string>();

  for (const account of accounts) {
    const passwordHash = await hash(account.password, BCRYPT_ROUNDS);
    const doc = await User.findOneAndUpdate(
      { email: account.email },
      {
        $set: {
          name: account.name,
          role: account.role,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    ids.set(account.role, String(doc._id));
  }

  return ids;
}

async function seedOrders(
  productIds: Map<string, string>,
  userIds: Map<string, string>,
) {
  const customerId = userIds.get("customer");
  if (!customerId) throw new Error("Customer user was not created");

  const address = {
    fullName: "Sample Customer",
    line1: "42 Park Street",
    city: "Colombo",
    postalCode: "00200",
    country: "LK",
  };

  const drafts = [
    {
      key: "seed-order-delivered",
      status: "delivered" as const,
      items: [
        { slug: "heavyweight-tee-black", size: "L" as Size, quantity: 2, price: 4500 },
        { slug: "logo-cap-black", size: "ONE_SIZE" as Size, quantity: 1, price: 3500 },
      ],
    },
    {
      key: "seed-order-shipped",
      status: "shipped" as const,
      items: [
        { slug: "oversized-hoodie-black", size: "M" as Size, quantity: 1, price: 9500 },
      ],
    },
    {
      key: "seed-order-pending",
      status: "pending" as const,
      items: [
        { slug: "heavyweight-tee-white", size: "S" as Size, quantity: 1, price: 4500 },
        { slug: "canvas-tote-black", size: "ONE_SIZE" as Size, quantity: 2, price: 2800 },
      ],
    },
  ];

  let created = 0;

  for (const draft of drafts) {
    const items = draft.items.map((item) => {
      const productId = productIds.get(item.slug);
      if (!productId) throw new Error(`Unknown product slug ${item.slug}`);
      const product = PRODUCTS.find((p) => p.slug === item.slug);
      return {
        productId,
        name: product?.name ?? item.slug,
        size: item.size,
        quantity: item.quantity,
        price: item.price,
      };
    });

    const total = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // The synthetic intent id doubles as the idempotency key, since it is the
    // one unique field an order carries before Stripe is wired up in step 5.
    await Order.findOneAndUpdate(
      { stripePaymentIntentId: draft.key },
      {
        $set: {
          userId: customerId,
          items,
          status: draft.status,
          shippingAddress: address,
          total,
          currency: "USD",
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    created++;
  }

  return created;
}

async function main() {
  await connectToDatabase();

  if (FRESH) {
    const emails = [
      requiredEnv("SEED_SUPER_ADMIN_EMAIL", "owner@trendtie.local").toLowerCase(),
      requiredEnv("SEED_ADMIN_EMAIL").toLowerCase(),
      requiredEnv("SEED_STAFF_EMAIL", "staff@trendtie.local").toLowerCase(),
      requiredEnv("SEED_CUSTOMER_EMAIL").toLowerCase(),
    ];
    const [products, orders, users] = await Promise.all([
      Product.deleteMany({}),
      Order.deleteMany({}),
      User.deleteMany({ email: { $in: emails } }),
    ]);
    console.log(
      `--fresh: removed ${products.deletedCount} products, ${orders.deletedCount} orders, ${users.deletedCount} seeded users`,
    );
  }

  const productIds = await seedProducts();
  const userIds = await seedUsers();
  const orderCount = await seedOrders(productIds, userIds);

  // Build the indexes the schemas declare, so the first real query does not
  // pay for them and unique constraints are actually enforced.
  await Promise.all([
    Product.syncIndexes(),
    Order.syncIndexes(),
    User.syncIndexes(),
  ]);

  const [products, orders, users, featured] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments(),
    User.countDocuments(),
    Product.countDocuments({ featured: true }),
  ]);

  console.log("seed complete");
  console.log(`  products   ${products} (${featured} featured)`);
  console.log(`  orders     ${orders}`);
  console.log(`  users      ${users}`);
  console.log(
    `  owner      ${requiredEnv("SEED_SUPER_ADMIN_EMAIL", "owner@trendtie.local")} (super admin)`,
  );
  console.log(`  admin      ${requiredEnv("SEED_ADMIN_EMAIL")}`);
  console.log(
    `  staff      ${requiredEnv("SEED_STAFF_EMAIL", "staff@trendtie.local")}`,
  );
  console.log(`  customer   ${requiredEnv("SEED_CUSTOMER_EMAIL")}`);
  console.log(`  seeded ${orderCount} sample orders across pending/shipped/delivered`);

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error("SEED FAILED");
  console.error(error instanceof Error ? error.message : error);
  await disconnectFromDatabase().catch(() => {});
  process.exitCode = 1;
});
