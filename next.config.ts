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
};

export default nextConfig;
