import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  PiggyBank,
  Tags,
  Users,
  CalendarClock,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  // Null for the first group, which is a single entry and reads better
  // without a heading over it.
  label: string | null;
  items: NavItem[];
};

// Grouped by what the user is trying to do, not by what the data model
// calls things: recording what happened, planning what will happen, and
// the setup you touch once and forget. A flat list of eight items made
// "Categorias" look as important as "Transações".
export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Painel", icon: LayoutDashboard }],
  },
  {
    label: "Dia a dia",
    items: [
      { href: "/transactions", label: "Lançamentos", icon: ArrowLeftRight },
      { href: "/accounts", label: "Contas", icon: Landmark },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { href: "/financings", label: "Fixos e parcelados", icon: CalendarClock },
      { href: "/budgets", label: "Orçamentos", icon: PiggyBank },
    ],
  },
  {
    label: "Mais",
    items: [
      { href: "/events", label: "Dividir contas", icon: Users },
      { href: "/categories", label: "Categorias", icon: Tags },
      { href: "/settings", label: "Configurações", icon: Settings },
    ],
  },
];

// Kept as a flat list too — a few places just need "every nav destination".
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
