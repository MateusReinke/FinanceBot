import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "bg-card text-foreground placeholder:text-muted-foreground hover:border-muted-foreground/30 focus-visible:border-primary focus-visible:ring-ring/15 h-10 w-full rounded-lg border px-3 text-sm transition-all duration-200 outline-none focus-visible:ring-4",
          invalid ? "border-danger" : "border-border",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("text-foreground text-sm font-medium", className)} {...props} />
);

export const FieldError = ({ messages }: { messages?: string[] }) => {
  if (!messages?.length) return null;
  return (
    <p className="text-danger text-sm" role="alert">
      {messages[0]}
    </p>
  );
};

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "border-border bg-card text-foreground hover:border-muted-foreground/30 focus-visible:border-primary focus-visible:ring-ring/15 h-10 w-full rounded-lg border px-3 text-sm transition-all duration-200 outline-none focus-visible:ring-4",
          className
        )}
        {...props}
      />
    );
  }
);
Select.displayName = "Select";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "border-border bg-card text-foreground placeholder:text-muted-foreground hover:border-muted-foreground/30 focus-visible:border-primary focus-visible:ring-ring/15 w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200 outline-none focus-visible:ring-4",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";
