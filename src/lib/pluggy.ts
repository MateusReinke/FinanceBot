import "server-only";

const PLUGGY_API_URL = "https://api.pluggy.ai";

export function isPluggyConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID && process.env.PLUGGY_CLIENT_SECRET);
}

export function pluggyUseSandbox() {
  return process.env.PLUGGY_USE_SANDBOX !== "false";
}

type CachedApiKey = { key: string; expiresAt: number };
let cachedApiKey: CachedApiKey | null = null;

async function pluggyFetch<T>(path: string, init?: RequestInit & { apiKey?: string }): Promise<T> {
  const { apiKey, ...rest } = init ?? {};
  const res = await fetch(`${PLUGGY_API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-KEY": apiKey } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pluggy ${path} falhou (${res.status}): ${body.slice(0, 300)}`);
  }

  return res.json() as Promise<T>;
}

async function getApiKey(): Promise<string> {
  if (cachedApiKey && cachedApiKey.expiresAt > Date.now()) {
    return cachedApiKey.key;
  }

  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET não configurados.");
  }

  const { apiKey } = await pluggyFetch<{ apiKey: string }>("/auth", {
    method: "POST",
    body: JSON.stringify({ clientId, clientSecret }),
  });

  // Pluggy API keys are valid for 2h; refresh a few minutes early to be safe.
  cachedApiKey = { key: apiKey, expiresAt: Date.now() + 110 * 60 * 1000 };
  return apiKey;
}

// The URL Pluggy should call back. When the deployment authenticates the
// webhook by shared token instead of HMAC (see the webhook route), the
// token has to ride along in the query string — otherwise every delivery
// would be rejected.
function webhookUrl() {
  const base = process.env.PLUGGY_WEBHOOK_URL;
  if (!base) return undefined;
  const token = process.env.PLUGGY_WEBHOOK_TOKEN;
  if (!token || process.env.PLUGGY_WEBHOOK_SECRET) return base;
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createConnectToken(options?: { itemId?: string; clientUserId?: string }) {
  const apiKey = await getApiKey();
  const { accessToken } = await pluggyFetch<{ accessToken: string }>("/connect_token", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      ...(options?.itemId ? { itemId: options.itemId } : {}),
      ...(options?.clientUserId ? { clientUserId: options.clientUserId } : {}),
      ...(webhookUrl() ? { webhookUrl: webhookUrl() } : {}),
    }),
  });
  return accessToken;
}

export type PluggyConnector = {
  id: number;
  name: string;
  imageUrl?: string;
};

export type PluggyItemResponse = {
  id: string;
  status: string;
  executionStatus?: string;
  connector: PluggyConnector;
};

export async function getPluggyItem(pluggyItemId: string) {
  const apiKey = await getApiKey();
  return pluggyFetch<PluggyItemResponse>(`/items/${pluggyItemId}`, { apiKey });
}

export async function deletePluggyItem(pluggyItemId: string) {
  const apiKey = await getApiKey();
  await pluggyFetch(`/items/${pluggyItemId}`, { method: "DELETE", apiKey });
}

export type PluggyAccount = {
  id: string;
  itemId: string;
  type: string;
  subtype?: string;
  name: string;
  balance: number;
  currencyCode?: string;
};

export async function listPluggyAccounts(pluggyItemId: string) {
  const apiKey = await getApiKey();
  const { results } = await pluggyFetch<{ results: PluggyAccount[] }>(
    `/accounts?itemId=${encodeURIComponent(pluggyItemId)}`,
    { apiKey }
  );
  return results;
}

export type PluggyTransaction = {
  id: string;
  accountId: string;
  description: string;
  amount: number;
  date: string;
  category?: string;
  merchant?: { name?: string } | null;
};

const MAX_TRANSACTION_PAGES = 20;

export async function listPluggyTransactions(accountId: string, options?: { from?: string }) {
  const apiKey = await getApiKey();
  const all: PluggyTransaction[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_TRANSACTION_PAGES; page++) {
    const params = new URLSearchParams({ accountId });
    if (options?.from) params.set("from", options.from);
    if (cursor) params.set("after", cursor);

    const { results, next } = await pluggyFetch<{
      results: PluggyTransaction[];
      next: string | null;
    }>(`/v2/transactions?${params.toString()}`, { apiKey });
    all.push(...results);
    if (!next) break;
    cursor = next;
  }

  return all;
}
