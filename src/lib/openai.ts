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

export type ExtractedReceiptItem = { description: string; amount: number };

// Plain JSON mode, not Structured Outputs (response_format: json_schema) —
// json_schema's strict-conformance guarantee only applies to specific
// model snapshots, and guessing which ones are still current is exactly
// what broke twice already. json_object is the older, far more broadly
// supported mode; it only guarantees syntactically valid JSON, not this
// exact shape, so the parsing below stays fully defensive (never trusts
// the shape blindly) to compensate.
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
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      // Chat Completions renamed this from max_tokens after this codebase's
      // training cutoff — max_tokens is now rejected outright (confirmed
      // against a real deployment, not guessed).
      max_completion_tokens: 2000,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Resposta inesperada da OpenAI.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Não foi possível interpretar a resposta da OpenAI.");
  }

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
