import Link from "next/link";

// Google's mark, inlined. Their branding guidelines require the official
// four-colour "G" on a sign-in button, and an external <img> would be a
// remote asset this app deliberately does not load.
function GoogleMark() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden>
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

// A plain link, not a form: the OAuth flow is a GET redirect, so this works
// with JavaScript disabled and the browser can show where it goes.
export function GoogleButton({ next, label }: { next?: string; label?: string }) {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";

  return (
    <Link
      href={href}
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      <GoogleMark />
      {label ?? "Entrar com Google"}
    </Link>
  );
}

// The "ou" rule between the Google button and the email/password form.
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">ou</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

// Google redirects back with ?error=... on the login page when something
// went wrong. Each case gets a sentence that says what to do next, instead
// of a code the user cannot act on.
const MESSAGES: Record<string, string> = {
  google_indisponivel: "Login com Google não está configurado neste servidor.",
  google_cancelado: "Login com Google cancelado.",
  google_estado_invalido: "A sessão do login com Google expirou. Tente de novo.",
  google_falhou: "Não consegui completar o login com Google. Tente de novo.",
  google_email_nao_verificado:
    "Sua conta do Google não tem o e-mail verificado, então não dá para usá-la aqui.",
  google_ja_vinculado: "Essa conta do Google já está ligada a outro usuário.",
  google_sem_permissao_contatos:
    "Você entrou, mas não autorizou o acesso aos contatos — a importação continua indisponível.",
};

export function GoogleError({ code }: { code?: string }) {
  const message = code ? MESSAGES[code] : undefined;
  if (!message) return null;
  return (
    <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger" role="alert">
      {message}
    </p>
  );
}
