"use client";

import { useState } from "react";
import { Pencil, KeyRound, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { EditUserForm } from "./edit-user-form";
import { ResetPasswordForm } from "./reset-password-form";
import { DeleteUserForm } from "./delete-user-form";
import { formatDate, cn } from "@/lib/utils";

type AdminUser = { id: string; name: string; email: string; role: string; createdAt: Date };

function UserRow({ user, currentUserId }: { user: AdminUser; currentUserId: string }) {
  const [modal, setModal] = useState<"edit" | "reset" | "delete" | null>(null);
  const isSelf = user.id === currentUserId;

  return (
    <tr className="border-border border-b last:border-0">
      <td className="px-3 py-3">
        <p className="text-foreground text-sm font-medium">
          {user.name}
          {isSelf ? <span className="text-muted-foreground ml-1.5 text-xs">(você)</span> : null}
        </p>
        <p className="text-muted-foreground text-xs">{user.email}</p>
      </td>
      <td className="px-3 py-3">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            user.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          {user.role === "admin" ? "Administrador" : "Usuário"}
        </span>
      </td>
      <td className="text-muted-foreground px-3 py-3 text-sm">{formatDate(user.createdAt)}</td>
      <td className="px-3 py-3">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setModal("edit")}
            className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
            aria-label="Editar usuário"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setModal("reset")}
            className="text-muted-foreground hover:bg-muted cursor-pointer rounded-md p-1.5"
            aria-label="Redefinir senha"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          {!isSelf ? (
            <button
              onClick={() => setModal("delete")}
              className="text-muted-foreground hover:bg-danger-bg hover:text-danger cursor-pointer rounded-md p-1.5"
              aria-label="Excluir usuário"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </td>

      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Editar usuário">
        <EditUserForm
          id={user.id}
          name={user.name}
          email={user.email}
          role={user.role}
          isSelf={isSelf}
          onSuccess={() => setModal(null)}
        />
      </Modal>
      <Modal open={modal === "reset"} onClose={() => setModal(null)} title="Redefinir senha">
        <ResetPasswordForm id={user.id} name={user.name} onSuccess={() => setModal(null)} />
      </Modal>
      <Modal open={modal === "delete"} onClose={() => setModal(null)} title="Excluir usuário">
        <DeleteUserForm id={user.id} name={user.name} onSuccess={() => setModal(null)} />
      </Modal>
    </tr>
  );
}

export function UserTable({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  return (
    <div className="surface overflow-x-auto">
      <table className="w-full min-w-[520px] text-left">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-xs font-medium tracking-wide uppercase">
            <th className="px-3 py-3">Usuário</th>
            <th className="px-3 py-3">Papel</th>
            <th className="px-3 py-3">Criado em</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <UserRow key={u.id} user={u} currentUserId={currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
