import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is not set");
}
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  userId: string;
};

const COOKIE_NAME = "session";
const SESSION_DURATION = "30d";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

// Behind a reverse proxy (Coolify's Traefik/Caddy terminating TLS, or any
// other), the container itself only ever sees plain HTTP — NODE_ENV alone
// can't tell us whether the browser's actual connection was HTTPS. Trust
// X-Forwarded-Proto when a proxy set it; COOKIE_SECURE is an explicit,
// opt-in escape hatch for accessing the app over bare HTTP (no domain, no
// proxy in front) during setup/testing, since a browser silently refuses
// to store a Secure cookie on an insecure connection — which otherwise
// looks exactly like "login succeeds but every click bounces back to
// /login". Defaults to secure whenever neither signal is available.
async function shouldUseSecureCookie(): Promise<boolean> {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  if (forwardedProto) return forwardedProto === "https";
  return process.env.NODE_ENV === "production";
}

export async function createSession(userId: string) {
  const session = await encrypt({ userId });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, session, {
    httpOnly: true,
    secure: await shouldUseSecureCookie(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return decrypt(token);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
