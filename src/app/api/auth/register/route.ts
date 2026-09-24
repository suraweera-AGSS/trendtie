import { hash } from "bcryptjs";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models";
import { conflict, jsonCreated, parseJson, route } from "@/lib/api";
import { registerSchema } from "@/lib/validation";

const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/register — create a customer account.
 *
 * Role is never taken from the request body. A caller cannot make themselves
 * an admin by adding `"role": "admin"` to the payload; the schema drops
 * unknown keys and the document is built explicitly below.
 */
export const POST = route(async (request: Request) => {
  const input = await parseJson(request, registerSchema);

  await connectToDatabase();

  const existing = await User.findOne({ email: input.email }).select("_id");
  if (existing) {
    throw conflict("An account with that email already exists.", {
      email: ["Already registered."],
    });
  }

  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: "customer",
  });

  // toJSON strips passwordHash, so this is safe to return as-is.
  return jsonCreated({
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});
