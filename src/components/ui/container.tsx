import { cn } from "@/lib/utils";

type ContainerProps = React.ComponentPropsWithoutRef<"div"> & {
  /** `wide` fills the page container, `prose` narrows to a reading measure. */
  width?: "wide" | "prose";
};

/** Horizontal shell: one place that owns max-width and page gutters. */
export function Container({
  className,
  width = "wide",
  ...props
}: ContainerProps) {
  return (
    <div
      className={cn(
        "page-gutter mx-auto w-full",
        width === "wide" ? "max-w-page" : "max-w-measure",
        className,
      )}
      {...props}
    />
  );
}
