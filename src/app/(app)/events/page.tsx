import type { Metadata } from "next";
import Link from "next/link";
import { Users, ArrowRight } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { getUserEvents } from "@/lib/queries/events";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { CreateEventButton } from "./create-event-button";
import { isOutboundConfigured } from "@/lib/outbound";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Eventos — FinanceBot" };

export default async function EventsPage() {
  const { userId } = await verifySession();
  const events = await getUserEvents(userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Dividir contas"
          description="Divida contas com outras pessoas — só quem participa do evento vê os gastos dele."
        />
        <CreateEventButton whatsappEnabled={isOutboundConfigured()} />
      </div>

      {events.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <Users className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground max-w-sm text-sm">
            Crie um evento para dividir uma conta com amigos, ou entre em um pelo link de convite
            que alguém compartilhou com você.
          </p>
          <CreateEventButton whatsappEnabled={isOutboundConfigured()} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="group surface hover:border-primary flex flex-col gap-3 p-4 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-semibold">{event.name}</p>
                  {event.description ? (
                    <p className="text-muted-foreground truncate text-xs">{event.description}</p>
                  ) : null}
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>

              <div className="text-muted-foreground flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {event.participantCount}{" "}
                  {event.participantCount === 1 ? "participante" : "participantes"}
                </span>
                <span>
                  {event.expenseCount} {event.expenseCount === 1 ? "despesa" : "despesas"}
                </span>
              </div>

              <div className="border-border mt-1 flex items-center justify-between border-t pt-3">
                <span className="text-muted-foreground text-xs">
                  Atualizado {formatDate(event.updatedAt)}
                </span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    event.myBalance > 0.005
                      ? "text-success"
                      : event.myBalance < -0.005
                        ? "text-danger"
                        : "text-muted-foreground"
                  )}
                >
                  {event.myBalance > 0.005
                    ? `+${formatCurrency(event.myBalance)}`
                    : event.myBalance < -0.005
                      ? formatCurrency(event.myBalance)
                      : "Quitado"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
