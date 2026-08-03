export const PLUGGY_STATUS_LABELS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  UPDATED: { label: "Atualizado", tone: "success" },
  UPDATING: { label: "Atualizando...", tone: "warning" },
  LOGIN_ERROR: { label: "Requer nova autenticação", tone: "danger" },
  OUTDATED: { label: "Desatualizado", tone: "warning" },
  WAITING_USER_INPUT: { label: "Aguardando confirmação", tone: "warning" },
  ERROR: { label: "Erro na sincronização", tone: "danger" },
};

export function getPluggyStatusMeta(status: string) {
  return PLUGGY_STATUS_LABELS[status] ?? { label: status, tone: "warning" as const };
}

export const NEEDS_RECONNECT_STATUSES = new Set(["LOGIN_ERROR", "WAITING_USER_INPUT"]);
