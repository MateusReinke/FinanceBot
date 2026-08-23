import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Bearer tokens for the public API — how an automation (the n8n WhatsApp
// agent) acts for one user without holding their password or a session
// cookie.
//
// Design rules, all of them deliberate:
//  - The token is scoped to ONE user. There is no service-wide token that
//    can post as anybody, so a leaked token costs exactly one account.
//  - Only the SHA-256 hash is stored, like a password. A database dump
//    does not yield working tokens.
//  - Hash lookup is a single indexed read. Because the stored value is a
//    hash of a high-entropy secret (not a low-entropy password), a plain
//    equality lookup is safe here — there is nothing to guess offline —
//    and the constant-time compare below still guards the final check.

const TOKEN_PREFIX = "fbot_";

export function generateApiToken() {
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;
  return { token, tokenHash: hashToken(token), prefix: token.slice(0, 12) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type ApiAuthResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; response: NextResponse };

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

// Resolves `Authorization: Bearer <token>` to a user. Returns a ready-made
// response on failure so every route rejects identically — an automation
// debugging its own setup should not be able to tell "no such token" from
// "revoked token".
export async function authenticateApiRequest(request: Request): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) {
    return { ok: false, response: unauthorized("Envie o token em Authorization: Bearer <token>.") };
  }

  const record = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(value) },
    select: { id: true, userId: true, tokenHash: true, revokedAt: true },
  });
  if (!record || record.revokedAt || !safeEqual(record.tokenHash, hashToken(value))) {
    return { ok: false, response: unauthorized("Token inválido ou revogado.") };
  }

  // Best-effort: a failed touch must never fail an otherwise valid request.
  prisma.apiToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ok: true, userId: record.userId, tokenId: record.id };
}

// Small in-process limiter. Enough to stop a runaway n8n loop from burning
// the OpenAI budget or hammering the database; it is per-instance, not
// cluster-wide, which is the right trade for a self-hosted app of this size.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string): { ok: true } | { ok: false; response: NextResponse } {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic cleanup so the map can't grow without bound.
    if (hits.size > 1000) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    return { ok: true };
  }

  entry.count += 1;
  if (entry.count > MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Muitas requisições. Tente de novo em instantes." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      ),
    };
  }
  return { ok: true };
}
