import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

// Transaction dates are calendar dates with no meaningful time-of-day, so every
// formatter/boundary below pins to UTC. That keeps "2026-08-03" rendering as
// Aug 3 everywhere, regardless of the server or browser's local timezone.
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(date: Date | string) {
  return dateFormatter.format(new Date(date));
}

const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatMonthYear(month: number, year: number) {
  const label = monthYearFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function toDateInputValue(date: Date | string) {
  return new Date(date).toISOString().slice(0, 10);
}

export function monthRangeUTC(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

export function getCurrentMonthYear() {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

// Adds calendar months the way a billing schedule expects: lands on the 1st
// of the target month first, then clamps the day back to that month's real
// last day. Plain `setUTCMonth` arithmetic would roll Jan 31 + 1 month into
// Mar 3 instead of Feb 28 — this avoids that.
export function addMonthsUTC(date: Date, months: number) {
  const day = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, lastDayOfTarget));
  return firstOfTarget;
}

// Installments always land on the same day-of-month as `start` (see
// addMonthsUTC above), so an "end date" the user picks is really just
// pointing at a target month — the day-of-month component is ignored on
// purpose rather than trying to reconcile it against the schedule's own.
export function monthsBetweenUTC(start: Date, end: Date) {
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1;
  return Math.max(1, months);
}

const monthShortFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: "UTC",
});

export function formatMonthShort(month: number, year: number) {
  const label = monthShortFormatter.format(new Date(Date.UTC(year, month - 1, 1)));
  return label.replace(".", "").charAt(0).toUpperCase() + label.replace(".", "").slice(1);
}

export function formatCompactCurrency(value: number) {
  if (Math.abs(value) < 1000) return formatCurrency(value);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
