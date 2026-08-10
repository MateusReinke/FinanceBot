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
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
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
      <div className="flex items-start gap-2 rounded-xl border border-danger bg-danger-bg p-3 text-sm text-danger">
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
    <div className="space-y-2 rounded-xl border border-success bg-success-bg p-3 text-sm text-success">
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
