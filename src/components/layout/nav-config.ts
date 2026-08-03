import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  PiggyBank,
  Tags,
  Users,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/accounts", label: "Contas", icon: Landmark },
  { href: "/budgets", label: "Orçamentos", icon: PiggyBank },
  { href: "/categories", label: "Categorias", icon: Tags },
  { href: "/events", label: "Eventos", icon: Users },
  { href: "/settings", label: "Configurações", icon: Settings },
];
