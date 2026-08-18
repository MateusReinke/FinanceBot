"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { fetchContacts, refreshAccessToken, CONTACTS_SCOPE, isGoogleConfigured } from "@/lib/google";
import { toE164FromLocal } from "@/lib/phone";
import type { FormState } from "@/lib/form-state";

// Returns a usable access token for this user's Google link, refreshing it
// when it has expired. Null means "send them back through Google" — either
// nothing is linked, or the refresh token is gone (revoked in the Google
// account settings, or never issued because consent was not forced).
async function usableAccessToken(userId: string) {
  const link = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!link) return null;

  const stillValid = link.accessToken && link.accessExpiresAt && link.accessExpiresAt > new Date();
  if (stillValid) return link.accessToken;

  if (!link.refreshToken) return null;
  try {
    const refreshed = await refreshAccessToken(link.refreshToken);
    await prisma.googleAccount.update({
      where: { userId },
      data: {
        accessToken: refreshed.accessToken,
        accessExpiresAt: refreshed.expiresAt,
        // A refresh response usually omits scope; keep the stored value when
        // it does, rather than blanking what the user actually granted.
        ...(refreshed.scope ? { grantedScopes: refreshed.scope } : {}),
      },
    });
    return refreshed.accessToken;
  } catch (error) {
    console.error("Falha ao renovar o token do Google", error);
    return null;
  }
}

// Pulls the user's Google Contacts into the local Contact table, so the "de
// quem" field can offer real people instead of an empty text box.
//
// Upserted on resourceName rather than wiped and re-inserted: a re-import
// then picks up edits made in Google without churning every row, and a
// contact deleted in Google is removed here in the same pass.
// Takes the useActionState signature even though it reads no fields — the
// panel drives it from a <form action={...}>, and there is nothing to send
// beyond "import now".
export async function importGoogleContacts(): Promise<FormState> {
  const { userId } = await verifySession();
  if (!isGoogleConfigured()) return { message: "Login com Google não está configurado neste servidor." };

  const link = await prisma.googleAccount.findUnique({ where: { userId } });
  if (!link) return { message: "Conecte sua conta do Google primeiro." };
  if (!link.grantedScopes.split(" ").includes(CONTACTS_SCOPE)) {
    return { message: "Você ainda não autorizou o acesso aos contatos. Clique em “Conectar contatos”." };
  }

  const accessToken = await usableAccessToken(userId);
  if (!accessToken) {
    return { message: "A autorização do Google expirou. Clique em “Conectar contatos” para renovar." };
  }

  let contacts;
  try {
    contacts = await fetchContacts(accessToken);
  } catch (error) {
    console.error("Falha ao importar contatos do Google", error);
    return { message: "Não consegui ler seus contatos agora. Tente novamente em instantes." };
  }

  await syncContactsIntoDatabase(userId, contacts);
  await prisma.googleAccount.update({ where: { userId }, data: { lastContactsSyncAt: new Date() } });

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/receivables");
  return {
    success: true,
    message:
      contacts.length === 1 ? "1 contato importado." : `${contacts.length} contatos importados.`,
  };
}

// Reconciles a list of Google contacts into this user's Contact rows.
//
// Split out from the action above so the part with the rules in it — how a
// phone number is normalized, what counts as the same contact across
// imports, what happens to someone deleted in Google — can be exercised
// without a Google account in the loop.
export async function syncContactsIntoDatabase(
  userId: string,
  contacts: { resourceName: string; name: string; phone: string | null }[]
) {
  const seen = new Set<string>();
  for (const contact of contacts) {
    seen.add(contact.resourceName);
    // Numbers arrive as people typed them into their phone ("(11) 99999-9999",
    // "+55 11 99999 9999", "1234"). toE164FromLocal is what tells those
    // apart, so the WhatsApp link works for all of them — see the note there
    // about why prefixing a bare "+" to local digits is not enough.
    const phone = contact.phone ? toE164FromLocal(contact.phone) : null;

    await prisma.contact.upsert({
      where: { userId_googleResourceName: { userId, googleResourceName: contact.resourceName } },
      create: { userId, name: contact.name, phone, googleResourceName: contact.resourceName },
      update: { name: contact.name, phone },
    });
  }

  // Contacts that vanished from Google since the last import. Scoped to rows
  // that came from Google, so anything the user added by hand survives.
  await prisma.contact.deleteMany({
    where: {
      userId,
      googleResourceName: { not: null },
      ...(seen.size > 0 ? { NOT: { googleResourceName: { in: [...seen] } } } : {}),
    },
  });

  return seen.size;
}

// Disconnecting drops the imported contacts along with the link. Someone
// else's phone number should not outlive the permission that brought it in.
export async function disconnectGoogle() {
  const { userId } = await verifySession();

  await prisma.$transaction([
    prisma.contact.deleteMany({ where: { userId, googleResourceName: { not: null } } }),
    prisma.googleAccount.deleteMany({ where: { userId } }),
  ]);

  revalidatePath("/settings");
  revalidatePath("/transactions");
  revalidatePath("/receivables");
}
