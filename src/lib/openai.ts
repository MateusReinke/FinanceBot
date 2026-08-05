import "server-only";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o";

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// OPENAI_MODEL is meant for OpenAI's own model IDs (e.g. "o4-mini"), but
// router/aggregator services (OpenRouter, aimlapi, ...) namespace theirs
// as "openai/o4-mini" — an easy value to paste in by mistake since this
// app calls api.openai.com directly, which doesn't understand that
// prefix and rejects it as an unrecognized model ID.
function resolveModel() {
  const raw = (process.env.OPENAI_MODEL || DEFAULT_MODEL).trim();
  return raw.replace(/^openai\//, "");
}

type MessageContent = string | Array<{ type: string; [key: string]: unknown }>;

// Shared by every OpenAI-backed feature in this app (receipt scanning,
// the transaction assistant, ...). Plain JSON mode, not Structured
// Outputs (response_format: json_schema) — json_schema's strict-
// conformance guarantee only applies to specific model snapshots, and
// guessing which ones are still current is exactly what broke twice
// already against a real deployment. json_object is the older, far more
// broadly supported mode; it only guarantees syntactically valid JSON,
// not any particular shape, so every caller here stays fully defensive
// about the parsed result to compensate.
async function callOpenAiJson(content: MessageContent, maxTokens: number): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada.");
  }

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: resolveModel(),
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      // Chat Completions renamed this from max_tokens after this codebase's
      // training cutoff — max_tokens is now rejected outright (confirmed
      // against a real deployment, not guessed).
      max_completion_tokens: maxTokens,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const responseContent = data?.choices?.[0]?.message?.content;
  if (typeof responseContent !== "string") {
    throw new Error("Resposta inesperada da OpenAI.");
  }

  try {
    return JSON.parse(responseContent);
  } catch {
    throw new Error("Não foi possível interpretar a resposta da OpenAI.");
  }
}

export type ExtractedReceiptItem = { description: string; amount: number };

const EXTRACTION_PROMPT =
  "Esta imagem é uma nota fiscal ou recibo brasileiro. Liste cada item, produto " +
  "ou serviço cobrado, com sua descrição e valor em reais (apenas o número, sem " +
  '"R$" e sem separador de milhar). Não inclua subtotal, taxa de serviço, ' +
  "gorjeta ou o total geral como itens à parte — a menos que a nota não tenha " +
  "nenhum item detalhado, e nesse caso liste o total como um único item. Se a " +
  "imagem não for uma nota/recibo legível, retorne uma lista vazia.\n\n" +
  "Responda apenas com um JSON no formato exato a seguir, sem nenhum texto " +
  "adicional antes ou depois:\n" +
  '{"items": [{"description": "string", "amount": number}, ...]}';

export async function extractReceiptItems(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedReceiptItem[]> {
  const parsed = await callOpenAiJson(
    [
      { type: "text", text: EXTRACTION_PROMPT },
      { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
    ],
    2000
  );

  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];

  return items
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      description: String(item.description ?? "").trim().slice(0, 120),
      amount: Math.round(Number(item.amount) * 100) / 100,
    }))
    .filter((item) => item.description.length > 0 && Number.isFinite(item.amount) && item.amount > 0);
}

export type ParsedTransactionCommand = {
  type: "expense" | "income";
  amount: number;
  description: string;
  date: string | null;
  accountName: string | null;
  categoryName: string | null;
};

// accountName/categoryName are names the model picks from the lists it's
// given, never ids — the caller resolves them against the user's actual
// rows itself (see src/app/actions/ai-assistant.ts), the same
// never-trust-ids-from-the-model boundary as the receipt flow's
// never-trust-the-exact-shape one.
export async function parseTransactionCommand(
  text: string,
  accounts: { name: string; type: string }[],
  categories: { name: string; type: string }[]
): Promise<ParsedTransactionCommand> {
  const today = new Date().toISOString().slice(0, 10);
  const accountList = accounts.length
    ? accounts.map((a) => `- ${a.name} (${a.type})`).join("\n")
    : "(nenhuma conta cadastrada)";
  const categoryList = categories.length
    ? categories.map((c) => `- ${c.name} (${c.type})`).join("\n")
    : "(nenhuma categoria cadastrada)";

  const prompt =
    "Você interpreta comandos em português sobre um lançamento financeiro pessoal " +
    "e devolve APENAS um JSON no formato exato a seguir, sem nenhum texto adicional " +
    "antes ou depois:\n" +
    '{"type": "expense" ou "income", "amount": number, "description": "string", ' +
    '"date": "YYYY-MM-DD" ou null, "accountName": "string" ou null, "categoryName": "string" ou null}\n\n' +
    `Hoje é ${today}.\n\n` +
    `Contas disponíveis:\n${accountList}\n\n` +
    `Categorias disponíveis:\n${categoryList}\n\n` +
    "Regras:\n" +
    '- "type": "expense" para gasto/compra/pagamento, "income" para recebimento/salário/venda.\n' +
    '- "amount": só o número, sem "R$" e sem separador de milhar.\n' +
    '- "accountName": deve bater EXATAMENTE com um nome da lista de contas acima, ou null se não tiver certeza.\n' +
    '- "categoryName": deve bater EXATAMENTE com um nome da lista de categorias acima (do tipo correspondente a ' +
    '"type"), ou null se não tiver certeza.\n' +
    '- "date": se o comando mencionar uma data relativa (ontem, anteontem, dia 5), calcule a partir de hoje; ' +
    "se não mencionar nada, retorne null.\n" +
    '- "description": uma descrição curta e natural do lançamento.\n\n' +
    `Comando do usuário: "${text}"`;

  const parsed = await callOpenAiJson(prompt, 500);
  const obj = (parsed as Record<string, unknown>) ?? {};

  const amount = Math.round(Number(obj.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Não consegui identificar um valor nesse comando.");
  }

  const date = typeof obj.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : null;

  return {
    type: obj.type === "income" ? "income" : "expense",
    amount,
    description: String(obj.description ?? "").trim().slice(0, 120) || "Lançamento via assistente",
    date,
    accountName: typeof obj.accountName === "string" ? obj.accountName : null,
    categoryName: typeof obj.categoryName === "string" ? obj.categoryName : null,
  };
}
