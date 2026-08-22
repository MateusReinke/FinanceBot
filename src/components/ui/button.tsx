import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  // The gradient is the app's one piece of brand decoration on a control.
  // It sits on the primary action only — spread across every button it
  // stops meaning "this is the thing to press".
  primary:
    "bg-brand-gradient bg-brand-gradient-hover text-primary-foreground shadow-brand hover:-translate-y-px hover:shadow-raised",
  secondary: "bg-muted text-foreground hover:bg-border",
  outline:
    "border border-border bg-card/60 text-foreground backdrop-blur-sm hover:border-primary/40 hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  // text-background, not white: --danger is a deep red in the light theme
  // and a light rose in the dark one, so white text on it is unreadable in
  // dark mode. --background inverts alongside it and stays legible in both.
  danger: "bg-danger text-background hover:opacity-90 shadow-card",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
