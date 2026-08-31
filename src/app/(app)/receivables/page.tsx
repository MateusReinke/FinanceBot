import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins } from "lucide-react";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { getReceivables } from "@/lib/queries/receivables";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";
import { ReceivableGroupCard } from "./receivable-group";
import { formatCurrency } from "@/lib/utils";

export const metadata: Metadata = { title: "A receber — FinanceBot" };

// "Quem me deve, quanto, desde quando, e como cobrar."
//
// Reads the same pending income rows the dashboard forecasts from, grouped
// by person — no separate ledger, so money someone owes you is already in
// the month's previsto and stops being a surprise when it doesn't arrive.
export default async function ReceivablesPage() {
  const { userId } = await verifySession();
  const [data, user] = await Promise.all([getReceivables(userId), getCurrentUser()]);

  return (
    // Capped and centred, unlike the rest of the app, which still runs the
    // full width of the window. This page is a list of one-line rows whose
    // two halves belong together — "Salário · 05 de set." on the left, and
    // "recebe em 5 dias · R$ 4.766,00 · Recebi" on the right. Left to fill a
    // 2560px monitor they end up ~1500px apart, with nothing in between, and
    // reading a row means crossing an empty canyon to find its own amount.
    // The cap is what keeps a row readable as one line.
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <PageHeader
        title="A receber"
        description="Tudo que ainda não caiu na conta, agrupado por quem deve. Cobre pelo WhatsApp em um clique e marque como recebido quando o dinheiro entrar."
      />

      {data.count === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <HandCoins className="text-muted-foreground h-9 w-9" />
          <p className="text-muted-foreground max-w-md text-sm">
            Nada a receber no momento. Quando alguém ficar te devendo, lance como uma receita
            marcada como{" "}
            <span className="text-foreground font-medium">&ldquo;ainda vou receber&rdquo;</span> e
            preencha o campo{" "}
            <span className="text-foreground font-medium">&ldquo;de quem&rdquo;</span> — ela aparece
            aqui com a data e um botão de cobrança.
          </p>
          <Link href="/transactions" className="text-primary text-sm font-medium hover:underline">
            Ir para Lançamentos →
          </Link>
        </div>
      ) : (
        <>
          {data.overdueCount > 0 ? (
            <Alert
              tone="danger"
              pulse
              title={`${data.overdueCount === 1 ? "1 cobrança atrasada" : `${data.overdueCount} cobranças atrasadas`} · ${formatCurrency(data.overdueTotal)}`}
            >
              Esse dinheiro já deveria ter entrado. Use o botão de cobrar para mandar a mensagem.
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Total a receber"
              value={formatCurrency(data.total)}
              valueClassName="text-success"
              // The figure above is what is still missing, so when part of it
              // has already come in the hint has to say so — otherwise the
              // page appears to have quietly lowered what someone owes.
              hint={[
                data.count === 1 ? "1 lançamento" : `${data.count} lançamentos`,
                data.receivedTotal > 0
                  ? `${formatCurrency(data.receivedTotal)} já recebido em partes`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <StatCard
              label="Em atraso"
              value={formatCurrency(data.overdueTotal)}
              valueClassName={data.overdueTotal > 0 ? "text-danger" : undefined}
              hint={
                data.overdueCount === 0
                  ? "Ninguém está atrasado"
                  : `${data.overdueCount} ${data.overdueCount === 1 ? "lançamento" : "lançamentos"}`
              }
            />
            <StatCard
              label="Pessoas"
              value={String(data.peopleCount)}
              // "0 · te devendo" read as a contradiction next to a page full
              // of open entries; with nobody named the honest line is that
              // none of them has an owner yet.
              hint={data.peopleCount === 0 ? "nenhum lançamento tem dono" : "te devendo"}
            />
          </div>

          <div className="space-y-4">
            {data.groups.map((group) => (
              <ReceivableGroupCard
                key={group.counterparty ?? "__sem_nome__"}
                group={group}
                senderName={user?.name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
