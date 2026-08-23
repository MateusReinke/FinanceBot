import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

// Every signed-in route. The pages themselves also call verifySession, so
// this is defence in depth rather than the only check — but it is what makes
// an unauthenticated hit land on /login with a ?next back to where it was
// going, instead of bouncing through a render first.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/transactions",
  "/receivables",
  "/accounts",
  "/financings",
  "/categories",
  "/budgets",
  "/events",
  "/settings",
  "/bem-vindo",
  "/admin",
];
const AUTH_ROUTES = ["/login", "/register"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtectedRoute = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  const cookie = req.cookies.get("session")?.value;
  const session = await decrypt(cookie);

  if (isProtectedRoute && !session?.userId) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && session?.userId) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|svg|ico)$).*)"],
};
