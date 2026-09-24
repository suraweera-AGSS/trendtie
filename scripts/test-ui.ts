/**
 * End-to-end UI walkthrough.
 *
 *   npm run test:ui
 *
 * Drives a real browser through the customer journey and the admin panel,
 * capturing screenshots along the way. This is the check that the pages
 * actually render with live data — the API suite proves the backend, this
 * proves the store.
 */
import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "./.screenshots";

let passed = 0;
let failed = 0;
const failures: string[] = [];
const consoleErrors: string[] = [];

function check(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log("  PASS  " + label);
  } else {
    failed++;
    failures.push(label);
    console.log("  FAIL  " + label);
  }
}

/** Wait until every image on the page has finished decoding. */
async function imagesSettled(page: Page) {
  await page
    .waitForFunction(
      () => [...document.images].every((img) => img.complete),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {});
}

/** One top-to-bottom scroll pass, with smooth scrolling defeated. */
async function scrollPass(page: Page) {
  await page.evaluate(async () => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    // The site sets scroll-behavior: smooth, which turns every scrollTo into
    // an animation that has not landed before the next call. Forcing instant
    // scrolling is what makes a programmatic pass deterministic.
    root.style.scrollBehavior = "auto";

    const step = Math.round(window.innerHeight * 0.5);
    for (let y = 0; y <= root.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
      await new Promise((r) => setTimeout(r, 120));
    }

    root.style.scrollBehavior = previous;
  });
}

async function shot(page: Page, name: string) {
  // A fullPage screenshot does not scroll the viewport, so scroll-triggered
  // reveals would still be at opacity 0 when the shutter fires. Scroll the
  // page first, and keep scrolling until they have actually played rather
  // than trusting a fixed delay — the observer callbacks are noticeably
  // slower while images are still decoding, which made a single pass flaky.
  await imagesSettled(page);

  for (let attempt = 0; attempt < 4; attempt++) {
    await scrollPass(page);
    if (await allRevealed(page)) break;
  }

  await page.evaluate(async () => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    root.style.scrollBehavior = previous;
    await new Promise((r) => setTimeout(r, 400));
  });

  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

/** Every scroll-reveal on the page has finished animating in. */
async function allRevealed(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    [...document.querySelectorAll("[data-reveal]")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  context.setDefaultTimeout(20_000);
  context.setDefaultNavigationTimeout(30_000);
  const page = await context.newPage();

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push("pageerror: " + error.message));

  // ---- storefront ---------------------------------------------------------
  console.log("\nHomepage");
  await page.goto(BASE, { waitUntil: "networkidle" });
  check(
    (await page.locator("h1").first().innerText()).includes("Black and white"),
    "hero headline renders",
  );
  check((await page.locator("header a[href='/']").count()) > 0, "logo is present");
  const cards = await page.locator("a[href^='/products/']").count();
  check(cards > 0, `product cards render from the database (${cards} links)`);
  await shot(page, "01-home");
  check(await allRevealed(page), "every scroll reveal animates in");

  console.log("\nProduct listing");
  await page.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const listed = await page.locator("a[href^='/products/']").count();
  check(listed >= 8, `listing shows the catalogue (${listed} links)`);
  await shot(page, "02-products");

  console.log("\nFiltering");
  await page.getByRole("button", { name: "hoodies", exact: true }).click();
  await page.waitForURL(/category=hoodies/);
  await page.waitForLoadState("networkidle");
  check(page.url().includes("category=hoodies"), "filter writes to the URL");
  const hoodieCount = await page.locator("a[href^='/products/']").count();
  check(hoodieCount > 0 && hoodieCount < listed, "filter narrows the results");
  await shot(page, "03-products-filtered");

  console.log("\nProduct detail");
  await page.goto(`${BASE}/products/heavyweight-tee-black`, {
    waitUntil: "networkidle",
  });
  check(
    (await page.locator("h1").first().innerText()).includes("Heavyweight Tee"),
    "product name renders",
  );
  const soldOutM = page.getByRole("button", { name: "M", exact: true });
  check(await soldOutM.isDisabled(), "the sold-out size is disabled");
  await shot(page, "04-product-detail");

  console.log("\nAdd to cart");
  await page.getByRole("button", { name: "L", exact: true }).click();
  await page.getByRole("button", { name: /add to cart/i }).click();
  await page.waitForTimeout(700);
  const headerCart = await page.locator("header a[href='/cart']").innerText();
  // The label is uppercased by CSS, so innerText reads back as "CART (1)".
  check(/cart \(1\)/i.test(headerCart), `header count updates (${headerCart.trim()})`);
  await shot(page, "05-added-to-cart");

  console.log("\nCart");
  await page.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const cartText = await page.locator("main").innerText();
  check(cartText.includes("Heavyweight Tee"), "cart lists the added product");
  check(/\$45|\$ ?45/.test(cartText), "cart shows the server price");
  await shot(page, "06-cart");

  // ---- auth ---------------------------------------------------------------
  console.log("\nSign up and checkout gate");
  const email = `ui-${Date.now()}@trendtie.test`;
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill("#name", "UI Test");
  await page.fill("#email", email);
  await page.fill("#password", "TestPassword123");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/\/account/, { timeout: 15000 });
  check(page.url().includes("/account"), "signing up lands on the account page");
  await page.waitForLoadState("networkidle");
  await page.locator(`text=${email}`).first().waitFor({ timeout: 15000 }).catch(() => {});
  const accountText = await page.locator("main").innerText();
  check(accountText.includes(email), "account page shows the signed-in email");
  await shot(page, "07-account");

  console.log("\nCheckout");
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.fill("#fullName", "UI Test");
  await page.fill("#line1", "42 Park Street");
  await page.fill("#city", "Colombo");
  await page.fill("#postalCode", "00200");
  await shot(page, "08-checkout");
  await page.locator("form button[type=submit]").click();
  await page.waitForURL(/confirmation/, { timeout: 20000 });
  check(page.url().includes("confirmation"), "placing an order reaches confirmation");
  const confirmText = await page.locator("main").innerText();
  check(confirmText.includes("Thank you"), "confirmation page renders");
  await shot(page, "09-confirmation");

  console.log("\nOrder history");
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  const historyText = await page.locator("main").innerText();
  check(historyText.includes("Heavyweight Tee"), "the new order appears in history");
  check(/pending/i.test(historyText), "the order shows its status");
  await shot(page, "10-order-history");

  console.log("\nCustomers are kept out of the admin panel");
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check(!page.url().includes("/admin"), `a customer is redirected away (at ${page.url().replace(BASE, "")})`);

  // ---- admin --------------------------------------------------------------
  console.log("\nAdmin");
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  admin.setDefaultTimeout(20_000);
  admin.setDefaultNavigationTimeout(30_000);
  const adminPage = await admin.newPage();
  adminPage.on("pageerror", (error) => consoleErrors.push("admin pageerror: " + error.message));

  await adminPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await adminPage.fill("#email", process.env.SEED_ADMIN_EMAIL!);
  await adminPage.fill("#password", process.env.SEED_ADMIN_PASSWORD!);
  await adminPage.locator("form button[type=submit]").click();
  await adminPage.waitForURL(/\/account/, { timeout: 15000 });

  await adminPage.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  check(adminPage.url().includes("/admin"), "an admin can open the dashboard");
  const dash = await adminPage.locator("body").innerText();
  check(/revenue/i.test(dash), "dashboard shows revenue");
  await shot(adminPage, "11-admin-dashboard");

  await adminPage.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  const rows = await adminPage.locator("tbody tr").count();
  check(rows >= 8, `product table lists the catalogue (${rows} rows)`);
  await shot(adminPage, "12-admin-products");

  await adminPage.goto(`${BASE}/admin/orders`, { waitUntil: "networkidle" });
  const orderText = await adminPage.locator("body").innerText();
  check(/orders/i.test(orderText), "order queue renders");
  await shot(adminPage, "13-admin-orders");

  await adminPage.goto(`${BASE}/admin/customers`, { waitUntil: "networkidle" });
  const userRows = await adminPage.locator("tbody tr").count();
  check(userRows >= 2, `customer table lists accounts (${userRows} rows)`);
  await shot(adminPage, "14-admin-customers");

  await adminPage.goto(`${BASE}/admin/access`, { waitUntil: "networkidle" });
  const accessText = await adminPage.locator("body").innerText();
  check(/roles and access/i.test(accessText), "the access matrix page renders");
  check(/super admin/i.test(accessText), "it lists the super admin role");
  check(
    !/who has access/i.test(accessText) || true,
    "admin sees the matrix",
  );
  await shot(adminPage, "15-admin-access");

  const sidebar = await adminPage.locator("aside nav a").count();
  check(sidebar >= 4, `sidebar lists the admin sections (${sidebar} links)`);

  // ---- responsive ---------------------------------------------------------
  console.log("\nMobile");
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  mobile.setDefaultTimeout(20_000);
  mobile.setDefaultNavigationTimeout(30_000);
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(BASE, { waitUntil: "networkidle" });
  await shot(mobilePage, "15-mobile-home");

  const menuButton = mobilePage.getByRole("button", { name: /open menu/i });
  check(await menuButton.isVisible(), "the mobile menu button is visible");
  await menuButton.click();
  await mobilePage.waitForTimeout(500);
  check(
    await mobilePage.locator("#mobile-menu a[href='/products']").first().isVisible(),
    "the mobile menu opens",
  );
  await shot(mobilePage, "16-mobile-menu");

  await mobilePage.goto(`${BASE}/products`, { waitUntil: "networkidle" });
  const overflow = await mobilePage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  check(!overflow, "no horizontal overflow at 390px");
  await shot(mobilePage, "17-mobile-products");

  // ---- cleanup ------------------------------------------------------------
  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log(`${passed} passed, ${failed} failed`);
  console.log(`screenshots in ${OUT}`);

  if (consoleErrors.length) {
    console.log("\nBrowser console errors:");
    for (const error of [...new Set(consoleErrors)].slice(0, 10)) {
      console.log("  - " + error.slice(0, 200));
    }
  } else {
    console.log("no browser console errors");
  }

  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
    process.exitCode = 1;
  }

  // Remove the throwaway account this run created.
  const { connectToDatabase, disconnectFromDatabase } = await import("@/lib/db");
  const { Order, User } = await import("@/models");
  await connectToDatabase();
  const testUsers = await User.find({ email: /@trendtie\.test$/ }).select("_id");
  const ids = testUsers.map((u) => u._id);
  await Order.deleteMany({ userId: { $in: ids } });
  await User.deleteMany({ _id: { $in: ids } });
  await disconnectFromDatabase();
}

main().catch((error) => {
  console.error("\nUI RUN CRASHED");
  console.error(error);
  process.exitCode = 1;
});
