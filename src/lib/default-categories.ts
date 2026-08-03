export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Alimentação", color: "#f97316", icon: "utensils" },
  { name: "Moradia", color: "#8b5cf6", icon: "home" },
  { name: "Transporte", color: "#3b82f6", icon: "car" },
  { name: "Saúde", color: "#ef4444", icon: "heart-pulse" },
  { name: "Educação", color: "#06b6d4", icon: "graduation-cap" },
  { name: "Lazer", color: "#ec4899", icon: "party-popper" },
  { name: "Compras", color: "#eab308", icon: "shopping-bag" },
  { name: "Contas e Serviços", color: "#64748b", icon: "receipt" },
  { name: "Assinaturas", color: "#a855f7", icon: "repeat" },
  { name: "Outros", color: "#78716c", icon: "more-horizontal" },
] as const;

export const DEFAULT_INCOME_CATEGORIES = [
  { name: "Salário", color: "#22c55e", icon: "wallet" },
  { name: "Freelance", color: "#14b8a6", icon: "briefcase" },
  { name: "Investimentos", color: "#0ea5e9", icon: "trending-up" },
  { name: "Presente", color: "#f43f5e", icon: "gift" },
  { name: "Outros", color: "#78716c", icon: "more-horizontal" },
] as const;
