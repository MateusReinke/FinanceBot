import type { Metadata } from "next";
import { ArrowLeftRight } from "lucide-react";
import { verifyEventAccess } from "@/lib/events-dal";
import { getEventDetail } from "@/lib/queries/events";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EventHeader } from "./event-header";
import { AddExpenseButton } from "./add-expense-button";
import { ExpenseRow } from "./expense-row";
import { BalancePanel } from "./balance-panel";
import { ParticipantsPanel } from "./participants-panel";
import { InvitePanel } from "./invite-panel";

export const metadata: Metadata = { title: "Evento — FinanceBot" };

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await verifyEventAccess(id);
  const { event, balanceRows } = await getEventDetail(id);

  const canDelete = !event.createdById || event.createdById === userId;

  return (
    <div className="space-y-6">
      <EventHeader
        eventId={event.id}
        name={event.name}
        description={event.description}
        canDelete={canDelete}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Despesas</CardTitle>
              <AddExpenseButton
                eventId={event.id}
                participants={event.participants}
                currentUserId={userId}
              />
            </CardHeader>
            <CardContent>
              {event.expenses.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Nenhuma despesa registrada ainda.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {event.expenses.map((expense) => (
                    <ExpenseRow
                      key={expense.id}
                      eventId={event.id}
                      expense={expense}
                      currentUserId={userId}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saldos</CardTitle>
            </CardHeader>
            <CardContent>
              <BalancePanel balanceRows={balanceRows} currentUserId={userId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Participantes</CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipantsPanel
                participants={event.participants}
                currentUserId={userId}
                createdById={event.createdById}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Convidar</CardTitle>
            </CardHeader>
            <CardContent>
              <InvitePanel eventId={event.id} invites={event.invites} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
