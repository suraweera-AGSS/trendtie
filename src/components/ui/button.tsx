import { cn } from "@/lib/utils";

export type ButtonVariant = "solid" | "outline" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "type-wide inline-flex items-center justify-center gap-2 border font-medium uppercase " +
  "tracking-wide-caps whitespace-nowrap select-none cursor-pointer " +
  "transition-[background-color,color,border-color,scale,opacity] " +
  "duration-(--duration-quick) ease-out-soft " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  solid: "border-ink bg-ink text-paper hover:bg-paper hover:text-ink",
  outline: "border-ink bg-paper text-ink hover:bg-ink hover:text-paper",
  ghost:
    "border-transparent bg-transparent text-ink hover:border-ink/100 hover:bg-transparent",
  inverse:
    "border-paper bg-paper text-ink hover:bg-transparent hover:text-paper",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-[0.6875rem]",
  md: "h-11 px-6 text-xs",
  lg: "h-14 px-9 text-xs sm:h-16 sm:px-12 sm:text-sm",
};

/** Shared button styling, exported so links can adopt the same look. */
export function buttonClasses(
  variant: ButtonVariant = "solid",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "solid",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  );
}
