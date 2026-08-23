import { Wallet2, PieChart, Landmark, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: PieChart, text: "Painéis com gráficos de gastos por categoria" },
  { icon: Landmark, text: "Conecte suas contas com Open Finance" },
  { icon: ShieldCheck, text: "Seus dados protegidos com sessão segura" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* The marketing half runs the same aurora as the app, but at full
          strength on a dark ground — it is the first thing anyone sees, and
          the one screen that can afford to be purely atmospheric. */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0b0f20] p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(42rem 32rem at 12% -8%, rgb(99 102 241 / 0.55), transparent 62%), radial-gradient(34rem 28rem at 96% 14%, rgb(168 85 247 / 0.45), transparent 60%), radial-gradient(40rem 32rem at 8% 88%, rgb(45 212 191 / 0.30), transparent 62%), radial-gradient(34rem 26rem at 92% 78%, rgb(129 140 248 / 0.32), transparent 60%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 100% 70% at 50% 0%, #000 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 100% 70% at 50% 0%, #000 30%, transparent 100%)",
          }}
        />
        <div className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl shadow-brand">
            <Wallet2 className="h-5 w-5" />
          </span>
          FinanceBot
        </div>
        <div className="relative space-y-8">
          <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-balance">
            Controle completo dos seus gastos, em um só lugar.
          </h1>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">
          Controle pessoal de gastos com integração a Open Finance.
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
