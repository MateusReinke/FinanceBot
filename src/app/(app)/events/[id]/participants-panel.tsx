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
            <span className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {displayName(p.user, currentUserId)}
              </p>
              <p className="text-muted-foreground truncate text-xs">{p.user.email}</p>
            </div>
            {p.userId === createdById ? (
              <span className="text-muted-foreground shrink-0 text-xs">Criador</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
