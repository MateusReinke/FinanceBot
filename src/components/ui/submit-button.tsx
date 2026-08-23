"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({ children, disabled, ...props }: ButtonProps) {
  const { pending } = useFormStatus();
  // Combined rather than spread over: a caller passing `disabled` for its
  // own validation must not accidentally re-enable the button mid-submit.
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? "Enviando..." : children}
    </Button>
  );
}
