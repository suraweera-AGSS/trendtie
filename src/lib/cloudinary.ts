import { createHash } from "node:crypto";

/**
 * Cloudinary uploads.
 *
 * Implemented against Cloudinary's REST API with fetch and a signed request
 * rather than the SDK: it is a single POST, it avoids another dependency in
 * the server bundle, and the signing rule is small enough to state plainly.
 *
 * Credentials are optional, matching Stripe. The admin panel works without
 * them by accepting an image URL directly; uploading is the upgrade.
 */

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured(): boolean {
  return getCloudinaryConfig() !== null;
}

/**
 * Cloudinary signs the alphabetically sorted parameters, excluding the file,
 * the api_key and the signature itself, joined as a query string with the
 * API secret appended, hashed with SHA-1.
 */
export function signUpload(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("sha1").update(canonical + apiSecret).digest("hex");
}

export type UploadResult = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
  format: string;
};

/** Upload a file to Cloudinary under the store's product folder. */
export async function uploadImage(
  file: File,
  config: CloudinaryConfig,
  folder = "trendtie/products",
): Promise<UploadResult> {
  // Timestamps must come from the caller's clock and are part of the
  // signature, which is what stops a captured request being replayed later.
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signUpload({ folder, timestamp }, config.apiSecret);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", config.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    { method: "POST", body: form },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Cloudinary rejected the upload (${response.status}). ${detail.slice(0, 300)}`,
    );
  }

  const body = (await response.json()) as {
    secure_url: string;
    public_id: string;
    width: number;
    height: number;
    bytes: number;
    format: string;
  };

  return {
    url: body.secure_url,
    publicId: body.public_id,
    width: body.width,
    height: body.height,
    bytes: body.bytes,
    format: body.format,
  };
}
