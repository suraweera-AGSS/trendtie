import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { credentialsSchema } from "@/lib/validation";
import type { Role } from "@/lib/permissions";

/**
 * Auth.js configuration.
 *
 * Sessions are JWTs rather than database rows: the credentials provider
 * requires it, and it keeps every authenticated request free of a database
 * round trip just to resolve the session. The trade-off is that a role change
 * only takes effect when the token refreshes, which is acceptable here
 * because roles are set by hand in the admin panel.
 *
 * The provider list is deliberately an array with one entry. Adding Google or
 * GitHub later means appending a provider, with no change to the callbacks,
 * the session shape or anything that consumes `auth()`.
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js reads AUTH_SECRET by default; NEXTAUTH_SECRET is accepted too so
  // a single secret works across the app and any older tooling.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        await connectToDatabase();

        const user = await User.findOne({ email: parsed.data.email }).select(
          "+passwordHash",
        );

        // Accounts created through an OAuth provider have no password hash.
        // Returning null keeps the failure indistinguishable from a wrong
        // password, so this cannot be used to enumerate accounts.
        if (!user?.passwordHash) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "customer";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "customer";
      }
      return session;
    },
  },
});
