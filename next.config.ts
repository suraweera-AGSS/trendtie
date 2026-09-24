import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Product photography is served from Cloudinary once uploads are wired up
    // in the admin panel (step 7). Local images under /public need no entry.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    // Next 16 defaults to [75]; 90 is allowed for large hero photography.
    qualities: [75, 90],
  },
  typedRoutes: true,

  // Mongoose resolves several of its internals through dynamic require calls
  // that a bundler cannot follow, which fails the Turbopack build. Marking it
  // external leaves it to Node's own require at runtime, which is how the
  // driver expects to be loaded anyway.
  serverExternalPackages: ["mongoose"],
};

export default nextConfig;
