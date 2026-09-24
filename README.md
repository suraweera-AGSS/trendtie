# TRENDTIE

Monochrome merchandise store. Strict two-colour brand system: pure black
(`#000000`) and pure white (`#FFFFFF`), with greys expressed only as alpha
derivatives of those two.

## Stack

| Concern    | Choice                                      |
| ---------- | ------------------------------------------- |
| Framework  | Next.js 16 (App Router) + TypeScript        |
| Styling    | Tailwind CSS v4 (CSS-first theme tokens)    |
| Animation  | Framer Motion                               |
| Database   | MongoDB Atlas via Mongoose                  |
| Auth       | NextAuth / Auth.js (credentials, OAuth-ready) |
| Payments   | Stripe (test mode)                          |
| Images     | Cloudinary                                  |
| Deployment | Vercel                                      |

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in as each stage is wired up
npm run dev
```

The app runs at http://localhost:3000. Only `MONGODB_URI` and `AUTH_SECRET`
are required; Stripe and Cloudinary are optional and their endpoints return a
clear 503 until you add keys.

Then seed the catalogue:

```bash
npm run seed
```

## Scripts

```bash
npm run dev        # Turbopack dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ESLint (flat config)
npm run typecheck  # next typegen + tsc --noEmit
npm run db:check   # connect to Atlas and report collections and counts
npm run seed       # upsert sample catalogue, users and orders
npm run seed -- --fresh   # wipe products/orders/seeded users, then seed
npm run test:api   # backend integration tests
npm run test:ui    # browser walkthrough, writes .screenshots/
```

## Project structure

```
src/
  app/                  App Router routes, layouts and route handlers
    layout.tsx          Root shell: fonts, metadata, header, footer
    globals.css         Design tokens (@theme) + base layer + utilities
  components/
    layout/             Site header, site footer
    ui/                 Primitives: Container, Button, Logo, LogoMark
    product/            Product cards, galleries, size pickers  (step 3)
    cart/               Cart drawer and line items              (step 5)
    motion/             Reusable Framer Motion wrappers         (step 3)
  lib/
    site-config.ts      Brand copy, navigation, sizes, categories
    motion.ts           Shared easings, durations, variants
    utils.ts            cn(), formatPrice(), slugify()
    env.ts              Fail-fast server env access
    db.ts               Cached Mongoose connection
  models/
    product.ts          Catalogue: price in cents, stock per size
    order.ts            Line items frozen at purchase time
    user.ts             Accounts and roles, OAuth-ready
  hooks/                Client hooks
  data/                 Sample product data                     (step 3)
  types/                Shared domain types
scripts/
  check-db.ts           Connection smoke test
  seed.ts               Sample catalogue, users and orders
public/
  brand/                Logo mark and source artwork
  products/             Supplied product photography
```

## Design tokens

All tokens live in `src/app/globals.css` under `@theme`, which is how
Tailwind v4 is configured — there is no `tailwind.config.ts`.

| Token group    | Examples                                                        |
| -------------- | --------------------------------------------------------------- |
| Colour         | `ink`, `paper`, `muted`, `line`, `wash`, `*-inverse`             |
| Type scale     | `text-display`, `text-hero`, `text-title`, `eyebrow`            |
| Layout         | `max-w-page`, `max-w-measure`, `page-gutter`                    |
| Motion         | `ease-out-soft`, `ease-press`, `--duration-*`                   |
| Custom utility | `surface-inverse`, `type-wide`, `eyebrow`, `underline-draw`     |

Greys are never new hues. `muted` and `line` are black at reduced alpha;
their `-inverse` counterparts are white at reduced alpha for use on black
surfaces. `subtle` and `subtle-inverse` sit below the WCAG AA contrast floor,
so they are for rules and marks only — quiet text uses `muted`.

Two rules are easy to trip over:

- **Black sections get `surface-inverse`**, not `bg-ink text-paper`. The
  utility also flips `--focus-ring` to white, so keyboard focus stays visible.
  Using the raw colour utilities leaves a black focus ring on black.
- **Use `max-w-measure`, never `max-w-prose`.** Tailwind ships a hard-coded
  `max-w-prose` of 65ch that silently shadows any theme token of that name.

## Typography

| Role                                  | Face                              |
| ------------------------------------- | --------------------------------- |
| Headings, nav, buttons, labels        | Archivo, width axis at 112%       |
| Body copy, product detail, forms      | Inter                             |

Archivo is a variable font with a width axis (62–125%), which reproduces the
wide, bold, uppercase setting of the brand's drop posters without a second
font file. `h1`–`h4` pick it up automatically; anything else that needs the
display voice uses `type-wide`. Width is centralised in `--display-width`.

The exact faces used on the posters were not supplied and are likely licensed
families. To swap them in, replace the `next/font/google` calls in
`src/app/layout.tsx` with `next/font/local` pointing at the real files, and
keep the `--font-display` and `--font-sans` variable names — nothing else has
to change.

## Brand assets

| Asset                          | Notes                                        |
| ------------------------------ | -------------------------------------------- |
| `src/components/ui/logo-mark`  | Mark traced to one SVG path in currentColor   |
| `public/brand/logo-mark.svg`   | Same path as a standalone file                |
| `public/brand/logo-square.png` | Original supplied artwork, kept for reference |
| `src/app/icon.png`             | 512px favicon, white mark on black            |
| `src/app/apple-icon.png`       | 180px touch icon                              |
| `src/app/opengraph-image.png`  | 1200×630 social card                          |
| `public/products/`             | Supplied t-shirt photography for sample data  |

The mark is a single path drawn in `currentColor`, so it renders black on
white and white on black with no second asset and no raster edges. It was
traced from the supplied raster at a tolerance that leaves 2.5% of ink pixels
differing from the original, all of it antialiasing on the outline.

## Data model

Three collections. Two decisions are load-bearing and worth knowing before
touching them:

- **Money is stored in minor units** (cents) as validated integers, on both
  `Product.price` and `Order.total`. Floating point money drifts once you
  start summing line items, and Stripe expects integer minor units anyway.
  `formatPrice()` in `src/lib/utils.ts` is the only thing that should turn
  those integers back into a display string.
- **Order line items copy the product name and unit price** rather than only
  referencing the product. Renaming or repricing a product must never rewrite
  the history of an order that has already been paid for.

`Product.stockPerSize` is a Mongoose `Map` keyed by size label, which stays
queryable: `{ "stockPerSize.M": { $gt: 0 } }` filters to products actually
available in medium. `User.passwordHash` is `select: false`, so it never
leaves the database unless a query asks for it with `.select("+passwordHash")`,
and `toJSON` strips it regardless.

## Seeded sample data

`npm run seed` is idempotent — products key on slug, users on email — so it
can be run repeatedly. It creates 8 products across all four categories, 2
accounts, and 3 orders spanning the pending, shipped and delivered statuses so
the account page and admin queue have something real to render.

Two states are seeded deliberately so the UI has edge cases to handle: the
black tee is sold out in M, and the natural tote is sold out entirely.

Only the two t-shirts use real photography. Hoodies, caps and totes point at
generated placeholders in `public/products/` that carry the logo mark and a
"photo pending" caption, so the grid is populated without pretending the
photography exists.

## Build stages

All eight are complete.

1. Scaffold, tokens, base layout, folder structure
2. MongoDB Atlas connection, Product / Order / User models
3. Homepage, product listing and detail pages
4. NextAuth email and password sign up / log in
5. Cart and checkout (Stripe wired, awaiting keys)
6. Admin panel: dashboard, product CRUD, order management, customers
7. Cloudinary uploads (wired, awaiting keys)
8. Polish: animation, responsiveness, loading and empty states

## API

Every route returns JSON. Errors share one shape:

```json
{ "error": { "code": "bad_request", "message": "...", "details": { "field": ["..."] } } }
```

| Method | Route | Access | Purpose |
| ------ | ----- | ------ | ------- |
| GET | `/api/health` | public | Readiness, pings the database |
| GET | `/api/products` | public | Catalogue with filters, sort, pagination |
| GET | `/api/products/[slug]` | public | One product plus related |
| POST | `/api/cart` | public | Price a cart against live stock |
| POST | `/api/auth/register` | public | Create a customer account |
| * | `/api/auth/[...nextauth]` | public | Auth.js session endpoints |
| GET | `/api/orders` | customer | Own order history |
| POST | `/api/orders` | customer | Place an order |
| GET | `/api/orders/[id]` | customer | Own order by id |
| POST | `/api/checkout` | customer | Create a Stripe PaymentIntent |
| POST | `/api/webhooks/stripe` | Stripe | Signed payment events |
| GET | `/api/admin/stats` | admin | Dashboard figures |
| GET POST | `/api/admin/products` | admin | List and create |
| GET PATCH DELETE | `/api/admin/products/[id]` | admin | Read, update, delete |
| GET | `/api/admin/orders` | admin | All orders, filterable |
| GET PATCH | `/api/admin/orders/[id]` | admin | Read and change status |
| GET | `/api/admin/users` | admin | Customers with spend |
| POST | `/api/admin/uploads` | admin | Upload an image to Cloudinary |

Three rules hold across the API and are worth knowing before changing it:

- **The client never sets a price.** Carts and orders send product ids, sizes
  and quantities; every figure is read from the database at request time.
- **Ownership is part of the query, not a check afterwards.** Asking for
  another customer's order returns 404, which reveals nothing about whether
  it exists.
- **Stock decrements are conditional.** Two people buying the last unit at
  once cannot both succeed, and a failed order hands its stock back.

## Roles and access

Authorisation is granted to **permissions**, not roles. Endpoints ask
`requirePermission("orders:cancel")`, never "is this user an admin", so adding
a role is a change to one table in `src/lib/permissions.ts` rather than a hunt
through every route. Each role inherits the one below it.

| Role        | Holds    | In short                                                                                |
| ----------- | -------- | --------------------------------------------------------------------------------------- |
| Customer    | 0 of 15  | Shops the store. No admin access at all.                                                  |
| Staff       | 6 of 15  | Fulfilment. Reads the catalogue and moves orders along. No revenue, no edits, no deletes. |
| Admin       | 12 of 15 | Runs the shop. Full catalogue and order control plus revenue reporting. Cannot change roles. |
| Super admin | 15 of 15 | Owner. Everything, including granting access and removing accounts.                       |

The live matrix is at `/admin/access`, generated from the same table the API
enforces, so it cannot drift from the real rules the way a written document
does.

Two rules stop the store locking itself out, both enforced server-side:

- Nobody can change their own role.
- The last super admin cannot be demoted or deleted.

## Admin panel

`/admin` is its own shell with a left rail, not the storefront chrome. The shop
lives in a `(store)` route group so the two never share a header. Sidebar
entries the signed-in role cannot use are not rendered at all; the API enforces
the same permissions independently, so hiding a link is presentation and never
the security boundary.

| Section          | Needs            | What it does                                            |
| ---------------- | ---------------- | ------------------------------------------------------- |
| Dashboard        | `dashboard:view` | Stat tiles, revenue chart, status and stock breakdowns   |
| Orders           | `orders:read`    | Fulfilment queue with inline status changes              |
| Products         | `products:read`  | Catalogue table, create / edit / delete                  |
| Customers        | `customers:read` | Accounts with order count and lifetime spend             |
| Roles and access | `admin:access`   | The permission matrix, plus assignment for super admins  |
| Settings         | `settings:read`  | Store details and integration status                     |

### Charts

The brand has one colour, so the charts carry identity through position, length
and direct labels rather than hue. Two rules govern the ink ramp defined in
`globals.css`:

- **Ordered scales get the ramp.** Order status is a lifecycle, so its bars
  shade from pending through to cancelled.
- **Nominal categories get one fill.** Product names have no natural order, so
  every bar is solid ink. Shading those by value would double-encode the bar
  length and say nothing new.

The ramp is black at 100, 72, 48 and 30 percent alpha. Those steps were checked
rather than eyeballed: lightness is monotone, the gaps are wide enough to read,
and the faintest step sits at 2.04:1 against the surface. Lighten it further and
the last bar stops being visible. Every chart also ships a table view, so no
value is reachable only by hovering.

## Testing

```bash
npm run test:api   # 152 checks against a running server and real database
npm run test:ui    # 31 checks driving a real browser, writes .screenshots/
```

Both suites need the dev or production server running and the database
seeded. They create their own throwaway accounts and clean up afterwards, so
they can be run repeatedly. The API suite covers the happy paths, the
validation failures, the authorisation boundaries, and the cases where
trusting the client would cost money.

## Notes for contributors

`AGENTS.md` is generated by `next dev` and points AI agents at the
version-matched docs bundled in `node_modules/next/dist/docs/`. Next.js 16
differs from earlier versions in ways worth knowing: Turbopack is the default
bundler, `params` and `searchParams` are promises, `middleware` is now
`proxy`, error boundaries receive `retry` rather than `reset`, and smooth
scrolling requires `data-scroll-behavior="smooth"` on `<html>`.

Set `NEXT_PUBLIC_SITE_URL` for local metadata resolution. On Vercel the
production domain is picked up automatically, so the build warning about
`metadataBase` only appears when neither is available.
