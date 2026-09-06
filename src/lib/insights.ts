import { formatCurrency } from "@/lib/utils";
import { startOfTodayUTC } from "@/lib/transaction-status";

// Turns the numbers the dashboard already computed into sentences. Every
// figure here is read from getDashboardData/getCashflowSeries, never
// recomputed — an insight can never say something the stat cards and
// charts above it disagree with.
//
// Deliberately conservative: an insight only appears when it clears a
// "worth saying" bar (a real percentage, not noise from a single small
// number), so this never turns into a wall of trivia nobody reads.

export type InsightTone = "success" | "info" | "warning" | "danger";

export type Insight = {
  id: string;
  tone: InsightTone;
  text: string;
};

// How far outside "the recent average" a month has to be before it's worth
// calling out. Below this, day-to-day variance alone explains the gap.
const PACE_SIGNIFICANT_PERCENT = 20;

function round0(value: number) {
  return Math.round(value);
}

export function computeInsights(
  input: {
    income: number;
    expense: number;
    net: number;
    expenseBreakdown: { name: string; amount: number }[];
    // Only offset and expenseRealized are read — CashflowPoint satisfies
    // this structurally, so callers can pass it straight through.
    cashflow: { offset: number; expenseRealized: number }[];
    month: number;
    year: number;
    isCurrentMonth: boolean;
  },
  today = startOfTodayUTC()
): Insight[] {
  const insights: Insight[] = [];

  // 1. Savings rate — the single number that answers "how am I doing",
  // ahead of the category and pace detail below.
  if (input.income > 0) {
    const rate = (input.net / input.income) * 100;
    if (rate >= 20) {
      insights.push({
        id: "savings-good",
        tone: "success",
        text: `Você guardou ${round0(rate)}% da sua renda neste mês — acima dos 20% recomendados.`,
      });
    } else if (rate >= 0) {
      insights.push({
        id: "savings-ok",
        tone: "info",
        text: `Você guardou ${round0(rate)}% da sua renda neste mês.`,
      });
    } else {
      insights.push({
        id: "savings-negative",
        tone: "danger",
        text: `Você gastou ${formatCurrency(Math.abs(input.net))} a mais do que ganhou neste mês.`,
      });
    }
  } else if (input.expense > 0) {
    insights.push({
      id: "no-income",
      tone: "warning",
      text: `Nenhuma entrada registrada neste mês, mas ${formatCurrency(input.expense)} já saíram.`,
    });
  }

  // 2. Biggest category — where the money in that total actually went.
  if (input.expense > 0 && input.expenseBreakdown.length > 0) {
    const top = input.expenseBreakdown[0];
    const share = (top.amount / input.expense) * 100;
    insights.push({
      id: "top-category",
      tone: share >= 50 ? "warning" : "info",
      text: `${top.name} é sua maior despesa: ${formatCurrency(top.amount)} (${round0(share)}% do total gasto).`,
    });
  }

  // 3. Pace vs. the recent average — only meaningful for the month still in
  // progress; a closed month has nothing left to project. Needs three full
  // preceding months of real activity, or a quiet month early in the
  // account's life would look like a huge overspend against a near-zero
  // average.
  if (input.isCurrentMonth) {
    const recent = input.cashflow.filter((p) => p.offset >= -3 && p.offset <= -1);
    const hasFullHistory = recent.length === 3 && recent.every((p) => p.expenseRealized > 0);
    if (hasFullHistory) {
      const avg = recent.reduce((sum, p) => sum + p.expenseRealized, 0) / recent.length;
      const daysInMonth = new Date(Date.UTC(input.year, input.month, 0)).getUTCDate();
      const daysElapsed = Math.min(today.getUTCDate(), daysInMonth);
      const expectedSoFar = avg * (daysElapsed / daysInMonth);
      if (expectedSoFar > 0) {
        const diffPercent = ((input.expense - expectedSoFar) / expectedSoFar) * 100;
        if (diffPercent >= PACE_SIGNIFICANT_PERCENT) {
          insights.push({
            id: "pace-high",
            tone: "warning",
            text: `Já gastou ${formatCurrency(input.expense)} até o dia ${daysElapsed} — ${round0(diffPercent)}% acima do ritmo dos últimos meses.`,
          });
        } else if (diffPercent <= -PACE_SIGNIFICANT_PERCENT) {
          insights.push({
            id: "pace-low",
            tone: "success",
            text: `Está ${round0(Math.abs(diffPercent))}% abaixo do ritmo normal de gastos para essa altura do mês.`,
          });
        }
      }
    }
  }

  return insights;
}
