import { ApiError, badRequest, jsonCreated, route } from "@/lib/api";
import { requirePermission } from "@/lib/guards";
import { getCloudinaryConfig, uploadImage } from "@/lib/cloudinary";

/** Only raster formats the storefront actually renders. */
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/admin/uploads — put a product image on Cloudinary.
 *
 * Admin only, because an open upload endpoint is free hosting for anyone who
 * finds it. The type and size are checked before the file leaves the server,
 * so a malformed upload fails here rather than costing a round trip.
 */
export const POST = route(async (request: Request) => {
  await requirePermission("uploads:write");

  const config = getCloudinaryConfig();
  if (!config) {
    throw new ApiError(
      503,
      "cloudinary_not_configured",
      "Image uploads are not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to .env.local.",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw badRequest("Expected a multipart form body.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw badRequest("Attach the image as a 'file' field.");
  }

  if (!ALLOWED.has(file.type)) {
    throw badRequest(
      `Unsupported image type ${file.type || "unknown"}. Use JPEG, PNG, WebP or AVIF.`,
    );
  }

  if (file.size > MAX_BYTES) {
    throw badRequest(
      `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 8MB.`,
    );
  }

  const result = await uploadImage(file, config);

  return jsonCreated({ image: result });
});
