"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { Input, Label, FieldError } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function RegisterForm() {
  const [state, action] = useActionState(signup, undefined);

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome completo</Label>
        <Input id="name" name="name" placeholder="Seu nome" required autoFocus />
        <FieldError messages={state?.errors?.name} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" placeholder="voce@email.com" required />
        <FieldError messages={state?.errors?.email} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phoneNumber">WhatsApp</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          inputMode="tel"
          placeholder="(11) 99999-9999"
          required
        />
        <FieldError messages={state?.errors?.phoneNumber} />
        <p className="text-muted-foreground text-xs">
          Usado para lançar gastos por mensagem e para te incluir no grupo quando você entrar em uma
          divisão de contas.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          required
        />
        <FieldError messages={state?.errors?.password} />
        <p className="text-muted-foreground text-xs">
          Use ao menos 8 caracteres, com letras e números.
        </p>
      </div>
      {state?.message ? (
        <p className="text-danger text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton className="w-full">Criar conta</SubmitButton>
      <p className="text-muted-foreground text-center text-sm">
        Já tem uma conta?{" "}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
