/**
 * Connection smoke test. Run with `npm run db:check`.
 *
 * Confirms the Atlas connection string works, reports the server version and
 * the collections currently present, then exits. Useful on its own and as the
 * first thing to try when the app cannot reach the database.
 */
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db";
import { Order, Product, User } from "@/models";

async function main() {
  const started = Date.now();
  const mongoose = await connectToDatabase();
  const elapsed = Date.now() - started;

  const connection = mongoose.connection;
  const admin = connection.db?.admin();
  const info = await admin?.serverInfo();

  console.log("connected in " + elapsed + "ms");
  console.log("  host      " + connection.host);
  console.log("  database  " + connection.name);
  console.log("  server    MongoDB " + (info?.version ?? "unknown"));
  console.log("  mongoose  " + mongoose.version);

  const collections = await connection.db?.listCollections().toArray();
  const names = (collections ?? []).map((c) => c.name).sort();
  console.log(
    "  collections " + (names.length ? names.join(", ") : "(none yet)"),
  );

  const [products, orders, users] = await Promise.all([
    Product.countDocuments(),
    Order.countDocuments(),
    User.countDocuments(),
  ]);

  console.log("document counts");
  console.log("  products  " + products);
  console.log("  orders    " + orders);
  console.log("  users     " + users);

  await disconnectFromDatabase();
}

main().catch((error) => {
  console.error("DB CHECK FAILED");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
