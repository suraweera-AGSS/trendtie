"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { ProductDTO } from "@/lib/catalogue";
import { CATEGORIES, SIZES, type Category, type Size } from "@/lib/site-config";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Product CRUD.
 *
 * Prices are entered in whole currency units because that is how a person
 * thinks about them, and converted to the integer cents the API expects on
 * submit. Doing the conversion in one place here keeps the rest of the stack
 * working in minor units without leaking that into the form.
 */
export function ProductManager({ products }: { products: ProductDTO[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(product: ProductDTO) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not delete the product.");
    }
    setBusy(false);
    router.refresh();
  }

  async function toggleFeatured(product: ProductDTO) {
    setBusy(true);
    await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ featured: !product.featured }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-title">Products</h1>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          New product
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-6 border border-ink p-4 text-sm">
          {error}
        </p>
      )}

      {(creating || editing) && (
        <ProductForm
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-sm">
          <thead>
            <tr className="border-y border-line">
              <th className="eyebrow py-4 text-left text-muted">Product</th>
              <th className="eyebrow py-4 text-left text-muted">Category</th>
              <th className="eyebrow py-4 text-right text-muted">Price</th>
              <th className="eyebrow py-4 text-right text-muted">Stock</th>
              <th className="eyebrow py-4 text-center text-muted">Featured</th>
              <th className="eyebrow py-4 text-right text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-line">
                <td className="py-4 pr-4">
                  <span className="block font-medium">{product.name}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {product.slug}
                  </span>
                </td>
                <td className="py-4 pr-4 text-muted">{product.category}</td>
                <td className="py-4 pr-4 text-right tabular-nums">
                  {formatPrice(product.price)}
                </td>
                <td
                  className={cn(
                    "py-4 pr-4 text-right tabular-nums",
                    product.totalStock === 0 && "line-through",
                  )}
                >
                  {product.totalStock}
                </td>
                <td className="py-4 text-center">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleFeatured(product)}
                    aria-pressed={product.featured}
                    className={cn(
                      "type-wide cursor-pointer border px-2.5 py-1 text-[0.625rem] tracking-wide-caps uppercase",
                      product.featured
                        ? "border-ink bg-ink text-paper"
                        : "border-line text-muted hover:border-ink",
                    )}
                  >
                    {product.featured ? "Yes" : "No"}
                  </button>
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(product);
                        setCreating(false);
                      }}
                      className="underline-draw type-wide cursor-pointer text-[0.625rem] tracking-wide-caps uppercase"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(product)}
                      className="underline-draw type-wide cursor-pointer text-[0.625rem] tracking-wide-caps text-muted uppercase"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
}: {
  product: ProductDTO | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(product);
  const [sizes, setSizes] = useState<Size[]>(product?.sizes ?? ["S", "M", "L"]);
  const [stock, setStock] = useState<Partial<Record<Size, number>>>(
    product?.stockPerSize ?? {},
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const form = new FormData(event.currentTarget);
    const majorUnits = Number(form.get("price"));

    const payload = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      // Rounded because 45.1 * 100 is 4509.999… in binary floating point.
      price: Math.round(majorUnits * 100),
      category: String(form.get("category") ?? "tees") as Category,
      sizes,
      stockPerSize: Object.fromEntries(
        sizes.map((size) => [size, Number(stock[size] ?? 0)]),
      ),
      images: [
        {
          url: String(form.get("imageUrl") ?? ""),
          alt: String(form.get("imageAlt") ?? ""),
        },
      ],
      featured: form.get("featured") === "on",
    };

    const response = await fetch(
      isEdit ? `/api/admin/products/${product!.id}` : "/api/admin/products",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not save the product.");
      setFieldErrors(body?.error?.details ?? {});
      setSubmitting(false);
      return;
    }

    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 border border-ink p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-title">{isEdit ? "Edit product" : "New product"}</h2>
        <button
          type="button"
          onClick={onClose}
          className="underline-draw type-wide cursor-pointer text-xs tracking-wide-caps text-muted uppercase"
        >
          Cancel
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 border border-ink p-4 text-sm">
          {error}
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Field
          label="Name"
          name="name"
          required
          defaultValue={product?.name}
          error={fieldErrors.name?.[0]}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor="category" className="eyebrow text-muted">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={product?.category ?? "tees"}
            className="w-full cursor-pointer border border-line bg-paper px-4 py-3 text-sm"
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={product ? (product.price / 100).toFixed(2) : ""}
          hint="In whole currency units, for example 45.00"
          error={fieldErrors.price?.[0]}
        />
        <Field
          label="Image URL"
          name="imageUrl"
          required
          defaultValue={product?.images[0]?.url ?? "/products/placeholder-tote.png"}
          hint="Cloudinary uploads replace this in step 7"
          error={fieldErrors.images?.[0]}
        />

        <Field
          label="Image alt text"
          name="imageAlt"
          required
          defaultValue={product?.images[0]?.alt ?? ""}
        />

        <div className="flex items-end">
          <label className="type-wide flex cursor-pointer items-center gap-2.5 pb-3 text-xs tracking-wide-caps uppercase">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={product?.featured}
              className="size-4 cursor-pointer accent-black"
            />
            Featured on the homepage
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <label htmlFor="description" className="eyebrow text-muted">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={4}
          defaultValue={product?.description}
          className="w-full border border-line bg-paper px-4 py-3 text-sm focus:border-ink"
        />
      </div>

      <fieldset className="mt-8">
        <legend className="eyebrow text-muted">Sizes and stock</legend>
        <div className="mt-4 flex flex-wrap gap-3">
          {SIZES.map((size) => {
            const enabled = sizes.includes(size);
            return (
              <div key={size} className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  aria-pressed={enabled}
                  onClick={() =>
                    setSizes((current) =>
                      enabled
                        ? current.filter((s) => s !== size)
                        : [...current, size],
                    )
                  }
                  className={cn(
                    "type-wide w-20 cursor-pointer border px-2 py-2 text-[0.625rem] tracking-wide-caps uppercase",
                    enabled
                      ? "border-ink bg-ink text-paper"
                      : "border-line text-muted hover:border-ink",
                  )}
                >
                  {size === "ONE_SIZE" ? "One" : size}
                </button>
                <input
                  type="number"
                  min="0"
                  aria-label={`Stock for size ${size}`}
                  disabled={!enabled}
                  value={stock[size] ?? 0}
                  onChange={(event) =>
                    setStock((current) => ({
                      ...current,
                      [size]: Number(event.target.value),
                    }))
                  }
                  className="w-20 border border-line bg-paper px-2 py-2 text-center text-sm tabular-nums disabled:opacity-30"
                />
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 flex gap-4">
        <Button type="submit" disabled={submitting || sizes.length === 0}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create product"}
        </Button>
        {sizes.length === 0 && (
          <p className="self-center text-xs text-muted">
            Select at least one size.
          </p>
        )}
      </div>
    </form>
  );
}
