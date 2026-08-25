import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  isGoogleConfigured,
  googleRedirectUri,
  exchangeCode,
  verifyIdToken,
  CONTACTS_SCOPE,
} from "@/lib/google";
import { getSession, createSession } from "@/lib/session";
import { createUserWithDefaultCategories } from "@/lib/user-provisioning";
import { isAdminEmail } from "@/lib/admin";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";
const VERIFIER_COOKIE = "google_oauth_verifier";
const MODE_COOKIE = "google_oauth_mode";
const NEXT_COOKIE = "google_oauth_next";

function clearFlowCookies(response: NextResponse) {
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE, MODE_COOKIE, NEXT_COOKIE]) {
    response.cookies.delete(name);
  }
  return response;
}

function fail(request: Request, where: string, reason: string) {
  return clearFlowCookies(
    NextResponse.redirect(new URL(`${where}?error=${encodeURIComponent(reason)}`, request.url))
  );
}

export async function GET(request: Request) {
  if (!isGoogleConfigured()) return fail(request, "/login", "google_indisponivel");

  const url = new URL(request.url);
  const cookieStore = await cookies();
  const mode = cookieStore.get(MODE_COOKIE)?.value === "contacts" ? "contacts" : "login";
  const landing = mode === "contacts" ? "/settings" : "/login";

  // The user pressed "cancelar" on Google's screen, or Google refused.
  const oauthError = url.searchParams.get("error");
  if (oauthError) return fail(request, landing, "google_cancelado");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;

  // Every one of these missing means this request did not come from a flow
  // this browser started. Nothing is written before they check out.
  if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
    return fail(request, landing, "google_estado_invalido");
  }

  let tokens;
  let identity;
  try {
    tokens = await exchangeCode(code, googleRedirectUri(await headers()), codeVerifier);
    if (!tokens.idToken) throw new Error("Sem id_token na resposta do Google");
    identity = await verifyIdToken(tokens.idToken);
  } catch (error) {
    console.error("Falha no login com Google", error);
    return fail(request, landing, "google_falhou");
  }

  // An unverified address must never be able to claim an existing account:
  // that is the whole attack, and Google is explicit that email_verified is
  // the flag to gate on.
  if (!identity.emailVerified) {
    return fail(request, landing, "google_email_nao_verificado");
  }

  const grantedContacts = tokens.scope.split(" ").includes(CONTACTS_SCOPE);
  const session = await getSession();

  // Match on Google's stable subject first, then fall back to the verified
  // email — which is what links a Google sign-in to an account that already
  // exists from an email/senha signup, instead of colliding on the unique
  // email or silently creating a second account.
  const byGoogleId = await prisma.googleAccount.findUnique({
    where: { googleId: identity.googleId },
  });
  const existingUser =
    (byGoogleId && (await prisma.user.findUnique({ where: { id: byGoogleId.userId } }))) ||
    (session?.userId ? await prisma.user.findUnique({ where: { id: session.userId } }) : null) ||
    (await prisma.user.findUnique({ where: { email: identity.email } }));

  // Linking a Google account that already belongs to somebody else would
  // hand one person's data to another. Refuse rather than reassign.
  if (byGoogleId && existingUser && byGoogleId.userId !== existingUser.id) {
    return fail(request, landing, "google_ja_vinculado");
  }

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    if (isAdminEmail(existingUser.email) && existingUser.role !== "admin") {
      await prisma.user.update({ where: { id: userId }, data: { role: "admin" } });
    }
  } else {
    // Signing in with Google for the first time creates the account. No
    // password is set — passwordHash stays null, and Configurações is where
    // one can be added later.
    //
    // phoneNumber stays null too: Google does not hand over a phone number,
    // and the app asks for it in Configurações, where the WhatsApp features
    // that need it live.
    const created = await createUserWithDefaultCategories({
      name: identity.name ?? identity.email.split("@")[0],
      email: identity.email,
      passwordHash: null,
      role: isAdminEmail(identity.email) ? "admin" : "user",
    });
    userId = created.id;
  }

  const linkData = {
    googleId: identity.googleId,
    email: identity.email,
    pictureUrl: identity.picture,
    accessToken: tokens.accessToken,
    accessExpiresAt: tokens.expiresAt,
    grantedScopes: tokens.scope,
  };

  await prisma.googleAccount.upsert({
    where: { userId },
    create: {
      userId,
      ...linkData,
      refreshToken: tokens.refreshToken,
    },
    update: {
      ...linkData,
      // Google only returns a refresh token on a forced-consent screen, so a
      // plain sign-in later would otherwise wipe the one that lets contacts
      // re-import without sending the user back through Google.
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
    },
  });

  await createSession(userId);

  const next = cookieStore.get(NEXT_COOKIE)?.value;
  const destination =
    mode === "contacts"
      ? grantedContacts
        ? "/settings?google=contatos_conectados"
        : "/settings?error=google_sem_permissao_contatos"
      : next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";

  return clearFlowCookies(NextResponse.redirect(new URL(destination, request.url)));
}
