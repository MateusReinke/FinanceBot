import { MessageCircle, Loader2, AlertTriangle } from "lucide-react";

// Status of the event's WhatsApp group. The app only ever asks for one and
// records the answer — the automation is what actually creates it — so this
// panel is careful to say "pedimos" rather than promise a group exists.
export function WhatsAppGroupPanel({
  status,
  groupId,
  membersWithoutPhone,
}: {
  status: string;
  groupId: string | null;
  membersWithoutPhone: string[];
}) {
  if (status === "none") return null;

  if (status === "pending") {
    return (
      <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-xl border p-3 text-sm">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Grupo do WhatsApp solicitado. Assim que a automação criar, ele aparece aqui — e todo mundo
          que entrar no evento passa a ser adicionado.
        </p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="border-danger bg-danger-bg text-danger flex items-start gap-2 rounded-xl border p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          A automação não conseguiu criar o grupo. Isso costuma ser um participante cuja
          configuração de privacidade não permite ser adicionado a grupos — nesse caso, mande o
          convite do grupo para essa pessoa manualmente.
        </p>
      </div>
    );
  }

  return (
    <div className="border-success bg-success-bg text-success space-y-2 rounded-xl border p-3 text-sm">
      <p className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 shrink-0" />
        Grupo do WhatsApp ativo — cada despesa nova é avisada lá.
      </p>
      {groupId ? <p className="text-xs opacity-80">ID do grupo: {groupId}</p> : null}
      {membersWithoutPhone.length > 0 ? (
        <p className="text-xs opacity-80">
          Sem WhatsApp cadastrado, então fora do grupo: {membersWithoutPhone.join(", ")}
        </p>
      ) : null}
    </div>
  );
}
