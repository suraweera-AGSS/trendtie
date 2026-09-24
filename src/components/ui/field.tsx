import { cn } from "@/lib/utils";

type FieldProps = React.ComponentPropsWithoutRef<"input"> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Text input with its label, hint and error wired together.
 *
 * The error is linked through aria-describedby and marked aria-invalid, so a
 * screen reader announces why a field was rejected instead of leaving the
 * user to guess from a colour they may not be able to see — which matters
 * more than usual in a palette with no red.
 */
export function Field({
  label,
  hint,
  error,
  className,
  id,
  name,
  ...props
}: FieldProps) {
  const fieldId = id ?? name;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="eyebrow text-muted">
        {label}
        {props.required && <span aria-hidden> *</span>}
      </label>

      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "w-full border bg-paper px-4 py-3 text-sm",
          "transition-[border-color] duration-(--duration-quick) ease-out-soft",
          "placeholder:text-subtle hover:border-line-strong focus:border-ink",
          error ? "border-ink" : "border-line",
          className,
        )}
        {...props}
      />

      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}
