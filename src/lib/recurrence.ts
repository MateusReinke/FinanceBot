import { addDaysUTC, addMonthsUTC } from "@/lib/utils";

// How often a Financing / gasto fixo repeats. Stored as a plain string on
// Financing.frequency, consistent with every other enum-like field in this
// schema. "monthly" is the default and the only value rows created before
// this existed can have, so nothing about them changes.
export const FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
] as const;

export type Frequency = (typeof FREQUENCIES)[number];

export const DEFAULT_FREQUENCY: Frequency = "monthly";

export function isFrequency(value: unknown): value is Frequency {
  return typeof value === "string" && (FREQUENCIES as readonly string[]).includes(value);
}

export function toFrequency(value: unknown): Frequency {
  return isFrequency(value) ? value : DEFAULT_FREQUENCY;
}

// Shown in the "Repete a cada" picker — deliberately spelled out in plain
// words instead of jargon ("bimestral", "periodicidade"), since the whole
// point is that someone cadastrando o aluguel não precise pensar.
export const FREQUENCY_OPTION_LABEL: Record<Frequency, string> = {
  weekly: "Toda semana",
  biweekly: "A cada 15 dias (quinzenal)",
  monthly: "Todo mês",
  quarterly: "A cada 3 meses",
  semiannual: "A cada 6 meses",
  annual: "Uma vez por ano",
};

// Short form used on cards and summaries, where the row already says what
// it is ("Todo mês · R$ 1.200").
export const FREQUENCY_SHORT_LABEL: Record<Frequency, string> = {
  weekly: "Toda semana",
  biweekly: "A cada 15 dias",
  monthly: "Todo mês",
  quarterly: "A cada 3 meses",
  semiannual: "A cada 6 meses",
  annual: "Todo ano",
};

// Label for one occurrence's amount ("Valor por mês", "Valor por semana").
export const FREQUENCY_AMOUNT_LABEL: Record<Frequency, string> = {
  weekly: "Valor por semana",
  biweekly: "Valor por quinzena",
  monthly: "Valor por mês",
  quarterly: "Valor por trimestre",
  semiannual: "Valor por semestre",
  annual: "Valor por ano",
};

const MONTH_STEP: Partial<Record<Frequency, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

const DAY_STEP: Partial<Record<Frequency, number>> = {
  weekly: 7,
  biweekly: 15,
};

// The n-th occurrence after `date`. Month-based frequencies go through
// addMonthsUTC so they keep the same day-of-month (clamped on short
// months); day-based ones are plain day arithmetic, so "a cada 15 dias"
// really means every 15 days and not "twice a month".
export function addIntervalUTC(date: Date, frequency: Frequency, n: number) {
  const months = MONTH_STEP[frequency];
  if (months !== undefined) return addMonthsUTC(date, months * n);
  return addDaysUTC(date, (DAY_STEP[frequency] ?? 0) * n);
}

// Hard ceiling on how many installment rows one Financing may create —
// every occurrence is a real Transaction row, so this bounds both the
// write and every later query over them.
export const MAX_INSTALLMENTS = 600;

// How far ahead an open-ended gasto fixo is materialized. A rolling window,
// not a lifetime: the schedule is topped back up to this horizon on every
// request (see extendRecurringSchedules), so it stays open-ended without
// writing decades of rows nobody asked to see.
//
// The first cut of this generated ~30 years per entry, which meant a
// handful of fixed expenses produced over a thousand transactions running
// out to 2056 — every list, count and export had to wade through them.
export const RECURRING_HORIZON_MONTHS = 24;

// Occurrences needed to cover the horizon at each frequency, with a little
// slack so the extender has nothing to do right after creation.
const RECURRING_COUNT: Record<Frequency, number> = {
  weekly: 110,
  biweekly: 52,
  monthly: 24,
  quarterly: 8,
  semiannual: 4,
  annual: 2,
};

export function recurringOccurrenceCount(frequency: Frequency) {
  return RECURRING_COUNT[frequency];
}

// The far edge of the rolling window, as a UTC calendar date.
export function recurringHorizon(from = new Date()) {
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + RECURRING_HORIZON_MONTHS,
      from.getUTCDate()
    )
  );
}

// How many occurrences fit between the first due date and an end date the
// user picked, inclusive. Always at least 1 — an end date before the first
// payment just means a single charge, never zero.
export function occurrencesBetweenUTC(start: Date, end: Date, frequency: Frequency) {
  let count = 1;
  while (count < MAX_INSTALLMENTS && addIntervalUTC(start, frequency, count) <= end) {
    count += 1;
  }
  return count;
}
