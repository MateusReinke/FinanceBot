import { displayName } from "@/lib/display-name";

type Participant = { userId: string; user: { id: string; name: string; email: string } };

export function ParticipantsPanel({
  participants,
  currentUserId,
  createdById,
}: {
  participants: Participant[];
  currentUserId: string;
  createdById: string | null;
}) {
  return (
    <ul className="space-y-2">
      {participants.map((p) => {
        const initials = p.user.name
          .split(" ")
          .map((part) => part[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();
        return (
          <li key={p.userId} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName(p.user, currentUserId)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{p.user.email}</p>
            </div>
            {p.userId === createdById ? (
              <span className="shrink-0 text-xs text-muted-foreground">Criador</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
