import { Wallet2, PieChart, Landmark, ShieldCheck } from "lucide-react";

const FEATURES = [
  { icon: PieChart, text: "Painéis com gráficos de gastos por categoria" },
  { icon: Landmark, text: "Conecte suas contas com Open Finance" },
  { icon: ShieldCheck, text: "Seus dados protegidos com sessão segura" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 60%, white 0, transparent 35%)",
          }}
        />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <Wallet2 className="h-6 w-6" />
          FinanceBot
        </div>
        <div className="relative space-y-8">
          <h1 className="text-3xl font-bold leading-tight text-balance">
            Controle completo dos seus gastos, em um só lugar.
          </h1>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
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
