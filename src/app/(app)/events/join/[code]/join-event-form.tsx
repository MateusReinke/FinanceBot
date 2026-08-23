"use client";

import { useActionState } from "react";
import { joinEventByCode } from "@/app/actions/events";
import { SubmitButton } from "@/components/ui/submit-button";

export function JoinEventForm({ code }: { code: string }) {
  const [state, action] = useActionState(joinEventByCode, undefined);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="code" value={code} />
      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Entrar no evento</SubmitButton>
    </form>
  );
}
