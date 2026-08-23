import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import {
  isGoogleConfigured,
  googleRedirectUri,
  buildAuthUrl,
  LOGIN_SCOPES,
  CONTACTS_SCOPE,
} from "@/lib/google";
import { getSession } from "@/lib/session";

// Starts the Google flow. Two modes, same route:
//   (no query)        — sign in / sign up with Google.
//   ?scope=contacts   — ask an already-signed-in user for contacts access.
//
// The second is deliberately separate. Handing over an address book is not
// part of logging in, and Google's own incremental-consent model expects the
// extra scope to be requested when it is actually needed.
export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";
const VERIFIER_COOKIE = "google_oauth_verifier";
const MODE_COOKIE = "google_oauth_mode";
const NEXT_COOKIE = "google_oauth_next";

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(request: Request) {
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/login?error=google_indisponivel", request.url));
  }

  const url = new URL(request.url);
  const wantsContacts = url.searchParams.get("scope") === "contacts";
  const session = await getSession();

  // Asking for contacts only makes sense for someone already signed in —
  // there is no account to attach them to otherwise.
  if (wantsContacts && !session?.userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // PKCE: the verifier stays in an httpOnly cookie on this browser and only
  // its hash travels to Google, so an authorization code intercepted in the
  // redirect is useless without the cookie. state is the CSRF guard —
  // compared on the way back, so another site cannot walk a user through a
  // flow that ends up linking an account they did not choose.
  const state = base64url(randomBytes(32));
  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

  const redirectUri = googleRedirectUri(await headers());
  const authUrl = buildAuthUrl({
    redirectUri,
    state,
    codeChallenge,
    scopes: wantsContacts ? [...LOGIN_SCOPES, CONTACTS_SCOPE] : LOGIN_SCOPES,
    // Contacts needs a refresh token so a later re-import does not force the
    // user back through Google; plain sign-in has nothing to refresh.
    offline: wantsContacts,
  });

  const response = NextResponse.redirect(authUrl);
  // Short-lived and same-origin. `lax` rather than `strict` because the
  // browser arrives back here from accounts.google.com, and a strict cookie
  // would not be sent on that cross-site redirect — the flow would fail
  // every time with a state mismatch.
  const cookieOptions = {
    httpOnly: true,
    secure: new URL(redirectUri).protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };
  response.cookies.set(STATE_COOKIE, state, cookieOptions);
  response.cookies.set(VERIFIER_COOKIE, codeVerifier, cookieOptions);
  response.cookies.set(MODE_COOKIE, wantsContacts ? "contacts" : "login", cookieOptions);

  const next = url.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    response.cookies.set(NEXT_COOKIE, next, cookieOptions);
  }
  return response;
}
