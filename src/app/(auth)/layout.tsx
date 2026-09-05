import { Wallet2, PieChart, Landmark, ShieldCheck, MessageCircle } from "lucide-react";

const FEATURES = [
  {
    icon: PieChart,
    title: "Tudo o que entra e sai, em um lugar",
    text: "Lançamentos, faturas de cartão, contas fixas e parceladas — com o previsto separado do realizado.",
  },
  {
    icon: Landmark,
    title: "Contas conectadas por Open Finance",
    text: "Importe os lançamentos do banco em vez de digitar um a um.",
  },
  {
    icon: MessageCircle,
    title: "Registre pelo WhatsApp",
    text: 'Mande "almoço 32" para o bot e o lançamento aparece aqui.',
  },
  {
    icon: ShieldCheck,
    title: "Seus dados são só seus",
    text: "Sessão assinada, dados isolados por usuário e nada compartilhado com terceiros.",
  },
];

// The left half is the first thing anyone sees, so it says what the product
// does — plainly, on the same neutral ground as the rest of the app. It used
// to be a dark panel with four colour washes over it: pretty for a second,
// and then a promise the (calm, dense) app behind it does not keep.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_1fr]">
      <div className="border-border bg-card relative hidden flex-col justify-between border-r p-12 lg:flex">
        <div className="text-foreground flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
          <span className="bg-brand text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
            <Wallet2 className="h-[18px] w-[18px]" />
          </span>
          FinanceBot
        </div>

        <div className="max-w-md space-y-10">
          <div className="space-y-3">
            <h1 className="text-foreground text-[2rem] leading-[1.2] font-semibold tracking-tight text-balance">
              Saiba exatamente para onde vai o seu dinheiro.
            </h1>
            <p className="text-muted-foreground text-[15px] leading-relaxed">
              Controle de gastos pessoal, com previsão de saldo e divisão de contas entre amigos.
            </p>
          </div>

          <ul className="space-y-6">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="border-border bg-muted text-muted-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-foreground text-sm font-medium">{title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-muted-foreground text-xs">FinanceBot — controle pessoal de gastos.</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        {/* The logo repeats here for the mobile layout, where the panel on
            the left is not rendered at all. */}
        <div className="w-full max-w-sm space-y-8">
          <div className="text-foreground flex items-center gap-2.5 text-[17px] font-semibold tracking-tight lg:hidden">
            <span className="bg-brand text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
              <Wallet2 className="h-[18px] w-[18px]" />
            </span>
            FinanceBot
          </div>
          {/* The same `surface` treatment every panel in the app uses, so the
              form reads as a card the product placed on the page rather than
              a bare form sitting on bare background. */}
          <div className="surface p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
