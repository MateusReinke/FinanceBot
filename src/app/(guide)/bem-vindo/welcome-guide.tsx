"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Check,
  CreditCard,
  Landmark,
  MessageCircle,
  PiggyBank,
  Repeat,
  ScanLine,
  Wallet2,
} from "lucide-react";
import { AccountForm } from "@/app/(app)/accounts/account-form";
import { finishGuide } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

type Integrations = { whatsapp: boolean; openFinance: boolean; google: boolean };

const STEP_TITLES = [
  "Como o app funciona",
  "Sua primeira conta",
  "Registrando gastos",
  "Tudo pronto",
];

export function WelcomeGuide({
  firstName,
  revisiting,
  hasAccount,
  integrations,
}: {
  firstName: string;
  revisiting: boolean;
  hasAccount: boolean;
  integrations: Integrations;
}) {
  const [step, setStep] = useState(0);
  // Starts from what the server knows and flips when the form on step 2
  // succeeds, so the step turns into a confirmation instead of offering to
  // create a second account.
  const [accountCreated, setAccountCreated] = useState(hasAccount);
  const last = STEP_TITLES.length - 1;

  return (
    <div className="surface overflow-hidden rounded-2xl">
      <header className="border-border flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="text-foreground flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="bg-brand text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
            <Wallet2 className="h-[18px] w-[18px]" />
          </span>
          FinanceBot
        </div>
        {revisiting ? (
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground text-sm font-medium"
          >
            Voltar ao painel
          </Link>
        ) : (
          // Always available, on every step. A guide you cannot leave is a
          // wall, and someone who already knows the app should not have to
          // click through four screens to prove it.
          <form action={finishGuide}>
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-medium"
            >
              Pular guia
            </button>
          </form>
        )}
      </header>

      {/* Four segments rather than a single filling bar: it says how many
          steps there are, which is the question someone on step 1 of an
          unknown wizard is actually asking. */}
      <div className="flex gap-1 px-6 pt-5">
        {STEP_TITLES.map((title, i) => (
          <span
            key={title}
            aria-hidden
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= step ? "bg-primary" : "bg-muted"
            )}
          />
        ))}
      </div>

      <div className="px-6 py-6 sm:px-8 sm:py-7">
        <p className="text-muted-foreground text-xs font-medium tracking-[0.08em] uppercase">
          Passo {step + 1} de {STEP_TITLES.length} · {STEP_TITLES[step]}
        </p>

        <div className="mt-4">
          {step === 0 ? <StepConcepts firstName={firstName} /> : null}
          {step === 1 ? (
            <StepAccount created={accountCreated} onCreated={() => setAccountCreated(true)} />
          ) : null}
          {step === 2 ? <StepRecording integrations={integrations} /> : null}
          {step === 3 ? <StepDone /> : null}
        </div>
      </div>

      <footer className="border-border flex items-center justify-between gap-3 border-t px-6 py-4">
        <Button
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className={cn(step === 0 && "invisible")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        {step === last ? (
          <form action={finishGuide}>
            <SubmitButton>
              Ir para o painel
              <ArrowRight className="h-4 w-4" />
            </SubmitButton>
          </form>
        ) : (
          // On the account step the form's own "Criar conta" is the primary
          // action, so moving on has to look like the lesser of the two —
          // two filled buttons on one screen is two screens' worth of
          // decisions.
          <Button
            variant={step === 1 && !accountCreated ? "outline" : "primary"}
            onClick={() => setStep((s) => Math.min(last, s + 1))}
          >
            {step === 1 && !accountCreated ? "Faço isso depois" : "Continuar"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </footer>
    </div>
  );
}

function StepConcepts({ firstName }: { firstName: string }) {
  const concepts = [
    {
      icon: Landmark,
      title: "Contas",
      text: "Onde seu dinheiro está: conta do banco, carteira, cartão de crédito. Cada uma tem seu saldo.",
    },
    {
      icon: Banknote,
      title: "Lançamentos",
      text: "Tudo o que entra e o que sai, ligado a uma conta e a uma categoria (alimentação, moradia, ...).",
    },
    {
      icon: Repeat,
      title: "Fixos e parcelados",
      text: "O que se repete — aluguel, assinatura, parcela do celular. Cadastre uma vez, o app preenche os meses seguintes.",
    },
    {
      icon: PiggyBank,
      title: "Orçamentos",
      text: "Um teto de gasto por categoria no mês, para o painel avisar antes de estourar.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Bem-vindo, {firstName}.
        </h1>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          Em menos de dois minutos você vai saber onde fica cada coisa. São quatro ideias, e o resto
          do app é combinação delas.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {concepts.map(({ icon: Icon, title, text }) => (
          <li key={title} className="border-border bg-muted/40 rounded-xl border p-4">
            <p className="text-foreground flex items-center gap-2 text-sm font-semibold">
              <Icon className="text-primary h-4 w-4" />
              {title}
            </p>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>

      {/* The one concept that is genuinely this app's own, and the one that
          confuses everybody on day one if nobody explains it. */}
      <div className="border-border rounded-xl border p-4">
        <p className="text-foreground text-sm font-semibold">Previsto e realizado</p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          Um lançamento pode já ter acontecido (
          <strong className="text-foreground font-medium">realizado</strong> — o dinheiro saiu da
          conta) ou estar agendado para uma data futura (
          <strong className="text-foreground font-medium">previsto</strong>). O saldo mostra o que
          você tem hoje; a previsão mostra onde ele chega no fim do mês se tudo o que está agendado
          acontecer.
        </p>
      </div>
    </div>
  );
}

function StepAccount({ created, onCreated }: { created: boolean; onCreated: () => void }) {
  if (created) {
    return (
      <div className="space-y-4">
        <div className="border-success/25 bg-success-bg text-success flex items-start gap-3 rounded-xl border p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Conta cadastrada.</p>
            <p className="mt-0.5 text-sm opacity-90">
              Você pode cadastrar quantas quiser depois, em Contas — inclusive cartões de crédito,
              com dia de fechamento e de vencimento.
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Dica: para um cartão de crédito, o saldo é o quanto você{" "}
          <strong className="text-foreground font-medium">deve</strong> — um valor negativo, como
          -1200.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">
          Comece pela conta que você mais usa
        </h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          Sem uma conta não há onde registrar um gasto. Cadastre a principal agora — as outras
          entram depois, em Contas.
        </p>
      </div>
      <div className="border-border rounded-xl border p-4 sm:p-5">
        <AccountForm onSuccess={onCreated} />
      </div>
    </div>
  );
}

function StepRecording({ integrations }: { integrations: Integrations }) {
  const ways = [
    {
      icon: Wallet2,
      title: "Direto no app",
      text: "Em Lançamentos, botão “Novo lançamento”. Marque como pago se o dinheiro já saiu, ou deixe agendado para uma data futura.",
      available: true,
    },
    {
      icon: MessageCircle,
      title: "Pelo WhatsApp",
      text: "Mande “almoço 32” para o bot e o lançamento cai aqui, já categorizado. Configure em Configurações → WhatsApp.",
      available: integrations.whatsapp,
    },
    {
      icon: Landmark,
      title: "Importando do banco",
      text: "Conecte suas contas por Open Finance em Contas e os lançamentos vêm sozinhos, sem digitar nada.",
      available: integrations.openFinance,
    },
    {
      icon: ScanLine,
      title: "Lendo a fatura do cartão",
      text: "Suba o PDF da fatura em Contas e o app cria os lançamentos de cada compra.",
      available: integrations.whatsapp,
    },
  ].filter((w) => w.available);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">
          {ways.length > 1 ? `${ways.length} jeitos de registrar um gasto` : "Registrando um gasto"}
        </h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          O trabalho de digitar tudo é o que faz a maioria das pessoas desistir de um app de
          finanças. Aqui dá para fugir dele.
        </p>
      </div>

      <ul className="space-y-3">
        {ways.map(({ icon: Icon, title, text }) => (
          <li key={title} className="border-border flex gap-3.5 rounded-xl border p-4">
            <span className="border-border bg-muted text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-foreground text-sm font-semibold">{title}</p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-border bg-muted/40 flex gap-3.5 rounded-xl border p-4">
        <span className="border-border bg-card text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
          <CreditCard className="h-4 w-4" />
        </span>
        <div>
          <p className="text-foreground text-sm font-semibold">Gasto no cartão de crédito</p>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Registre na conta do cartão, não na do banco. O saldo do cartão é a fatura em aberto;
            quando você paga, use “Pagar fatura” em Contas e o dinheiro sai da conta corrente.
          </p>
        </div>
      </div>
    </div>
  );
}

function StepDone() {
  const next = [
    "Cadastre as contas fixas em Fixos e parcelados — é o que dá previsão ao painel.",
    "Defina um teto por categoria em Orçamentos.",
    "Rachou uma conta com amigos? Dividir contas calcula quem deve quanto para quem.",
    "Emprestou dinheiro? A receber acompanha o que ainda não voltou.",
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-foreground text-xl font-semibold tracking-tight">
          É isso. O resto você descobre usando.
        </h2>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          No painel há uma lista de primeiros passos que vai marcando sozinha o que você já fez.
          Quando terminar, ela some.
        </p>
      </div>

      <ul className="space-y-2.5">
        {next.map((text) => (
          <li
            key={text}
            className="text-muted-foreground flex items-start gap-2.5 text-sm leading-relaxed"
          >
            <span className="border-border mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border">
              <Check className="text-muted-foreground h-2.5 w-2.5" />
            </span>
            {text}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm leading-relaxed">
        Para rever este guia depois, ele fica no menu do seu perfil, no canto superior direito.
      </p>
    </div>
  );
}
