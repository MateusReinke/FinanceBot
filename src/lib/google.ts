import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

// Google Sign-In and the People API, behind the same "configure it or it
// disappears" switch as Pluggy and OpenAI: with no client id/secret set, the
// button never renders and every route here refuses politely.
//
// Written against Google's endpoints directly rather than pulling in
// googleapis (a ~50MB dependency for two HTTP calls). jose is already here
// for the app's own sessions and is what verifies Google's ID token.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PEOPLE_ENDPOINT = "https://people.googleapis.com/v1/people/me/connections";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Identity only. Contacts is requested separately, when the user asks to
// import them — see CONTACTS_SCOPE. Signing in should not hand over an
// address book, and Google shows the two consent screens differently.
export const LOGIN_SCOPES = ["openid", "email", "profile"];

// A Google *restricted* scope: usable immediately for accounts listed as
// test users on the OAuth consent screen, but a published app needs
// Google's verification (and a CASA security assessment) before anyone else
// can grant it. See the README — this is a process, not a code change.
export const CONTACTS_SCOPE = "https://www.googleapis.com/auth/contacts.readonly";

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clientId() {
  const value = process.env.GOOGLE_CLIENT_ID;
  if (!value) throw new Error("GOOGLE_CLIENT_ID não configurado");
  return value;
}

function clientSecret() {
  const value = process.env.GOOGLE_CLIENT_SECRET;
  if (!value) throw new Error("GOOGLE_CLIENT_SECRET não configurado");
  return value;
}

// The redirect URI has to match what is registered in the Google console
// byte for byte. Explicit env wins; otherwise it is derived from the request
// the same way the session cookie decides on Secure — behind Coolify's proxy
// the container only ever sees plain HTTP, so X-Forwarded-* is the only
// honest source for the browser-facing origin.
export function googleRedirectUri(requestHeaders: Headers) {
  const configured = process.env.GOOGLE_REDIRECT_URI;
  if (configured) return configured;

  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  return `${proto}://${host}/api/auth/google/callback`;
}

export function buildAuthUrl(options: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes: string[];
  // Set when the user is adding contacts access to an account that is
  // already linked, so Google shows the incremental-consent screen with the
  // permissions they already granted preserved.
  loginHint?: string;
  // Contacts needs a refresh token, which Google only issues with these two
  // together — and only on a consent screen the user actually sees.
  offline?: boolean;
}) {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: options.scopes.join(" "),
    state: options.state,
    code_challenge: options.codeChallenge,
    code_challenge_method: "S256",
    include_granted_scopes: "true",
  });
  if (options.loginHint) params.set("login_hint", options.loginHint);
  if (options.offline) {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  expiresAt: Date;
  scope: string;
};

function tokensFrom(json: Record<string, unknown>): GoogleTokens {
  const expiresIn = typeof json.expires_in === "number" ? json.expires_in : 3600;
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : null,
    idToken: typeof json.id_token === "string" ? json.id_token : null,
    // 30s of slack so a token that is about to expire is treated as expired
    // rather than sent on a request that will 401 mid-import.
    expiresAt: new Date(Date.now() + (expiresIn - 30) * 1000),
    scope: typeof json.scope === "string" ? json.scope : "",
  };
}

export async function exchangeCode(code: string, redirectUri: string, codeVerifier: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Troca de código com o Google falhou (${response.status}): ${await response.text()}`
    );
  }
  return tokensFrom(await response.json());
}

export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Renovação do token do Google falhou (${response.status})`);
  }
  return tokensFrom(await response.json());
}

// Cached across requests by jose itself, so this is one network call per key
// rotation rather than one per login.
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

// Verifies the ID token's signature, issuer and audience before a single
// claim inside it is believed. The token arrives over the back channel from
// Google's own token endpoint, but verifying is what makes "this is the
// account that just signed in" a fact rather than an assumption — and the
// email claim decides which FinanceBot account gets linked.
export async function verifyIdToken(idToken: string): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ISSUERS,
    audience: clientId(),
  });

  const googleId = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!googleId || !email) {
    throw new Error("O Google não devolveu identificador e e-mail.");
  }

  return {
    googleId,
    email,
    // Google sends this as a boolean or the string "true" depending on the
    // flow. Anything else counts as unverified, which is what stops an
    // unverified address being used to take over an existing account.
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export type GoogleContact = { resourceName: string; name: string; phone: string | null };

// Every contact with a name, paged to the end. personFields is deliberately
// the shortest list that makes the feature work: names and phone numbers.
// Asking for emails or addresses would widen what this app stores about
// people who never signed up for it.
export async function fetchContacts(accessToken: string): Promise<GoogleContact[]> {
  const contacts: GoogleContact[] = [];
  let pageToken: string | undefined;
  // Bounded so a 20k-contact account cannot spin here forever; 20 pages of
  // 200 is 4000 contacts, far past what the picker is useful for.
  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      personFields: "names,phoneNumbers",
      pageSize: "200",
      sortOrder: "FIRST_NAME_ASCENDING",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(`${PEOPLE_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Leitura dos contatos falhou (${response.status}): ${await response.text()}`);
    }

    const json = (await response.json()) as {
      connections?: {
        resourceName?: string;
        names?: { displayName?: string }[];
        phoneNumbers?: { value?: string }[];
      }[];
      nextPageToken?: string;
    };

    for (const person of json.connections ?? []) {
      const name = person.names?.[0]?.displayName?.trim();
      if (!person.resourceName || !name) continue;
      contacts.push({
        resourceName: person.resourceName,
        name,
        phone: person.phoneNumbers?.[0]?.value?.trim() || null,
      });
    }

    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return contacts;
}
