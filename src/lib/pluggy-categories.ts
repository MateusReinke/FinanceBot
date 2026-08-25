// Maps Pluggy's own category strings onto the default categories this app
// creates for every new user (see src/lib/default-categories.ts). Without
// this, every imported transaction lands with no category and the whole
// dashboard breakdown stays empty until the user files hundreds of rows by
// hand.
//
// Matching is by substring on a normalized (accent-free, lowercase) string,
// because Pluggy returns both Portuguese and English labels depending on
// the connector, and the exact set changes over time. An unmatched category
// simply stays null — a wrong guess is worse than no guess.
const RULES: { match: string[]; category: string }[] = [
  {
    match: ["supermarket", "supermercado", "groceries", "alimentacao", "food"],
    category: "Alimentação",
  },
  { match: ["restaurant", "restaurante", "delivery", "bar", "cafe"], category: "Alimentação" },
  {
    match: ["transport", "transporte", "uber", "taxi", "fuel", "combustivel", "gas station"],
    category: "Transporte",
  },
  { match: ["health", "saude", "pharmacy", "farmacia", "medic"], category: "Saúde" },
  { match: ["education", "educacao", "school", "escola", "curso"], category: "Educação" },
  { match: ["streaming"], category: "Assinaturas" },
  { match: ["entertainment", "lazer", "cinema", "games", "travel", "viagem"], category: "Lazer" },
  { match: ["housing", "moradia", "rent", "aluguel"], category: "Moradia" },
  {
    match: [
      "utilities",
      "electricity",
      "energia",
      "water",
      "agua",
      "internet",
      "telefone",
      "phone",
    ],
    category: "Contas e Serviços",
  },
  { match: ["subscription", "assinatura"], category: "Assinaturas" },
  { match: ["shopping", "compras", "clothing", "vestuario", "electronics"], category: "Compras" },
  { match: ["salary", "salario", "payroll"], category: "Salário" },
  { match: ["investment", "investimento", "dividend", "rendimento"], category: "Investimentos" },
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Returns the name of the local category a Pluggy category should map to,
// or null when nothing matches confidently.
export function mapPluggyCategory(pluggyCategory: string | null | undefined): string | null {
  if (!pluggyCategory) return null;
  const value = normalize(pluggyCategory);
  for (const rule of RULES) {
    if (rule.match.some((needle) => value.includes(needle))) return rule.category;
  }
  return null;
}
