import Link from "next/link";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

const VARIANTS = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  destructive: "bg-chip-neg text-white shadow-sm hover:brightness-110",
} as const;

const SIZES = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-3.5 py-2 text-sm",
  lg: "px-4 py-2.5 text-sm",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  /** Renders as a <Link> to this href instead of a <button>. */
  href?: string;
};

/**
 * The one button component every surface in the app should reach for —
 * primary/secondary/ghost/destructive cover the whole hierarchy so no two
 * pages invent their own competing button style. `primary` is the single
 * blue accent fill (white text); it is the only thing on a page allowed to
 * carry that colour at full strength.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconPosition = "left",
  href,
  className,
  children,
  ...rest
}: ButtonOwnProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = clsx(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded font-medium transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    className
  );
  const iconSize = size === "sm" ? 13 : 15;

  const content = (
    <>
      {Icon && iconPosition === "left" && <Icon size={iconSize} strokeWidth={2.25} />}
      {children}
      {Icon && iconPosition === "right" && <Icon size={iconSize} strokeWidth={2.25} />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={rest.type ?? "button"} className={classes} {...rest}>
      {content}
    </button>
  );
}
