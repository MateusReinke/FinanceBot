import { Landmark, PiggyBank, CreditCard, Wallet, TrendingUp, type LucideIcon } from "lucide-react";

export const ACCOUNT_TYPES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "checking", label: "Conta corrente", icon: Landmark },
  { value: "savings", label: "Poupança", icon: PiggyBank },
  { value: "credit_card", label: "Cartão de crédito", icon: CreditCard },
  { value: "cash", label: "Dinheiro", icon: Wallet },
  { value: "investment", label: "Investimentos", icon: TrendingUp },
];

export const ACCOUNT_TYPE_VALUES = ACCOUNT_TYPES.map((t) => t.value) as [string, ...string[]];

export function getAccountTypeMeta(type: string) {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[0];
}
