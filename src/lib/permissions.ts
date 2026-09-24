/**
 * Roles and what each one is allowed to do.
 *
 * Permissions are the unit of authorisation, not roles. Route handlers ask
 * "may this user cancel an order", never "is this user an admin", so adding a
 * role later is a change to one table here rather than a hunt through every
 * endpoint for role checks that need widening.
 *
 * The hierarchy is cumulative by construction: each role inherits the one
 * below it and adds powers, so a super admin can never accidentally be
 * granted less than an admin.
 */

export const ROLES = ["customer", "staff", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "admin:access",
  "dashboard:view",
  "analytics:view",
  "products:read",
  "products:write",
  "products:delete",
  "orders:read",
  "orders:update",
  "orders:cancel",
  "customers:read",
  "customers:delete",
  "roles:manage",
  "uploads:write",
  "settings:read",
  "settings:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Human-readable description of each power, shown on the access page. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "admin:access": "Open the admin panel",
  "dashboard:view": "See the dashboard",
  "analytics:view": "See revenue and sales charts",
  "products:read": "View the catalogue",
  "products:write": "Create and edit products",
  "products:delete": "Delete products",
  "orders:read": "View orders",
  "orders:update": "Move orders through fulfilment",
  "orders:cancel": "Cancel orders and restock them",
  "customers:read": "View the customer list",
  "customers:delete": "Delete customer accounts",
  "roles:manage": "Change what other people can do",
  "uploads:write": "Upload product images",
  "settings:read": "View store settings",
  "settings:write": "Change store settings",
};

/** Grouping used to lay the access matrix out in readable blocks. */
export const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  {
    title: "Access",
    permissions: ["admin:access", "dashboard:view", "analytics:view"],
  },
  {
    title: "Catalogue",
    permissions: ["products:read", "products:write", "products:delete", "uploads:write"],
  },
  {
    title: "Orders",
    permissions: ["orders:read", "orders:update", "orders:cancel"],
  },
  {
    title: "People",
    permissions: ["customers:read", "customers:delete", "roles:manage"],
  },
  {
    title: "Store",
    permissions: ["settings:read", "settings:write"],
  },
];

const CUSTOMER: Permission[] = [];

/** Fulfilment: can move orders along, but cannot change the catalogue. */
const STAFF: Permission[] = [
  "admin:access",
  "dashboard:view",
  "products:read",
  "orders:read",
  "orders:update",
  "customers:read",
];

/** Runs the shop day to day. Everything except power over other people. */
const ADMIN: Permission[] = [
  ...STAFF,
  "analytics:view",
  "products:write",
  "products:delete",
  "orders:cancel",
  "uploads:write",
  "settings:read",
];

/** Owner. Everything, including who else gets in. */
const SUPER_ADMIN: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  customer: CUSTOMER,
  staff: STAFF,
  admin: ADMIN,
  super_admin: SUPER_ADMIN,
};

export const ROLE_LABELS: Record<Role, string> = {
  customer: "Customer",
  staff: "Staff",
  admin: "Admin",
  super_admin: "Super admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  customer: "Shops the store. No access to the admin panel at all.",
  staff: "Fulfilment. Reads the catalogue and moves orders along, but cannot change prices, delete anything, or see revenue.",
  admin: "Runs the shop. Full control of the catalogue and orders, plus revenue reporting. Cannot change anyone's role.",
  super_admin: "Owner. Everything an admin can do, plus granting and revoking access and removing accounts.",
};

/** Ordering used wherever roles are listed, least powerful first. */
export const ROLE_RANK: Record<Role, number> = {
  customer: 0,
  staff: 1,
  admin: 2,
  super_admin: 3,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Does this role hold this permission? */
export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Does this role hold every one of these permissions? */
export function canAll(role: Role | undefined | null, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/** Every permission a role holds, in declaration order. */
export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((permission) => can(role, permission));
}
